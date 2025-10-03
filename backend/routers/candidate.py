from fastapi import APIRouter, HTTPException, Depends, Header, BackgroundTasks
from typing import List, Optional, Dict, Any
import logging
import time
from models import (
    LoginRequest, 
    SubmissionRequest, 
    StartAssessmentRequest, 
    StartAssessmentResponse,
    UpdateSubmissionRequest,
    Submission,
    SubmissionStatus,
    ScoringStatus,
    AssessmentReport,
    QuestionUnion,
    MCQQuestion,
    DescriptiveQuestion,
    CodingQuestion,
    MCQOption,
    TestCase
)
from datetime import datetime, timedelta
import secrets
import string
from database import CosmosDBService, get_cosmosdb_service
from jose import JWTError, jwt
from pydantic import BaseModel, Field
import os
from datetime_utils import now_ist, now_ist_iso
import httpx
import asyncio

router = APIRouter()
logger = logging.getLogger(__name__)

# JWT Configuration
SECRET_KEY = "your-secret-key-for-development"  # In production, use environment variable
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Rate limiting storage (in production, use Redis)
rate_limit_storage = {}

# Module-level database client placeholder
# Will be initialized lazily on first database access
_db_instance: Optional[CosmosDBService] = None
_db_initialized = False

async def _ensure_db():
    """Ensure database is initialized (call this at module startup or first use)"""
    global _db_instance, _db_initialized
    if not _db_initialized:
        _db_initialized = True
        from main import database_client
        if database_client is not None:
            _db_instance = await get_cosmosdb_service(database_client)
    return _db_instance

# Synchronous accessor for backward compatibility with existing code that references 'db'
# This won't work for sync code, but the file is all async anyway
db = None  # Placeholder, will be set by _ensure_db()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = now_ist() + expires_delta
    else:
        expire = now_ist() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Database and authentication dependencies
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency"""
    from main import database_client
    if database_client is None:
        # In development mode, return None and handle gracefully
        return None
    return await get_cosmosdb_service(database_client)

async def verify_candidate_token(authorization: Optional[str] = Header(None)) -> dict:
    """Verify candidate authentication token and extract candidate info"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    try:
        # Decode JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        candidate_id: str = payload.get("sub")
        if candidate_id is None:
            raise HTTPException(status_code=401, detail="Invalid candidate token")

        # Prefer explicit submission id embedded in token (if present)
        submission_id = payload.get("submission_id") or payload.get("submissionId")

        # Extract login code from candidate_id
        login_code = candidate_id.replace("candidate_", "")

        # Fallback: if submission_id is missing, synthesize a placeholder (will be resolved later)
        if not submission_id:
            timestamp = int(time.time())
            submission_id = f"submission_{login_code}_{timestamp}"

        return {
            "candidate_id": candidate_id,
            "submission_id": submission_id,
            "login_code": login_code,
            "role": payload.get("role"),
            "name": payload.get("name"),
            "email": payload.get("email")
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid candidate token")
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
    candidate_info: dict = Depends(apply_rate_limiting)
) -> dict:
    """Verify candidate has access to their submission and it's not expired"""
    try:
        # Extract login_code from candidate_id for development mode
        login_code = candidate_info["candidate_id"].replace("candidate_", "")
        
        # Get database connection
        db = await get_cosmosdb()
        
        # In development mode without database, skip verification
        if db is None:
            return {**candidate_info, "submission": {"status": "in_progress", "assessment_id": f"test_{login_code}"}}
        
        # Check if submission exists. Accept either direct id match or login_code match (admin-created tests
        # initially may not include candidate_id until the candidate starts the assessment).
        query = "SELECT * FROM c WHERE c.id = @submission_id OR c.login_code = @login_code"
        parameters = [
            {"name": "@submission_id", "value": candidate_info["submission_id"]},
            {"name": "@login_code", "value": login_code}
        ]
        submissions = await db.query_items("submissions", query, parameters, cross_partition=True)
        submission = None
        if submissions:
            # Prefer exact id match if found
            for sub in submissions:
                if sub.get("id") == candidate_info["submission_id"]:
                    submission = sub
                    break
            if submission is None:
                # Otherwise pick the first matching login_code record that is not expired/completed
                for sub in submissions:
                    status = sub.get("status")
                    # Check against proper enum values (with underscores)
                    if status in ["completed", "completed_auto_submitted"]:
                        continue
                    submission = sub
                    break
        
        if not submission:
            logger.error(
                "Submission not found for candidate",
                extra={
                    "login_code": login_code,
                    "candidate_id": candidate_info["candidate_id"],
                    "timestamp": now_ist_iso()
                }
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "submission_not_found",
                    "message": "No active submission found for this login code",
                    "login_code": login_code
                }
            )
        
        # Check if test has expired
        expires_at_str = submission.get("expires_at")
        if expires_at_str:
            expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
            if expires_at < now_ist():
                raise HTTPException(status_code=410, detail="Assessment has expired")
        
        # Check if already completed
        if submission.get("status") in ["completed", "completed_auto_submitted"]:
            raise HTTPException(status_code=403, detail="Assessment already completed")
        
        return {**candidate_info, "submission": submission}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Access verification failed: {str(e)}")


async def validate_assessment_ready(assessment_id: str, db: CosmosDBService) -> dict:
    """
    Validate assessment is ready for test taking
    
    Args:
        assessment_id: The assessment ID to validate
        db: Database service instance
        
    Returns:
        dict: Validation result with question count
        
    Raises:
        HTTPException: If assessment not found or has no questions
    """
    try:
        # Fetch assessment document
        query = "SELECT * FROM c WHERE c.id = @assessment_id"
        parameters = [{"name": "@assessment_id", "value": assessment_id}]
        assessments = await db.query_items("assessments", query, parameters, cross_partition=True)
        
        if not assessments:
            logger.error(
                "Assessment validation failed - not found",
                extra={
                    "assessment_id": assessment_id,
                    "timestamp": now_ist_iso()
                }
            )
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "assessment_not_found",
                    "message": f"Assessment {assessment_id} does not exist",
                    "assessment_id": assessment_id
                }
            )
        
        assessment = assessments[0]
        questions = assessment.get("questions", [])
        
        # Validate minimum question count
        MIN_QUESTIONS_REQUIRED = int(os.getenv("MIN_QUESTIONS_REQUIRED", "1"))
        
        if not questions or len(questions) < MIN_QUESTIONS_REQUIRED:
            logger.error(
                "Assessment validation failed - insufficient questions",
                extra={
                    "assessment_id": assessment_id,
                    "question_count": len(questions),
                    "min_required": MIN_QUESTIONS_REQUIRED,
                    "timestamp": now_ist_iso()
                }
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "assessment_incomplete",
                    "message": f"Assessment has insufficient questions ({len(questions)}/{MIN_QUESTIONS_REQUIRED}). Question generation may still be in progress.",
                    "assessment_id": assessment_id,
                    "current_count": len(questions),
                    "required_count": MIN_QUESTIONS_REQUIRED
                }
            )
        
        logger.info(
            f"Assessment validation passed: {assessment_id} with {len(questions)} questions"
        )
        
        return {
            "valid": True,
            "question_count": len(questions),
            "assessment_id": assessment_id,
            "assessment_title": assessment.get("title", "Untitled Assessment")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Assessment validation error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "validation_failed",
                "message": f"Failed to validate assessment: {str(e)}"
            }
        )


# Helper function to create submission instance
def create_submission_instance(assessment_id: str, candidate_id: str, login_code: str, created_by: str) -> Submission:
    """Create a new Submission instance with proper validation"""
    expiration_time = now_ist() + timedelta(hours=2)  # Default 2 hour expiration
    
    return Submission(
        assessment_id=assessment_id,
        candidate_id=candidate_id,
        status=SubmissionStatus.IN_PROGRESS,
    start_time=now_ist(),
        expiration_time=expiration_time,
        login_code=login_code,
        created_by=created_by,
        answers=[],
        proctoring_events=[]
    )

# Mock data removed for production readiness

# Mock questions removed for production readiness


@router.get("/assessment/{assessment_id}/readiness")
async def check_assessment_readiness(
    assessment_id: str
):
    """Check if an assessment is ready to be taken.
    
    This endpoint allows the frontend to check if an assessment has questions
    before attempting to start it. Useful for showing loading states while
    questions are being generated.
    
    Returns:
        - ready: Whether assessment can be started
        - question_count: Number of questions available
        - status: Assessment generation status
        - message: Human-readable status message
    """
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    from constants import MIN_QUESTIONS_REQUIRED, CONTAINER
    
    logger.info(f"Readiness check requested for assessment {assessment_id}")
    
    # Database connection required
    if db is None:
        logger.error("Database connection not available for readiness check")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "database_unavailable",
                "message": "Database connection required for readiness check"
            }
        )
    
    try:
        # Fetch assessment from database
        query = "SELECT * FROM c WHERE c.id = @assessment_id"
        parameters = [{"name": "@assessment_id", "value": assessment_id}]
        assessments = await db.query_items(
            CONTAINER["ASSESSMENTS"],
            query,
            parameters,
            cross_partition=True
        )
        
        if not assessments:
            logger.error(f"Assessment not found for readiness check: {assessment_id}")
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "assessment_not_found",
                    "message": "Assessment not found",
                    "assessment_id": assessment_id
                }
            )
        
        assessment = assessments[0]
        questions = assessment.get("questions", [])
        question_count = len(questions)
        
        # Check metadata for generation status
        metadata = assessment.get("metadata", {})
        has_generated = metadata.get("has_generated", False)
        generation_timestamp = metadata.get("generation_timestamp")
        
        # Determine readiness
        is_ready = question_count >= MIN_QUESTIONS_REQUIRED
        
        # Determine status
        if is_ready:
            status = "ready"
            message = f"Assessment ready with {question_count} questions"
        elif has_generated and question_count == 0:
            status = "generation_failed"
            message = "Question generation may have failed. Please contact administrator."
        elif has_generated and question_count < MIN_QUESTIONS_REQUIRED:
            status = "partially_generated"
            message = f"Only {question_count}/{MIN_QUESTIONS_REQUIRED} questions available. Generation may still be in progress."
        elif not questions:
            status = "generating"
            message = "Questions are being generated. Please wait..."
        else:
            status = "unknown"
            message = "Assessment status unclear. Please contact administrator."
        
        response = {
            "ready": is_ready,
            "question_count": question_count,
            "required_count": MIN_QUESTIONS_REQUIRED,
            "status": status,
            "message": message,
            "assessment_id": assessment_id,
            "assessment_title": assessment.get("title", "Untitled Assessment"),
            "metadata": {
                "has_generated": has_generated,
                "generation_timestamp": generation_timestamp
            }
        }
        
        logger.info(
            f"Readiness check completed for {assessment_id}: "
            f"ready={is_ready}, questions={question_count}, status={status}"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error checking assessment readiness for {assessment_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "readiness_check_failed",
                "message": f"Failed to check assessment readiness: {str(e)}"
            }
        )


@router.post("/assessment/start")
async def start_assessment(
    request: StartAssessmentRequest,
    candidate_info: dict = Depends(verify_candidate_access)
):
    """Create and start a new assessment session with candidate tracking"""
    
    cosmos_db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    try:
        # Database connection required for production
        if cosmos_db is None:
            logger.error("Database connection unavailable", extra={"endpoint": "start_assessment"})
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "database_unavailable",
                    "message": "Database service is currently unavailable"
                }
            )
        
        # Validate assessment is ready (has questions)
        validation_result = await validate_assessment_ready(request.assessment_id, cosmos_db)
        
        logger.info(
            f"Starting assessment for candidate",
            extra={
                "assessment_id": request.assessment_id,
                "candidate_id": request.candidate_id,
                "question_count": validation_result["question_count"]
            }
        )
        
        # Get assessment details from Cosmos DB
        query = "SELECT * FROM c WHERE c.id = @assessment_id"
        parameters = [{"name": "@assessment_id", "value": request.assessment_id}]
        assessments = await cosmos_db.query_items("assessments", query, parameters)
        assessment = assessments[0]  # Already validated, so must exist
        
        # Update submission with candidate_id and start time
        submission_id = candidate_info["submission_id"]
        candidate_id = request.candidate_id
        
        update_data = {
            "candidate_id": candidate_id,  # Critical: Link submission to candidate
            "started_at": now_ist().isoformat(),
            "status": "in_progress"
        }
        
        await cosmos_db.update_item(
            "submissions", 
            submission_id, 
            update_data,
            partition_key=assessment["id"]
        )
        
        # Calculate expiration time
        duration_minutes = assessment.get("duration", 60)
        start_time = now_ist()
        expiration_time = start_time + timedelta(minutes=duration_minutes)
        
        # Return assessment with limited info for security
        # Use plain dict with aliased keys to avoid Pydantic response-model validation issues
        return {
            "submission_id": submission_id,
            "expirationTime": expiration_time.isoformat() + "Z",
            "durationMinutes": duration_minutes,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start assessment: {str(e)}")


@router.get("/assessment/{submission_id}/questions")
async def get_assessment_questions(
    submission_id: str,
    candidate_info: dict = Depends(verify_candidate_access)
) -> List[QuestionUnion]:
    """Get list of questions for current assessment (candidate-specific endpoint).
    
    This endpoint validates that the assessment is ready with sufficient questions
    before returning them. If questions are still being generated, it returns
    an appropriate error with retry recommendation.
    """
    from constants import MIN_QUESTIONS_REQUIRED
    
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
        
        # Get questions
        questions = assessment.get("questions", [])
        
        # ===== PHASE 4: State-Based Blocking =====
        # Validate assessment has sufficient questions before allowing access
        if len(questions) < MIN_QUESTIONS_REQUIRED:
            metadata = assessment.get("metadata", {})
            has_generated = metadata.get("has_generated", False)
            
            logger.warning(
                f"Assessment {assessment_id} has insufficient questions: "
                f"{len(questions)}/{MIN_QUESTIONS_REQUIRED}"
            )
            
            # Provide helpful error message based on status
            if has_generated:
                error_message = (
                    f"Assessment has only {len(questions)} question(s), but "
                    f"{MIN_QUESTIONS_REQUIRED} are required. Question generation "
                    "may have encountered issues. Please contact administrator."
                )
                status_hint = "generation_incomplete"
                retry_recommended = False
            else:
                error_message = (
                    f"Assessment questions are still being generated. "
                    f"Current: {len(questions)}/{MIN_QUESTIONS_REQUIRED}. "
                    "Please wait and try again in a few moments."
                )
                status_hint = "generation_in_progress"
                retry_recommended = True
            
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "assessment_not_ready",
                    "message": error_message,
                    "status": status_hint,
                    "assessment_id": assessment_id,
                    "current_count": len(questions),
                    "required_count": MIN_QUESTIONS_REQUIRED,
                    "retry_recommended": retry_recommended
                }
            )
        
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
    candidate_info: dict = Depends(verify_candidate_token)
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
    """Fetch questions for a given test - requires database connection"""
    raise HTTPException(
        status_code=501,
        detail={
            "error": "endpoint_deprecated",
            "message": "This endpoint is deprecated. Use /assessment/{submission_id}/questions/page instead"
        }
    )


@router.get("/assessment/{submission_id}/questions/page")
async def get_assessment_questions_paginated(
    submission_id: str,
    limit: int = 10,
    cursor: Optional[str] = None,
    candidate_info: dict = Depends(verify_candidate_access)
):
    """Paginated question retrieval.

    Behavior:
      * If Cosmos DB available: fetch assessment document, deterministically order questions
        (by existing index order or by embedded 'order' field if present), then slice.
      * If no DB (dev mock): fallback to in-memory mock_questions.

    Cursor semantics: numeric string offset (0-based). Next cursor omitted when end reached.
    """
    # Accept any non-empty submission id (admin-created tests may use 'test_' prefix)
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    if not submission_id or not isinstance(submission_id, str) or submission_id.strip() == "":
        raise HTTPException(status_code=400, detail="Invalid submission id")

    limit = max(1, min(limit, 50))

    # Database connection required
    if db is None:
        logger.error(
            "Database unavailable for question retrieval",
            extra={"submission_id": submission_id}
        )
        raise HTTPException(
            status_code=503,
            detail={
                "error": "database_unavailable",
                "message": "Database service is currently unavailable"
            }
        )    # With DB: verify_candidate_access already resolved and attached the submission
    submission_doc = candidate_info.get("submission")
    if not submission_doc:
        raise HTTPException(status_code=404, detail="Submission not found")

    assessment_id = submission_doc.get("assessment_id")
    if not assessment_id:
        raise HTTPException(status_code=500, detail="Submission missing assessment mapping")

    # Fetch assessment document by id
    assessment_query = "SELECT * FROM c WHERE c.id = @aid"
    assessment_params = [{"name": "@aid", "value": assessment_id}]
    assessments = await db.query_items("assessments", assessment_query, assessment_params, cross_partition=False)
    if not assessments:
        logger.error(
            "Assessment not found for submission",
            extra={
                "assessment_id": assessment_id,
                "submission_id": submission_id,
                "timestamp": now_ist_iso()
            }
        )
        raise HTTPException(
            status_code=404,
            detail={
                "error": "assessment_not_found",
                "message": f"Assessment {assessment_id} does not exist",
                "assessment_id": assessment_id
            }
        )
    assessment_doc = assessments[0]

    raw_questions = assessment_doc.get("questions", [])
    
    # Validate assessment has questions
    if not raw_questions:
        logger.error(
            "Assessment has no questions",
            extra={
                "assessment_id": assessment_id,
                "submission_id": submission_id,
                "timestamp": now_ist_iso()
            }
        )
        raise HTTPException(
            status_code=400,
            detail={
                "error": "assessment_incomplete",
                "message": "Assessment has no questions. Question generation may still be in progress.",
                "assessment_id": assessment_id
            }
        )

    # Deterministic ordering: prefer explicit 'order' field ascending else preserve array order.
    # Also foresee future immutability cursor using question id; for now keep numeric offset support.
    def sort_key(q: Dict[str, Any]):
        # If 'order' is missing, fall back to original index preserved by enumerate pairing
        return q[1].get("order", q[0])
    indexed_questions = list(enumerate(raw_questions))
    ordered = [q for _, q in sorted(indexed_questions, key=sort_key)]

    # Cursor handling: support numeric offset; optionally if cursor starts with 'id:' treat rest as question id.
    start_index = 0
    if cursor:
        if cursor.startswith("id:"):
            target_id = cursor[3:]
            for idx, q in enumerate(ordered):
                qid = q.get("_id") or q.get("id") or q.get("question_id")
                if qid == target_id:
                    start_index = idx
                    break
            else:
                # If id cursor not found, treat as end (empty page)
                return {
                    "success": True,
                    "questions": [],
                    "nextCursor": None,
                    "total": len(ordered),
                    "pageSize": limit,
                    "returned": 0
                }
        else:
            try:
                start_index = int(cursor)
            except ValueError:
                start_index = 0
    if start_index < 0:
        start_index = 0
    total_q = len(ordered)
    if start_index >= total_q:
        return {
            "success": True,
            "questions": [],
            "nextCursor": None,
            "total": total_q,
            "pageSize": limit,
            "returned": 0
        }

    end_index = min(start_index + limit, total_q)
    slice_questions = ordered[start_index:end_index]

    # Transform & sanitize MCQ questions (remove correct answers, map options to text list) similar to mock path
    sanitized: List[Dict[str, Any]] = []
    for q in slice_questions:
        # Work on a shallow copy to avoid mutating stored doc
        qc = dict(q)
        qtype = qc.get("type") or qc.get("question_type")
        # Normalize MCQ fields
        if qtype == "mcq":
            # Options might be objects with id/text or already strings
            opts = qc.get("options")
            if isinstance(opts, list):
                normalized_opts = []
                for opt in opts:
                    if isinstance(opt, dict):
                        normalized_opts.append(opt.get("text") or opt.get("label") or opt.get("value"))
                    else:
                        normalized_opts.append(str(opt))
                qc["options"] = normalized_opts
            # Strip answer keys
            qc.pop("correct_answer", None)
            qc.pop("correctAnswer", None)
        sanitized.append(qc)

    next_cursor_val: Optional[str] = None
    if end_index < total_q:
        # Provide numeric next cursor (offset). For immutable ordering alternative cursor id:<question_id> could be added later.
        next_cursor_val = str(end_index)

    return {
        "success": True,
        "questions": sanitized,
        "nextCursor": next_cursor_val,
        "total": total_q,
        "pageSize": limit,
        "returned": len(sanitized)
    }


# ===== Autosave Support (Development Mode) =====
class AutosaveAnswer(BaseModel):
    question_id: str = Field(..., alias="questionId")
    question_type: Optional[str] = Field(None, alias="questionType")
    submitted_answer: Optional[str] = Field(None, alias="submittedAnswer")
    time_spent: Optional[int] = Field(0, alias="timeSpent")

class AutosaveEvent(BaseModel):
    timestamp: str
    eventType: str
    details: dict

class AutosaveRequest(BaseModel):
    answers: List[AutosaveAnswer]
    proctoring_events: List[AutosaveEvent] = Field(default_factory=list, alias="proctoringEvents")
    saved_at: Optional[str] = Field(None, alias="savedAt")

@router.post("/assessment/{submission_id}/autosave")
async def autosave_assessment(
    submission_id: str,
    request: AutosaveRequest,
    candidate_info: dict = Depends(verify_candidate_token)
):
    """Persist in_progress answers. Production: Upsert partial state under submission doc."""
    # Autosave functionality removed - requires database connection
    # In production, this should update the submission document in Cosmos DB
    raise HTTPException(
        status_code=501,
        detail={
            "error": "autosave_not_implemented",
            "message": "Autosave requires database connection"
        }
    )


# ===========================
# BACKGROUND SCORING TASK (Phase 1)
# ===========================

async def trigger_report_generation(submission_id: str, db: CosmosDBService):
    """
    Background task to generate comprehensive assessment report using Autogen Report_Synthesizer.
    
    Called after scoring completes successfully. Generates:
    - Executive summary
    - Detailed analysis
    - Competency breakdown
    - Recommendations
    
    Phase 3: Report Generation Integration
    """
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    from constants import LLM_AGENT_URL, LLM_AGENT_TIMEOUT, LLM_AGENT_MAX_RETRIES, CONTAINER
    
    logger.info(f"Starting report generation for submission: {submission_id}")
    
    try:
        # Step 1: Call llm-agent service for report generation
        logger.info(f"Calling Autogen report service at {LLM_AGENT_URL}/generate-report")
        
        retry_count = 0
        
        while retry_count < LLM_AGENT_MAX_RETRIES:
            try:
                async with httpx.AsyncClient(timeout=LLM_AGENT_TIMEOUT) as client:
                    response = await client.post(
                        f"{LLM_AGENT_URL}/generate-report",
                        json={"submission_id": submission_id, "debug_mode": False}
                    )
                    response.raise_for_status()
                    report_data = response.json()
                    
                    logger.info(f"Report generation completed for {submission_id}")
                    
                    # Step 2: Fetch submission to get assessment_id and candidate info
                    submission = await db.find_one(CONTAINER["SUBMISSIONS"], {"id": submission_id})
                    if not submission:
                        logger.warning(f"Submission {submission_id} not found for report storage")
                        return
                    
                    # Step 3: Extract structured report data
                    report_content = report_data.get("report", {})
                    recommendations = report_data.get("recommendations", [])
                    executive_summary = report_data.get("executive_summary", "")
                    detailed_analysis = report_data.get("detailed_analysis", "")
                    competency_breakdown = report_data.get("competency_breakdown")
                    generation_metadata = report_data.get("generation_metadata", {})
                    
                    # Extract strengths and areas from report content
                    strengths = []
                    areas_for_development = []
                    
                    # Try to parse from detailed_analysis or use defaults
                    if "STRENGTHS" in detailed_analysis.upper():
                        import re
                        strengths_match = re.search(r'STRENGTHS?[:\\s]*([^#]+?)(?=AREAS|RECOMMENDATIONS|$)', detailed_analysis, re.DOTALL | re.IGNORECASE)
                        if strengths_match:
                            strengths_text = strengths_match.group(1).strip()
                            strengths = [line.strip() for line in strengths_text.split('\\n') if line.strip() and (line.strip().startswith('-') or line.strip().startswith('*'))][:5]
                    
                    if "AREAS FOR DEVELOPMENT" in detailed_analysis.upper() or "AREAS TO IMPROVE" in detailed_analysis.upper():
                        import re
                        areas_match = re.search(r'AREAS (?:FOR DEVELOPMENT|TO IMPROVE)[:\\s]*([^#]+?)(?=RECOMMENDATIONS|$)', detailed_analysis, re.DOTALL | re.IGNORECASE)
                        if areas_match:
                            areas_text = areas_match.group(1).strip()
                            areas_for_development = [line.strip() for line in areas_text.split('\\n') if line.strip() and (line.strip().startswith('-') or line.strip().startswith('*'))][:5]
                    
                    # Step 4: Create AssessmentReport document
                    report_doc = AssessmentReport(
                        id=f"report_{submission_id}_{int(datetime.now().timestamp())}",
                        submission_id=submission_id,
                        assessment_id=submission.get("assessment_id") or submission.get("assessmentId"),
                        candidate_email=submission.get("candidate_email"),
                        executive_summary=executive_summary,
                        detailed_analysis=detailed_analysis,
                        recommendations=recommendations,
                        competency_breakdown=competency_breakdown,
                        strengths=strengths,
                        areas_for_development=areas_for_development,
                        generation_method="autogen_report_v1",
                        generation_duration_seconds=generation_metadata.get("duration_seconds"),
                        agent_conversation_length=generation_metadata.get("agent_messages"),
                        overall_score=submission.get("overall_score"),
                        max_possible_score=submission.get("max_possible_score"),
                        percentage_score=submission.get("percentage_score"),
                        raw_report=report_content.get("raw_report"),
                        created_at=now_ist(),
                        updated_at=now_ist()
                    )
                    
                    # Step 5: Store report in Reports container
                    await db.upsert_item(CONTAINER["REPORTS"], report_doc.model_dump(by_alias=True))
                    
                    # Step 6: Update submission with report reference
                    await db.update_item(
                        CONTAINER["SUBMISSIONS"],
                        submission_id,
                        {
                            "report_id": report_doc.id,
                            "reportId": report_doc.id,
                            "report_generated_at": now_ist().isoformat(),
                            "reportGeneratedAt": now_ist().isoformat()
                        },
                        partition_key=submission_id
                    )
                    
                    logger.info(f"Report stored successfully: {report_doc.id}")
                    return
                    
            except httpx.HTTPError as e:
                retry_count += 1
                logger.warning(f"Report generation attempt {retry_count} failed: {e}")
                
                if retry_count < LLM_AGENT_MAX_RETRIES:
                    await asyncio.sleep(2 ** retry_count)
                else:
                    logger.error(f"Report generation failed after {LLM_AGENT_MAX_RETRIES} retries")
                    return
                    
    except Exception as e:
        logger.exception(f"Report generation failed for {submission_id}: {e}")


async def trigger_scoring_workflow(submission_id: str, db: CosmosDBService):
    """
    Background task to trigger AI scoring workflow using Autogen multi-agent service.
    
    This function is called asynchronously after submission is saved to avoid blocking
    the submission response. It updates the submission with scoring status throughout
    the process.
    
    Phase 1: Calls the llm-agent microservice for Autogen-based scoring
    """
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    from constants import LLM_AGENT_URL, LLM_AGENT_TIMEOUT, LLM_AGENT_MAX_RETRIES, CONTAINER
    
    logger.info(f"Starting background scoring workflow for submission: {submission_id}")
    
    try:
        # Step 1: Update scoring status to IN_PROGRESS
        await db.update_item(
            CONTAINER["SUBMISSIONS"],
            submission_id,
            {
                "scoring_status": ScoringStatus.IN_PROGRESS.value,
                "scoringStatus": ScoringStatus.IN_PROGRESS.value,
                "scoring_started_at": now_ist().isoformat(),
                "scoringStartedAt": now_ist().isoformat(),
                "scoring_method": "autogen_v1",
                "scoringMethod": "autogen_v1"
            },
            partition_key=submission_id
        )
        
        # Step 2: Call llm-agent service for Autogen multi-agent scoring
        logger.info(f"Calling Autogen service at {LLM_AGENT_URL}/assess-submission")
        
        retry_count = 0
        last_error = None
        
        while retry_count < LLM_AGENT_MAX_RETRIES:
            try:
                async with httpx.AsyncClient(timeout=LLM_AGENT_TIMEOUT) as client:
                    response = await client.post(
                        f"{LLM_AGENT_URL}/assess-submission",
                        json={"submission_id": submission_id, "debug_mode": False}
                    )
                    response.raise_for_status()
                    scoring_result = response.json()
                    
                    logger.info(f"Autogen scoring completed for {submission_id}: {scoring_result.get('status')}")
                    
                    # Step 3: Update submission with completed status
                    await db.update_item(
                        CONTAINER["SUBMISSIONS"],
                        submission_id,
                        {
                            "scoring_status": ScoringStatus.COMPLETED.value,
                            "scoringStatus": ScoringStatus.COMPLETED.value,
                            "scoring_completed_at": now_ist().isoformat(),
                            "scoringCompletedAt": now_ist().isoformat(),
                            "scoring_error": None,
                            "scoringError": None
                        },
                        partition_key=submission_id
                    )
                    
                    logger.info(f"Scoring workflow completed successfully for {submission_id}")
                    
                    # Phase 3: Trigger report generation after successful scoring
                    try:
                        await trigger_report_generation(submission_id, db)
                    except Exception as report_error:
                        # Log but don't fail the scoring workflow
                        logger.warning(f"Report generation failed but scoring succeeded: {report_error}")
                    
                    return
                    
            except httpx.HTTPError as e:
                last_error = str(e)
                retry_count += 1
                logger.warning(f"Autogen scoring attempt {retry_count} failed: {e}")
                
                if retry_count < LLM_AGENT_MAX_RETRIES:
                    # Exponential backoff: 2^retry_count seconds
                    await asyncio.sleep(2 ** retry_count)
                else:
                    raise
        
        # If all retries failed, raise the last error
        if last_error:
            raise Exception(f"Autogen scoring failed after {LLM_AGENT_MAX_RETRIES} retries: {last_error}")
            
    except Exception as e:
        logger.exception(f"Scoring workflow failed for {submission_id}: {e}")
        
        # Update submission with failed status
        try:
            await db.update_item(
                CONTAINER["SUBMISSIONS"],
                submission_id,
                {
                    "scoring_status": ScoringStatus.FAILED.value,
                    "scoringStatus": ScoringStatus.FAILED.value,
                    "scoring_completed_at": now_ist().isoformat(),
                    "scoringCompletedAt": now_ist().isoformat(),
                    "scoring_error": str(e),
                    "scoringError": str(e)
                },
                partition_key=submission_id
            )
        except Exception as update_error:
            logger.error(f"Failed to update scoring status after error: {update_error}")


@router.post("/assessment/{submission_id}/submit")
async def submit_assessment(
    submission_id: str,
    request: UpdateSubmissionRequest,
    background_tasks: BackgroundTasks,
    candidate_info: dict = Depends(verify_candidate_token),
    x_submission_token: Optional[str] = Header(None, convert_underscores=False)
):
    """Update submission with final answers and mark as completed.
    
    This endpoint handles both manual submissions and auto-submissions from timer expiry.
    When auto_submitted=True, the submission status is set to 'completed_auto_submitted'.
    """
    from constants import AUTO_SUBMIT_ENABLED, AUTO_SUBMIT_GRACE_PERIOD, CONTAINER
    
    logger.info(
        f"Submit assessment called for submission_id={submission_id}, "
        f"auto_submitted={request.auto_submitted}, "
        f"candidate={candidate_info.get('sub')}"
    )
    
    # Get database connection
    db = await get_cosmosdb()
    
    # Database connection required
    if db is None:
        logger.error("Database connection not available for submission")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "database_unavailable",
                "message": "Database connection required for submission. Please try again later."
            }
        )
    
    # Validate candidate owns this submission
    candidate_id = candidate_info.get("sub")
    if not candidate_id:
        logger.error("No candidate ID found in token")
        raise HTTPException(
            status_code=401,
            detail={
                "error": "invalid_token",
                "message": "Invalid authentication token"
            }
        )
    
    try:
        # Fetch submission from database
        submission = await db.get_item(
            CONTAINER["SUBMISSIONS"],
            submission_id,
            partition_key=submission_id  # Submissions use id as partition key
        )
        
        if not submission:
            logger.error(f"Submission not found: {submission_id}")
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "submission_not_found",
                    "message": "Submission not found"
                }
            )
        
        # Verify ownership
        if submission.get("candidate_id") != candidate_id:
            logger.warning(
                f"Candidate {candidate_id} attempted to submit "
                f"submission {submission_id} owned by {submission.get('candidate_id')}"
            )
            raise HTTPException(
                status_code=403,
                detail={
                    "error": "forbidden",
                    "message": "You do not have permission to submit this assessment"
                }
            )
        
        # Check if already submitted
        current_status = submission.get("status")
        if current_status in ["completed", "completed_auto_submitted"]:
            logger.warning(f"Submission {submission_id} already completed with status: {current_status}")
            return {
                "success": True,
                "message": "Submission already completed",
                "submission_id": submission_id,
                "status": current_status,
                "already_completed": True
            }
        
        # ===== Determine Final Status =====
        # If auto_submitted flag is set, use completed_auto_submitted status
        final_status = "completed_auto_submitted" if request.auto_submitted else "completed"
        
        # Check server-side timer expiration
        expiration_time = submission.get("expiration_time") or submission.get("expirationTime")
        is_expired = False
        
        if expiration_time and AUTO_SUBMIT_ENABLED:
            try:
                from datetime import datetime
                exp_dt = datetime.fromisoformat(expiration_time.replace("Z", "+00:00"))
                current_time = now_ist()
                
                # If submission is past expiration + grace period, force auto-submit
                grace_period_dt = exp_dt + timedelta(seconds=AUTO_SUBMIT_GRACE_PERIOD)
                
                if current_time > grace_period_dt:
                    is_expired = True
                    final_status = "completed_auto_submitted"
                    logger.warning(
                        f"Submission {submission_id} past expiration + grace period. "
                        f"Forcing auto-submit status. Expired at: {expiration_time}, "
                        f"Current time: {current_time.isoformat()}"
                    )
            except Exception as e:
                logger.error(f"Error checking expiration time: {e}")
        
        # ===== Update Submission Document =====
        current_time = now_ist()
        
        update_fields = {
            "status": final_status,
            "end_time": current_time.isoformat(),
            "endTime": current_time.isoformat(),  # Support both field names
            "answers": [ans.dict() if hasattr(ans, 'dict') else ans for ans in request.answers],
            "updated_at": current_time.isoformat(),
            "updatedAt": current_time.isoformat()
        }
        
        # Add proctoring events if provided
        if request.proctoring_events:
            existing_events = submission.get("proctoring_events") or submission.get("proctoringEvents") or []
            new_events = [evt.dict() if hasattr(evt, 'dict') else evt for evt in request.proctoring_events]
            update_fields["proctoring_events"] = existing_events + new_events
            update_fields["proctoringEvents"] = existing_events + new_events
        
        # Add auto-submission tracking fields
        update_fields["auto_submitted"] = request.auto_submitted or is_expired
        update_fields["autoSubmitted"] = request.auto_submitted or is_expired
        
        # Phase 1: Initialize scoring status to PENDING
        update_fields["scoring_status"] = ScoringStatus.PENDING.value
        update_fields["scoringStatus"] = ScoringStatus.PENDING.value
        
        if request.auto_submitted or is_expired:
            update_fields["violation_count"] = request.violation_count or submission.get("violation_count", 0)
            update_fields["violationCount"] = request.violation_count or submission.get("violationCount", 0)
            
            # Determine auto-submit reason
            if is_expired:
                reason = "timer_expired"
            elif request.auto_submit_reason:
                reason = request.auto_submit_reason
            else:
                reason = "exceeded_violation_limit"
            
            update_fields["auto_submit_reason"] = reason
            update_fields["autoSubmitReason"] = reason
            update_fields["auto_submit_timestamp"] = request.auto_submit_timestamp or current_time.isoformat()
            update_fields["autoSubmitTimestamp"] = request.auto_submit_timestamp or current_time.isoformat()
            
            logger.info(
                f"Auto-submission recorded for {submission_id}: "
                f"reason={reason}, violations={update_fields['violation_count']}"
            )
        
        # Merge updates with existing submission
        updated_submission = {**submission, **update_fields}
        
        # Update in database
        await db.upsert_item(
            CONTAINER["SUBMISSIONS"],
            updated_submission
        )
        
        logger.info(
            f"Submission {submission_id} completed successfully. "
            f"Status: {final_status}, Auto-submitted: {update_fields['auto_submitted']}, "
            f"Answers: {len(request.answers)}"
        )
        
        # Phase 1: Trigger background scoring workflow
        background_tasks.add_task(trigger_scoring_workflow, submission_id, db)
        logger.info(f"Background scoring task queued for submission: {submission_id}")
        
        return {
            "success": True,
            "message": "Submission completed successfully",
            "submission_id": submission_id,
            "status": final_status,
            "auto_submitted": update_fields["auto_submitted"],
            "auto_submit_reason": update_fields.get("auto_submit_reason"),
            "end_time": update_fields["end_time"],
            "answers_count": len(request.answers),
            "scoring_status": ScoringStatus.PENDING.value  # Phase 1: Inform client scoring is pending
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error submitting assessment {submission_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "submission_failed",
                "message": f"Failed to submit assessment: {str(e)}"
            }
        )


@router.options("/login")
async def candidate_login_options():
    """Handle CORS preflight for candidate login"""
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    return {"message": "OK"}


@router.post("/login")
async def candidate_login(request: LoginRequest):
    """Validate candidate login code and return test details.

    Behavior:
      - If Cosmos DB is available, look up the submission by login_code and return a token if valid.
      - If no DB (development), fall back to in-memory `mock_tests` behavior.
    """
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    logger.info(f"Candidate login attempt with code: {request.login_code}")

    # Validate login code is not empty
    if not request.login_code or not request.login_code.strip():
        logger.warning("Empty login code provided")
        raise HTTPException(status_code=400, detail="Login code is required")

    # If DB available, validate against submissions container
    if db is not None:
        try:
            # Cross-partition query to find submission by login_code
            query = "SELECT * FROM c WHERE c.login_code = @login_code"
            params = [{"name": "@login_code", "value": request.login_code}]
            submissions = await db.query_items("submissions", query, params, cross_partition=True)

            if not submissions:
                logger.warning(f"Login code not found in database: {request.login_code}")
                raise HTTPException(status_code=401, detail="Invalid login code")

            # Prefer the first non-expired, non-completed submission
            chosen = None
            for sub in submissions:
                status = sub.get("status")
                if status in ("completed", "completed_auto_submitted"):
                    continue
                expires_at = sub.get("expires_at") or sub.get("expiration_time")
                if expires_at:
                    try:
                        # Normalize and compare
                        from datetime import datetime
                        exp_dt = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
                        if exp_dt < now_ist():
                            continue
                    except Exception:
                        # Ignore parse issues and accept the submission
                        pass
                chosen = sub
                break

            if not chosen:
                logger.warning(f"No valid submission found for code: {request.login_code}")
                raise HTTPException(status_code=401, detail="Invalid or expired login code")

            # Build response using DB document values
            candidate_id = chosen.get("candidate_id") or f"candidate_{request.login_code}"
            submission_id = chosen.get("id") or f"submission_{request.login_code}_{int(time.time())}"
            test_id = chosen.get("assessment_id") or chosen.get("test_id") or f"test_{request.login_code}"

            token_data = {
                "sub": candidate_id,
                "submission_id": submission_id,
                "role": chosen.get("role") or "Candidate",
                "name": chosen.get("candidate_name") or chosen.get("candidate_email") or "Candidate",
                "email": chosen.get("candidate_email")
            }
            access_token = create_access_token(data=token_data)

            logger.info(f"Candidate login successful (db) for code: {request.login_code}")
            return {
                "success": True,
                "testId": test_id,
                "testTitle": chosen.get("assessment_title") or f"Assessment - {request.login_code}",
                "duration": chosen.get("duration_minutes") or chosen.get("duration") or 60,
                "token": access_token,
                "candidateId": candidate_id,
                "submissionId": submission_id,
                "message": "Login successful"
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Database lookup for login failed")
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "database_error",
                    "message": "Failed to validate login code. Please try again later."
                }
            )


@router.get("/test-credentials")
async def get_test_credentials():
    """Test credentials endpoint disabled in production"""
    raise HTTPException(
        status_code=404,
        detail={
            "error": "endpoint_not_available",
            "message": "Test credentials are not available in production mode"
        }
    )


@router.get("/assessment/{submission_id}/timer")
async def get_timer_status(
    submission_id: str,
    candidate_info: dict = Depends(verify_candidate_token)
):
    """Get current timer status for a submission.
    
    This endpoint allows the frontend to sync its timer with the server
    and detect if the assessment has expired server-side.
    
    Returns:
        - remaining_seconds: How many seconds remain (0 if expired)
        - is_expired: Whether timer has expired
        - expiration_time: Server-side expiration timestamp
        - current_time: Server current time
        - grace_period_active: Whether grace period is still active
    """
    db = await get_cosmosdb()  # WORKAROUND: Manual call instead of Depends
    from constants import AUTO_SUBMIT_GRACE_PERIOD, CONTAINER
    
    logger.debug(f"Timer status requested for submission {submission_id}")
    
    # Database connection required
    if db is None:
        logger.error("Database connection not available for timer sync")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "database_unavailable",
                "message": "Database connection required for timer sync"
            }
        )
    
    # Validate candidate owns this submission\n    candidate_id = candidate_info.get(\"sub\")\n    if not candidate_id:\n        raise HTTPException(\n            status_code=401,\n            detail={\"error\": \"invalid_token\", \"message\": \"Invalid authentication token\"}\n        )\n    \n    try:\n        # Fetch submission from database\n        submission = await db.get_item(\n            CONTAINER[\"SUBMISSIONS\"],\n            submission_id,\n            partition_key=submission_id\n        )\n        \n        if not submission:\n            raise HTTPException(\n                status_code=404,\n                detail={\"error\": \"submission_not_found\", \"message\": \"Submission not found\"}\n            )\n        \n        # Verify ownership\n        if submission.get(\"candidate_id\") != candidate_id:\n            raise HTTPException(\n                status_code=403,\n                detail={\"error\": \"forbidden\", \"message\": \"Access denied\"}\n            )\n        \n        # Check if already completed\n        current_status = submission.get(\"status\")\n        if current_status in [\"completed\", \"completed_auto_submitted\"]:\n            return {\n                \"remaining_seconds\": 0,\n                \"is_expired\": True,\n                \"is_completed\": True,\n                \"status\": current_status,\n                \"message\": \"Assessment already completed\"\n            }\n        \n        # Calculate remaining time\n        expiration_time = submission.get(\"expiration_time\") or submission.get(\"expirationTime\")\n        if not expiration_time:\n            logger.warning(f\"No expiration time found for submission {submission_id}\")\n            return {\n                \"remaining_seconds\": 3600,  # Default 1 hour if not set\n                \"is_expired\": False,\n                \"is_completed\": False,\n                \"warning\": \"No expiration time set\"\n            }\n        \n        from datetime import datetime\n        exp_dt = datetime.fromisoformat(expiration_time.replace(\"Z\", \"+00:00\"))\n        current_time = now_ist()\n        \n        time_diff = (exp_dt - current_time).total_seconds()\n        is_expired = time_diff <= 0\n        \n        # Check if grace period is active\n        grace_period_end = exp_dt + timedelta(seconds=AUTO_SUBMIT_GRACE_PERIOD)\n        grace_period_active = current_time <= grace_period_end\n        \n        response = {\n            \"remaining_seconds\": max(0, int(time_diff)),\n            \"is_expired\": is_expired,\n            \"is_completed\": False,\n            \"expiration_time\": expiration_time,\n            \"current_time\": current_time.isoformat(),\n            \"grace_period_seconds\": AUTO_SUBMIT_GRACE_PERIOD,\n            \"grace_period_active\": grace_period_active,\n            \"status\": current_status\n        }\n        \n        if is_expired:\n            response[\"message\"] = (\n                \"Timer expired. Please submit immediately.\" if grace_period_active\n                else \"Grace period ended. Assessment will be auto-submitted.\"\n            )\n        \n        return response\n        \n    except HTTPException:\n        raise\n    except Exception as e:\n        logger.exception(f\"Error fetching timer status for {submission_id}: {e}\")\n        raise HTTPException(\n            status_code=500,\n            detail={\"error\": \"timer_sync_failed\", \"message\": f\"Failed to sync timer: {str(e)}\"}\n        )


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