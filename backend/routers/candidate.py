from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import (
    LoginRequest, 
    SubmissionRequest, 
    StartAssessmentRequest, 
    StartAssessmentResponse,
    UpdateSubmissionRequest,
    Submission
)
from datetime import datetime, timedelta
import secrets
import string

router = APIRouter()

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

mock_questions = [
    {
        "_id": "q1",
        "type": "mcq",
        "prompt": "What is the time complexity of binary search?",
        "options": ["O(n)", "O(log n)", "O(n^2)", "O(1)"],
        "tags": ["algorithms", "complexity"]
    },
    {
        "_id": "q2", 
        "type": "descriptive",
        "prompt": "Explain the difference between HTTP and HTTPS protocols.",
        "tags": ["networking", "security"]
    },
    {
        "_id": "q3",
        "type": "coding",
        "prompt": "Write a function to find the maximum element in an array.",
        "tags": ["programming", "arrays"]
    }
]


@router.post("/assessment/start")
async def start_assessment(request: StartAssessmentRequest) -> StartAssessmentResponse:
    """Create and start a new assessment session"""
    # In real implementation, fetch assessment details from database
    assessment_id = request.assessment_id
    candidate_id = request.candidate_id
    
    # Mock: Find test data (in production, query database)
    test_data = None
    for test in mock_tests.values():
        if test["id"] == assessment_id:
            test_data = test
            break
    
    if not test_data:
        raise HTTPException(status_code=404, detail="Assessment not found")
    
    # Calculate expiration time
    start_time = datetime.utcnow()
    duration_minutes = test_data.get("duration_minutes", 120)  # Default 2 hours
    expiration_time = start_time + timedelta(minutes=duration_minutes)
    
    # Create submission record
    submission_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    
    # Create submission dictionary for mock storage (in production, save to database)
    submission_data = {
        "id": submission_id,
        "test_id": assessment_id,
        "candidate_email": test_data["candidate_email"],
        "start_time": start_time,
        "expiration_time": expiration_time,
        "status": "in-progress",
        "answers": [],
        "proctoring_events": [],
        "submitted_at": None
    }
    
    # Store in mock storage (in production, save to database)
    mock_submissions[submission_id] = submission_data
    
    return StartAssessmentResponse(
        submission_id=submission_id,
        expiration_time=expiration_time,
        duration_minutes=duration_minutes
    )


@router.get("/assessment/{test_id}")
async def get_assessment(test_id: str):
    """Fetch questions for a given test"""
    # In real implementation, this would fetch from database
    return {
        "success": True,
        "test": {
            "_id": test_id,
            "candidateEmail": "candidate@example.com",
            "status": "in_progress"
        },
        "questions": mock_questions
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