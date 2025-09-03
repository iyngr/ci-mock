from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional
from models import AdminLoginRequest, TestInitiationRequest, Assessment, Submission
import secrets
import string
from datetime import datetime, timedelta
from azure.cosmos import DatabaseProxy
from database import CosmosDBService, get_cosmosdb_service

router = APIRouter()

# Admin authentication and database dependencies
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency - imported from main"""
    from main import database_client
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)

async def verify_admin_token(authorization: Optional[str] = Header(None)) -> dict:
    """Verify admin authentication token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    # In production, you would validate JWT token here
    # For now, we'll use a simple token check
    if token != "admin-mock-token-123":
        raise HTTPException(status_code=401, detail="Invalid admin token")
    
    return {
        "admin_id": "admin-user-1",
        "email": "admin@example.com",
        "name": "Admin User",
        "permissions": ["read", "write", "delete"]
    }

async def get_admin_with_permissions(
    admin: dict = Depends(verify_admin_token),
    required_permission: str = "read"
) -> dict:
    """Check if admin has required permissions"""
    if required_permission not in admin.get("permissions", []):
        raise HTTPException(status_code=403, detail=f"Admin lacks {required_permission} permission")
    return admin

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
async def get_dashboard(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> dict:
    """Get dashboard statistics and test summaries"""
    try:
        # Get real stats from Cosmos DB
        total_tests = await db.count_items("submissions")
        completed_tests = await db.count_items("submissions", {"status": "completed"})
        total_assessments = await db.count_items("assessments")
        
        return {
            "stats": {
                "totalTests": total_tests or mock_dashboard_stats["totalTests"],
                "completedTests": completed_tests or mock_dashboard_stats["completedTests"],
                "pendingTests": (total_tests - completed_tests) or mock_dashboard_stats.get("pendingTests", 0),
                "averageScore": mock_dashboard_stats.get("averageScore", 0),
                "totalAssessments": total_assessments or 5
            },
            "tests": mock_test_summaries,  # Will be replaced with real query
            "admin": {
                "name": admin["name"],
                "email": admin["email"]
            }
        }
    except Exception:
        # Fallback to mock data if database query fails
        return {
            "stats": mock_dashboard_stats,
            "tests": mock_test_summaries,
            "admin": {
                "name": admin["name"], 
                "email": admin["email"]
            }
        }


async def require_write_permission(admin: dict = Depends(verify_admin_token)) -> dict:
    """Dependency that requires write permission"""
    return await get_admin_with_permissions(admin, "write")

@router.post("/tests") 
async def initiate_test(
    request: TestInitiationRequest,
    admin: dict = Depends(require_write_permission),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> dict:
    """Create a new test for a candidate with expiration tracking"""
    # Generate unique login code
    login_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
    
    # Generate test ID
    test_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(10))
    
    # CRITICAL: Calculate expiration timestamp - single source of truth
    expires_at = datetime.utcnow() + timedelta(hours=request.duration_hours or 2)
    
    # Create submission document with expiration tracking
    submission_doc = {
        "id": test_id,
        "candidate_email": request.candidate_email,
        "assessment_id": request.assessment_id,
        "status": "pending",
        "created_at": expires_at.isoformat(),
        "created_by": admin["admin_id"],
        "expires_at": expires_at.isoformat(),  # Used by Azure Function for auto-submit
        "login_code": login_code,
        "candidate_id": None,  # Will be set when candidate logs in
        "started_at": None,
        "completed_at": None,
        "answers": [],
        "scores": {},
        "overall_score": None
    }
    
    try:
        # Store in Cosmos DB submissions container
        await db.create_item("submissions", submission_doc, partition_key=request.assessment_id)
        
        return {
            "success": True,
            "testId": test_id,
            "loginCode": login_code,
            "expiresAt": expires_at.isoformat(),
            "message": f"Test created successfully. Login code: {login_code}",
            "adminInfo": admin["name"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create test: {str(e)}")


@router.get("/tests")
async def get_tests(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[dict]:
    """Get all submissions for admin dashboard"""
    try:
        # Query Cosmos DB for all submissions
        submissions = await db.find_many("submissions", {}, limit=100)
        return submissions or mock_test_summaries
    except Exception:
        # Fallback to mock data
        return mock_test_summaries


@router.get("/submissions")
async def get_all_submissions(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[Submission]:
    """Get list of all assessment submissions"""
    try:
        submissions_data = await db.find_many("submissions", {}, limit=1000)
        return [Submission(**sub) for sub in submissions_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch submissions: {str(e)}")


@router.get("/candidates") 
async def get_all_candidates(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[dict]:
    """Get list of all candidates who have taken tests"""
    try:
        # Cosmos DB SQL query to group candidates
        query = """
        SELECT DISTINCT c.candidate_email as email,
               c.candidate_id,
               COUNT(1) as total_tests,
               SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_tests,
               MAX(c.created_at) as last_test_date
        FROM c 
        WHERE c.candidate_email != null
        GROUP BY c.candidate_email, c.candidate_id
        """
        
        candidates = await db.query_items("submissions", query)
        return candidates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidates: {str(e)}")
        return candidates
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch candidates: {str(e)}")


@router.get("/assessments")
async def get_all_assessments(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[Assessment]:
    """Get list of all created assessments"""
    try:
        assessments_data = await db.find_many("assessments", {}, limit=100)
        return [Assessment(**assessment) for assessment in assessments_data]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch assessments: {str(e)}")


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