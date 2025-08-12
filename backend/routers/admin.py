from fastapi import APIRouter, HTTPException, Depends
from typing import List
from models import AdminLoginRequest, TestInitiationRequest
import secrets
import string
from datetime import datetime, timedelta

router = APIRouter()

# Mock admin data
mock_admin = {
    "email": "admin@example.com",
    "password": "admin123",  # In real app, this would be hashed
    "name": "Admin User"
}

# Mock dashboard data
mock_dashboard_stats = {
    "totalTests": 50,
    "completedTests": 35,
    "pendingTests": 15,
    "averageScore": 78.5
}

mock_test_summaries = [
    {
        "_id": "test1",
        "candidateEmail": "john@example.com",
        "status": "completed",
        "createdAt": "2024-01-15T10:00:00Z",
        "completedAt": "2024-01-15T12:00:00Z",
        "overallScore": 85.0,
        "initiatedBy": "admin@example.com"
    },
    {
        "_id": "test2",
        "candidateEmail": "jane@example.com",
        "status": "pending",
        "createdAt": "2024-01-16T09:00:00Z",
        "overallScore": None,
        "initiatedBy": "admin@example.com"
    }
]


@router.post("/login")
async def admin_login(request: AdminLoginRequest):
    """Authenticate admin user"""
    if request.email == mock_admin["email"] and request.password == mock_admin["password"]:
        # In real app, generate JWT token here
        return {
            "success": True,
            "token": "mock_jwt_token",
            "admin": {
                "email": mock_admin["email"],
                "name": mock_admin["name"]
            }
        }
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/dashboard")
async def get_dashboard():
    """Get dashboard statistics and test summaries"""
    return {
        "stats": mock_dashboard_stats,
        "tests": mock_test_summaries
    }


@router.post("/tests")
async def initiate_test(request: TestInitiationRequest):
    """Create a new test for a candidate"""
    # Generate unique login code
    login_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    # Generate test ID
    test_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    # In real implementation, save to database
    expires_at = datetime.utcnow() + timedelta(hours=request.duration_hours or 2)
    
    return {
        "success": True,
        "testId": test_id,
        "loginCode": login_code,
        "message": f"Test created successfully. Login code: {login_code}"
    }


@router.get("/tests")
async def get_tests():
    """Get all tests for admin dashboard"""
    return {
        "success": True,
        "tests": mock_test_summaries
    }


@router.get("/report/{result_id}")
async def get_detailed_report(result_id: str):
    """Get detailed report for a completed test"""
    # Mock detailed report data
    mock_report = {
        "candidate": {
            "email": "john@example.com",
            "name": "John Doe"
        },
        "test": {
            "_id": result_id,
            "createdAt": "2024-01-15T10:00:00Z",
            "completedAt": "2024-01-15T12:00:00Z",
            "duration": 120  # minutes
        },
        "scores": {
            "overall": 85.0,
            "competencies": {
                "Programming": 90.0,
                "Problem Solving": 80.0,
                "System Design": 85.0
            },
            "subSkills": {
                "JavaScript": 95.0,
                "Algorithms": 85.0,
                "Database Design": 80.0,
                "API Design": 75.0
            }
        },
        "questions": [
            {
                "id": "q1",
                "type": "mcq",
                "prompt": "What is the time complexity of binary search?",
                "candidateAnswer": "O(log n)",
                "correctAnswer": "O(log n)",
                "score": 10.0,
                "maxScore": 10.0
            }
        ],
        "finalSummary": "The candidate demonstrated strong programming skills with excellent understanding of algorithms and data structures. Areas for improvement include system design and database optimization."
    }
    
    return {
        "success": True,
        "report": mock_report
    }