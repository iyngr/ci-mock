from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import LoginRequest, SubmissionRequest
import secrets
import string

router = APIRouter()

# Mock data for development
mock_tests = {
    "TEST123": {
        "id": "test1",
        "candidate_email": "candidate@example.com",
        "status": "pending",
        "question_ids": ["q1", "q2", "q3"]
    }
}

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


@router.post("/submit")
async def submit_assessment(request: SubmissionRequest):
    """Submit candidate answers and create result"""
    # In real implementation, this would save to database
    result_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    return {
        "success": True,
        "resultId": result_id,
        "message": "Assessment submitted successfully"
    }