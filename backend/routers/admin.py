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
    # Mock detailed report data that matches frontend interface
    mock_report = {
        # Page 1 data
        "assessmentName": "Python Django Developer Assessment",
        "candidateName": "John Doe",
        "testDate": "July 25, 2023 12:52:33 PM IST",
        "email": "john@example.com",
        "testTakerId": result_id,
        
        # Page 2 data
        "overallScore": 82,
        "detailedStatus": "Test-taker Completed",
        "testFinishTime": "July 25, 2023 12:52:33 PM IST",
        "lastName": "Doe",
        "dateOfBirth": "Mar 15, 1990",
        "contactNo": "+1-555-0123",
        "gender": "Male",
        "country": "United States",
        "strengths": ["Python Programming", "Django Framework"],
        "areasOfDevelopment": ["Database Optimization", "System Architecture"],
        "competencyAnalysis": [
            {"name": "Python Programming", "score": 88, "category": "exceptional"},
            {"name": "Django Framework", "score": 85, "category": "exceptional"},
            {"name": "Database Design", "score": 75, "category": "good"},
            {"name": "API Development", "score": 82, "category": "exceptional"},
            {"name": "Testing", "score": 65, "category": "good"}
        ],
        
        # Page 3 data
        "subSkillAnalysis": [
            {"skillName": "Python - Basic Syntax", "score": 95, "category": "exceptional"},
            {"skillName": "Django - Models", "score": 88, "category": "exceptional"},
            {"skillName": "Django - Views", "score": 85, "category": "exceptional"},
            {"skillName": "Django - Templates", "score": 80, "category": "good"},
            {"skillName": "Database - Queries", "score": 75, "category": "good"},
            {"skillName": "API - REST Design", "score": 82, "category": "exceptional"},
            {"skillName": "Testing - Unit Tests", "score": 65, "category": "good"},
            {"skillName": "Django - Forms", "score": 90, "category": "exceptional"},
            {"skillName": "Python - Data Structures", "score": 92, "category": "exceptional"},
            {"skillName": "Django - Authentication", "score": 78, "category": "good"}
        ]
    }
    
    return {
        "success": True,
        "report": mock_report
    }