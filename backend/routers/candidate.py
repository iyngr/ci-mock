from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from models import (
    LoginRequest, 
    SubmissionRequest, 
    StartAssessmentRequest, 
    StartAssessmentResponse,
    UpdateSubmissionRequest,
    Submission,
    SubmissionStatus,
    QuestionUnion,
    MCQQuestion,
    DescriptiveQuestion,
    CodingQuestion,
    QuestionType,
    ProgrammingLanguage,
    MCQOption,
    TestCase
)
from datetime import datetime, timedelta
import secrets
import string
from database import CosmosDBService, get_cosmosdb_service
import time

router = APIRouter()

# Rate limiting storage (in production, use Redis)
rate_limit_storage = {}

# Database and authentication dependencies
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency"""
    from main import database_client
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)

async def verify_candidate_token(authorization: Optional[str] = Header(None)) -> dict:
    """Verify candidate authentication token and extract candidate info"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    # In production, validate JWT token here
    # For now, extract candidate info from a simple token format: candidate_id:submission_id:login_code
    try:
        parts = token.split(":")
        if len(parts) != 3:
            raise ValueError("Invalid token format")
        
        candidate_id, submission_id, login_code = parts
        
        return {
            "candidate_id": candidate_id,
            "submission_id": submission_id,
            "login_code": login_code
        }
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid candidate token")

async def apply_rate_limiting(candidate_info: dict = Depends(verify_candidate_token)) -> dict:
    """Apply rate limiting to prevent abuse"""
    candidate_id = candidate_info["candidate_id"]
    current_time = time.time()
    
    # Rate limit: max 10 requests per minute per candidate
    if candidate_id in rate_limit_storage:
        requests = rate_limit_storage[candidate_id]
        # Remove requests older than 1 minute
        requests = [req_time for req_time in requests if current_time - req_time < 60]
        
        if len(requests) >= 10:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Too many requests.")
        
        requests.append(current_time)
        rate_limit_storage[candidate_id] = requests
    else:
        rate_limit_storage[candidate_id] = [current_time]
    
    return candidate_info

async def verify_candidate_access(
    candidate_info: dict = Depends(apply_rate_limiting),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> dict:
    """Verify candidate has access to their submission and it's not expired"""
    try:
        # Check if submission exists and belongs to candidate
        query = "SELECT * FROM c WHERE c.id = @submission_id AND c.candidate_id = @candidate_id"
        parameters = [
            {"name": "@submission_id", "value": candidate_info["submission_id"]},
            {"name": "@candidate_id", "value": candidate_info["candidate_id"]}
        ]
        submissions = await db.query_items("submissions", query, parameters)
        submission = submissions[0] if submissions else None
        
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found or access denied")
        
        # Check if test has expired
        expires_at_str = submission.get("expires_at")
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at < datetime.utcnow():
                raise HTTPException(status_code=410, detail="Assessment has expired")
        
        # Check if already completed
        if submission.get("status") in ["completed", "completed_auto_submitted"]:
            raise HTTPException(status_code=403, detail="Assessment already completed")
        
        return {**candidate_info, "submission": submission}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Access verification failed: {str(e)}")

# Helper function to create submission instance
def create_submission_instance(assessment_id: str, candidate_id: str, login_code: str, created_by: str) -> Submission:
    """Create a new Submission instance with proper validation"""
    expiration_time = datetime.utcnow() + timedelta(hours=2)  # Default 2 hour expiration
    
    return Submission(
        assessment_id=assessment_id,
        candidate_id=candidate_id,
        status=SubmissionStatus.IN_PROGRESS,
        start_time=datetime.utcnow(),
        expiration_time=expiration_time,
        login_code=login_code,
        created_by=created_by,
        answers=[],
        proctoring_events=[]
    )

# Mock data for development
mock_tests = {
    "TEST123": {
        "id": "test1",
        "candidate_email": "candidate@example.com",
        "status": "pending",
        "question_ids": ["q1", "q2", "q3"],
        "duration_minutes": 120  # 2 hours
    }
}

# Mock in-memory storage for submissions (in production, this would be database)
mock_submissions = {}

# Mock in-memory storage for submissions (in production, this would be database)
mock_submissions = {}

# Properly structured questions using Pydantic models
mock_questions = [
    MCQQuestion(
        _id="q1",
        prompt="What is the time complexity of binary search?",
        skill="algorithms",
        tags=["algorithms", "complexity"],
        role="python-backend",
        options=[
            MCQOption(id="a", text="O(n)"),
            MCQOption(id="b", text="O(log n)"),
            MCQOption(id="c", text="O(n^2)"),
            MCQOption(id="d", text="O(1)")
        ],
        correctAnswer="b"
    ),
    DescriptiveQuestion(
        _id="q2",
        prompt="Explain the difference between HTTP and HTTPS protocols.",
        skill="networking",
        tags=["networking", "security"],
        role="fullstack-js",
        maxWords=300
    ),
    CodingQuestion(
        _id="q3",
        prompt="Write a function to find the maximum element in an array.",
        skill="programming",
        tags=["programming", "arrays"],
        role="python-backend",
        starter_code="def find_max(arr):\n    # Your implementation here\n    pass",
        programmingLanguage="python",
        testCases=[
            TestCase(
                input="[1, 3, 2, 8, 5]",
                expectedOutput="8"
            ),
            TestCase(
                input="[-1, -3, -2]",
                expectedOutput="-1"
            )
        ],
        timeLimit=30
    )
]


@router.post("/assessment/start")
async def start_assessment(
    request: StartAssessmentRequest,
    candidate_info: dict = Depends(verify_candidate_access),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> StartAssessmentResponse:
    """Create and start a new assessment session with candidate tracking"""
    
    try:
        # Get assessment details from Cosmos DB
        query = "SELECT * FROM c WHERE c.id = @assessment_id"
        parameters = [{"name": "@assessment_id", "value": request.assessment_id}]
        assessments = await db.query_items("assessments", query, parameters)
        assessment = assessments[0] if assessments else None
        
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Update submission with candidate_id and start time
        submission_id = candidate_info["submission_id"]
        candidate_id = request.candidate_id
        
        update_data = {
            "candidate_id": candidate_id,  # Critical: Link submission to candidate
            "started_at": datetime.utcnow().isoformat(),
            "status": "in_progress"
        }
        
        await db.update_item(
            "submissions", 
            submission_id, 
            update_data,
            partition_key=assessment["id"]
        )
        
        # Return assessment with limited info for security
        return StartAssessmentResponse(
            submission_id=submission_id,
            assessment_id=request.assessment_id,
            candidate_id=candidate_id,
            status="started",
            start_time=datetime.utcnow(),
            duration_minutes=assessment.get("duration", 60),
            question_count=len(assessment.get("questions", []))
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start assessment: {str(e)}")


@router.get("/assessment/{submission_id}/questions")
async def get_assessment_questions(
    submission_id: str,
    candidate_info: dict = Depends(verify_candidate_access),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[QuestionUnion]:
    """Get list of questions for current assessment (candidate-specific endpoint)"""
    
    try:
        # Verify submission belongs to candidate
        if candidate_info["submission_id"] != submission_id:
            raise HTTPException(status_code=403, detail="Access denied to this assessment")
        
        submission = candidate_info["submission"]
        assessment_id = submission["assessment_id"]
        
        # Get assessment questions from Cosmos DB
        query = "SELECT * FROM c WHERE c.id = @assessment_id"
        parameters = [{"name": "@assessment_id", "value": assessment_id}]
        assessments = await db.query_items("assessments", query, parameters)
        assessment = assessments[0] if assessments else None
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")
        
        # Return questions (without correct answers for security)
        questions = assessment.get("questions", [])
        
        # Remove sensitive data like correct_answer for MCQs
        safe_questions = []
        for q in questions:
            question_copy = q.copy()
            if question_copy.get("type") == "mcq":
                # Remove correct answer for security
                question_copy.pop("correct_answer", None)
            safe_questions.append(question_copy)
        
        return safe_questions
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch questions: {str(e)}")


@router.get("/submissions/history")
async def get_candidate_submission_history(
    candidate_info: dict = Depends(verify_candidate_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[dict]:
    """Get candidate's personal submission history"""
    
    try:
        candidate_id = candidate_info["candidate_id"]
        
        # Get all submissions for this candidate using Cosmos DB SQL query
        query = "SELECT * FROM c WHERE c.candidate_id = @candidate_id ORDER BY c.created_at DESC"
        parameters = [{"name": "@candidate_id", "value": candidate_id}]
        
        submissions = await db.query_items("submissions", query, parameters)
        
        # Return safe subset of data for candidate
        history = []
        for sub in submissions[:100]:  # Limit to 100 records
            history.append({
                "submission_id": sub["id"],
                "assessment_title": sub.get("assessment_title", "Assessment"),
                "status": sub["status"],
                "created_at": sub["created_at"],
                "completed_at": sub.get("completed_at"),
                "overall_score": sub.get("overall_score"),
                "duration_taken": sub.get("duration_taken")
            })
        
        return history
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submission history: {str(e)}")


# === Assessment Questions (List endpoint) ===

@router.get("/assessment/{test_id}")
async def get_assessment(test_id: str):
    """Fetch questions for a given test using proper Pydantic models"""
    # Convert Pydantic models to dicts and transform for frontend compatibility
    questions_data = []
    for question in mock_questions:
        q_dict = question.model_dump(by_alias=True)
        
        # Transform MCQ options from objects to string array for frontend compatibility
        if question.type == "mcq" and "options" in q_dict:
            q_dict["options"] = [opt["text"] for opt in q_dict["options"]]
            # Remove correctAnswer from response for security
            q_dict.pop("correctAnswer", None)
        
        questions_data.append(q_dict)
    
    return {
        "success": True,
        "test": {
            "_id": test_id,
            "candidateEmail": "candidate@example.com",
            "status": "in_progress"
        },
        "questions": questions_data
    }


@router.post("/assessment/submit")
async def submit_assessment(request: UpdateSubmissionRequest):
    """Update submission with final answers and mark as completed"""
    submission_id = request.submission_id
    
    # Find submission (in production, query database)
    if submission_id not in mock_submissions:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    submission = mock_submissions[submission_id]
    
    # Check if submission has expired
    if datetime.utcnow() > submission["expiration_time"]:
        raise HTTPException(status_code=400, detail="Assessment has expired")
    
    # Check if already completed
    if submission["status"] != "in-progress":
        raise HTTPException(status_code=400, detail="Assessment already completed")
    
    # Update submission
    submission["answers"] = [answer.dict() for answer in request.answers]
    submission["proctoring_events"].extend([event.dict() for event in request.proctoring_events])
    submission["status"] = "completed"
    submission["submitted_at"] = datetime.utcnow()
    
    # Save updated submission (in production, update database)
    mock_submissions[submission_id] = submission
    
    # Generate result ID for response
    result_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    return {
        "success": True,
        "resultId": result_id,
        "submissionId": submission_id,
        "message": "Assessment submitted successfully"
    }


@router.post("/login")
async def candidate_login(request: LoginRequest):
    """Validate candidate login code and return test details"""
    if request.login_code in mock_tests:
        test_data = mock_tests[request.login_code]
        return {
            "success": True,
            "testId": test_data["id"],
            "message": "Login successful"
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid login code")


# Legacy endpoint for backward compatibility
@router.post("/submit")
async def submit_assessment_legacy(request: SubmissionRequest):
    """Legacy submit endpoint - deprecated, use /assessment/submit instead"""
    # In real implementation, this would save to database
    result_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    return {
        "success": True,
        "resultId": result_id,
        "message": "Assessment submitted successfully"
    }