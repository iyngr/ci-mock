from fastapi import APIRouter, HTTPException, Depends
from models import CodeExecutionRequest, EvaluationRequest
from pydantic import BaseModel, Field
import httpx
import asyncio
import os
from dotenv import load_dotenv
from database import CosmosDBService, get_cosmosdb_service
from constants import CONTAINER  # use centralized container names
from datetime import datetime
import uuid

# Load environment variables
load_dotenv()

router = APIRouter()

# Judge0 Configuration
JUDGE0_API_URL = os.getenv("JUDGE0_API_URL", "https://judge0-ce.p.rapidapi.com")
JUDGE0_API_KEY = os.getenv("JUDGE0_API_KEY", "")
USE_JUDGE0 = os.getenv("USE_JUDGE0", "false").lower() == "true"


# ===========================
# Mediated Code Run Contracts
# ===========================

class CodeRunRequest(BaseModel):
    submission_id: str = Field(..., alias="submissionId")
    question_id: str = Field(..., alias="questionId")
    language: str
    code: str
    stdin: str | None = None


class CodeRunResponse(BaseModel):
    run_id: str = Field(..., alias="runId")
    success: bool
    output: str | None = None
    error: str | None = None
    execution_time: float | None = Field(None, alias="executionTime")


class FinalizeRunRequest(BaseModel):
    submission_id: str = Field(..., alias="submissionId")
    question_id: str = Field(..., alias="questionId")
    run_id: str = Field(..., alias="runId")
    is_final: bool = Field(default=True, alias="isFinal")


# Database dependency
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency"""
    from main import database_client
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)


@router.post("/run-code")
async def run_code(
    request: CodeExecutionRequest,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Execute code using Judge0 API or mock for development"""
    
    # Execute the code
    if USE_JUDGE0 and JUDGE0_API_KEY:
        result = await execute_with_judge0(request)
    else:
        # Mock implementation for development
        result = await mock_code_execution(request)
    
    # Store execution result in Cosmos DB for analytics and debugging
    try:
        # Ensure a submission_id is present because container PK is /submission_id
        submission_id = request.submission_id or "unassigned"  # groups stray executions
        execution_record = {
            "id": str(uuid.uuid4()),
            "submission_id": submission_id,
            "language": request.language,
            "code": request.code,
            "stdin": request.stdin,
            "result": result,
            "timestamp": datetime.utcnow().isoformat(),
            "execution_type": "judge0" if USE_JUDGE0 and JUDGE0_API_KEY else "mock"
        }

        # Use auto_create_item so partition key is inferred from submission_id
        await db.auto_create_item(CONTAINER["CODE_EXECUTIONS"], execution_record)
    except Exception as e:
        # Don't fail the execution if storage fails, just log it
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to store execution result")
    
    return result


@router.post("/code-runs", response_model=CodeRunResponse)
async def create_code_run(request: CodeRunRequest, db: CosmosDBService = Depends(get_cosmosdb)):
    """Server-authoritative code run: executes via Judge0 or mock, persists as an attempt (is_final=False)."""
    exec_req = CodeExecutionRequest(language=request.language, code=request.code, stdin=request.stdin, submissionId=request.submission_id)

    if USE_JUDGE0 and JUDGE0_API_KEY:
        result = await execute_with_judge0(exec_req)
    else:
        result = await mock_code_execution(exec_req)

    run_id = str(uuid.uuid4())
    record = {
        "id": run_id,
        "submission_id": request.submission_id,
        "question_id": request.question_id,
        "language": request.language,
        "code": request.code,
        "stdin": request.stdin,
        "result": result,
        "timestamp": datetime.utcnow().isoformat(),
        "is_final": False,
        "execution_type": "judge0" if USE_JUDGE0 and JUDGE0_API_KEY else "mock"
    }

    try:
        await db.auto_create_item(CONTAINER["CODE_EXECUTIONS"], record)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to persist code run %s", run_id)

    return CodeRunResponse(
        runId=run_id,
        success=bool(result.get("success")),
        output=result.get("output"),
        error=result.get("error"),
        executionTime=result.get("executionTime")
    )


@router.post("/code-runs/finalize")
async def finalize_code_run(request: FinalizeRunRequest, db: CosmosDBService = Depends(get_cosmosdb)):
    """Mark a code run as final and persist its outcome into the submission answer for scoring."""
    # 1) Fetch the run from CODE_EXECUTIONS (partitioned by /submission_id)
    run_doc = await db.find_one(CONTAINER["CODE_EXECUTIONS"], {"id": request.run_id, "submission_id": request.submission_id})
    if not run_doc:
        raise HTTPException(status_code=404, detail="Run not found")

    # 2) Update is_final flag
    run_doc["is_final"] = bool(request.is_final)
    try:
        await db.update_item(CONTAINER["CODE_EXECUTIONS"], request.run_id, run_doc, partition_key=request.submission_id)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to mark run final")

    # 3) Write execution summary into Submission.answers[].evaluation for the question
    submission_doc = await db.find_one(CONTAINER["SUBMISSIONS"], {"id": request.submission_id})
    if not submission_doc:
        raise HTTPException(status_code=404, detail="Submission not found")

    answers = submission_doc.get("answers", [])
    updated = False
    for a in answers:
        if a.get("questionId") == request.question_id:
            # Ensure evaluation payload matches models.AnswerEvaluation
            res = run_doc.get("result", {})
            a["evaluation"] = {
                "passed": bool(res.get("success")),
                "output": res.get("output"),
                "error": res.get("error"),
                "testResults": None
            }
            updated = True
            break

    if not updated:
        # If the answer slot wasn't found, append a minimal one (keeps system robust)
        res = run_doc.get("result", {})
        answers.append({
            "questionId": request.question_id,
            "questionType": "coding",
            "submittedAnswer": run_doc.get("code", ""),
            "timeSpent": 0,
            "evaluation": {
                "passed": bool(res.get("success")),
                "output": res.get("output"),
                "error": res.get("error"),
                "testResults": None
            }
        })

    submission_doc["answers"] = answers

    try:
        await db.update_item(CONTAINER["SUBMISSIONS"], request.submission_id, submission_doc, partition_key=submission_doc.get("assessment_id"))
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to update submission with final run")

    return {"success": True, "message": "Run finalized and persisted."}


async def mock_code_execution(request: CodeExecutionRequest):
    """Mock code execution for development"""
    await asyncio.sleep(1)  # Simulate execution time
    
    if "error" in request.code.lower():
        return {
            "success": False,
            "error": "Compilation error: syntax error on line 1",
            "executionTime": 0.5
        }
    
    # Mock successful execution based on language and code content
    mock_output = generate_mock_output(request.code, request.language)
    return {
        "success": True,
        "output": mock_output,
        "executionTime": 1.2
    }


def generate_mock_output(code: str, language: str) -> str:
    """Generate realistic mock output based on code content and language"""
    code_lower = code.lower()
    
    if language == "python":
        if "print" in code_lower:
            return "Hello, World!" if "hello" in code_lower else "Output from Python code"
        elif "return" in code_lower:
            return "42" if any(num in code_lower for num in ["42", "sum", "add"]) else "True"
        elif "def" in code_lower:
            return "Function defined successfully"
        else:
            return "Python code executed successfully"
    
    elif language == "javascript":
        if "console.log" in code_lower:
            return "Hello, World!" if "hello" in code_lower else "Output from JavaScript code"
        elif "return" in code_lower:
            return "42" if any(num in code_lower for num in ["42", "sum", "add"]) else "true"
        elif "function" in code_lower:
            return "Function defined successfully"
        else:
            return "JavaScript code executed successfully"
    
    elif language == "java":
        if "system.out.print" in code_lower:
            return "Hello, World!" if "hello" in code_lower else "Output from Java code"
        elif "return" in code_lower:
            return "42" if any(num in code_lower for num in ["42", "sum", "add"]) else "true"
        elif "public static void main" in code_lower:
            return "Main method executed successfully"
        else:
            return "Java code executed successfully"
    
    else:
        return f"{language.title()} code executed successfully"


async def execute_with_judge0(request: CodeExecutionRequest):
    """Execute code using Judge0 API"""
    
    # Judge0 language mappings
    language_ids = {
        "python": 71,      # Python 3.8.1
        "javascript": 63,  # JavaScript (Node.js 12.14.0)
        "java": 62,        # Java (OpenJDK 13.0.1)
        "cpp": 54,         # C++ (GCC 9.2.0)
        "c": 50,           # C (GCC 9.2.0)
        "typescript": 74   # TypeScript (3.7.4)
    }
    
    language_id = language_ids.get(request.language.lower(), 71)  # Default to Python
    
    try:
        # Judge0 API headers
        headers = {
            "content-type": "application/json",
            "X-RapidAPI-Key": JUDGE0_API_KEY,
            "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
        }
        
        # Submit code for execution
        submission_data = {
            "source_code": request.code,
            "language_id": language_id,
            "stdin": request.stdin or "",
            "expected_output": ""
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Submit the code
            response = await client.post(
                f"{JUDGE0_API_URL}/submissions",
                json=submission_data,
                headers=headers,
                params={"base64_encoded": "false", "wait": "true"}
            )
            
            if response.status_code != 201:
                raise HTTPException(status_code=500, detail="Failed to submit code to Judge0")
            
            result = response.json()
            
            # Parse Judge0 response
            if result.get("status", {}).get("id") == 3:  # Accepted
                return {
                    "success": True,
                    "output": result.get("stdout", "").strip(),
                    "error": None,
                    "executionTime": float(result.get("time", 0))
                }
            else:
                error_msg = result.get("stderr", "") or result.get("compile_output", "") or "Execution failed"
                return {
                    "success": False,
                    "output": "",
                    "error": error_msg.strip(),
                    "executionTime": float(result.get("time", 0))
                }
                
    except httpx.TimeoutException:
        raise HTTPException(status_code=408, detail="Code execution timeout")
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Judge0 execution failed")
        raise HTTPException(status_code=500, detail="Judge0 execution failed")


@router.post("/evaluate")
async def evaluate_result(
    request: EvaluationRequest,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Evaluate a completed test using hybrid scoring (redirects to new scoring service)"""
    
    try:
        # Import the new scoring service
        from routers.scoring import ScoringTriageService
        
        # Use the new hybrid scoring system
        triage_service = ScoringTriageService(db)
        result = await triage_service.process_submission(request.submission_id)
        
        # Convert to legacy format for backward compatibility
        legacy_evaluation = {
            "overallScore": result.percentage_score,
            "totalPoints": result.total_score,
            "maxPoints": result.max_possible_score,
            "mcqResults": len(result.mcq_results),
            "llmResults": len(result.llm_results),
            "evaluationTime": result.evaluation_time,
            "costBreakdown": result.cost_breakdown,
            "finalSummary": f"Assessment completed using hybrid scoring. MCQ questions: {len(result.mcq_results)}, LLM evaluated: {len(result.llm_results)}. Total score: {result.percentage_score:.1f}%"
        }
        
        return {
            "success": True,
            "evaluation": legacy_evaluation,
            "message": "Result evaluated successfully using hybrid scoring system"
        }
        
    except Exception as e:
        # Fallback to mock evaluation if hybrid scoring fails
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Hybrid scoring failed, falling back to mock")
        return await _legacy_mock_evaluation(request, db)


async def _legacy_mock_evaluation(request: EvaluationRequest, db: CosmosDBService):
    """Legacy mock evaluation for fallback"""
    
    # Mock AI evaluation
    await asyncio.sleep(2)  # Simulate AI processing time
    
    # In production, this would:
    # 1. Fetch the result from database
    # 2. Evaluate each answer (MCQ, coding tests, descriptive via LLM)
    # 3. Generate overall score and summary
    # 4. Update the result in database
    
    # Produce mock MCQ/LLM style aggregates similar to hybrid path
    total_points = 34.0
    max_points = 40.0
    percentage = total_points / max_points * 100
    evaluation_record = {
        "id": f"eval_{uuid.uuid4().hex[:12]}",
        "submission_id": request.submission_id,
        "assessment_id": None,
        "method": "hybrid_scoring_v1_mock",
        "run_sequence": 1,
        "timing": {
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": datetime.utcnow().isoformat(),
            "duration_seconds": 2.0
        },
        "driver_versions": {"scoring_service": "1.0.0-mock"},
        "mcq_results": [],
        "llm_results": [],
        "aggregates": {
            "total_points": total_points,
            "max_points": max_points,
            "percentage": percentage
        },
        "cost_breakdown": {"mcq_calls": 0, "llm_calls": 0},
        "created_at": datetime.utcnow().isoformat()
    }
    try:
        # Insert record
        await db.auto_create_item(CONTAINER["EVALUATIONS"], evaluation_record)
        # Update submission summary (look up assessment_id for PK)
        submission_doc = await db.find_one(CONTAINER["SUBMISSIONS"], {"id": request.submission_id})
        if submission_doc:
            assessment_id = submission_doc.get("assessment_id")
            summary = {
                "method": "hybrid_scoring_v1_mock",
                "version": 1,
                "summary": {
                    "totalPoints": total_points,
                    "maxPoints": max_points,
                    "percentage": percentage,
                    "mcqCorrect": 0,
                    "mcqTotal": 0,
                    "llmQuestions": 0
                },
                "latestEvaluationId": evaluation_record["id"]
            }
            await db.update_item(
                CONTAINER["SUBMISSIONS"],
                request.submission_id,
                {
                    "score": percentage,
                    "evaluated_at": datetime.utcnow().isoformat(),
                    "evaluation": summary
                },
                partition_key=assessment_id
            )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to store mock evaluation")

    return {
        "success": True,
        "evaluation": {
            "overallScore": percentage,
            "totalPoints": total_points,
            "maxPoints": max_points,
            "finalSummary": "Mock evaluation summary"
        },
        "message": "Result evaluated successfully (legacy mock)"
    }