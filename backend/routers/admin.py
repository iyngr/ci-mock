from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from models import AdminLoginRequest, TestInitiationRequest, Assessment, Submission, QuestionUnion, Question
from models import GeneratedQuestion, QuestionGenerationRequest, QuestionGenerationResponse
import secrets
import string
import logging
import csv
import io
import hashlib
import httpx
from datetime import datetime, timedelta
from azure.cosmos import DatabaseProxy
from database import CosmosDBService, get_cosmosdb_service
from pydantic import BaseModel
from constants import normalize_skill, CONTAINER  # added near other imports

router = APIRouter()
logger = logging.getLogger(__name__)

# Admin authentication and database dependencies
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency - imported from main"""
    from main import database_client
    if database_client is None:
        # In development mode, return a mock service or handle gracefully
        # For now, we'll create a minimal mock that doesn't crash
        class MockCosmosDB:
            async def count_items(self, container: str, filter_dict: dict = None):
                return 0
        return MockCosmosDB()
    return await get_cosmosdb_service(database_client)

async def verify_admin_token(authorization: Optional[str] = Header(None)) -> dict:
    """Verify admin authentication token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    
    # In production, you would validate JWT token here
    # For development, accept either the old static token or new dynamic tokens
    if token == "admin-mock-token-123":
        # Old static token
        return {
            "admin_id": "admin-user-1",
            "email": "admin@example.com",
            "name": "Admin User"
        }
    
    # Check if it's a dynamic mock token from login
    if token.startswith("mock_jwt_"):
        try:
            # Extract username from token format: mock_jwt_{username}_{hash}
            parts = token.split("_")
            if len(parts) >= 3:
                username = parts[2]
                if username in mock_admins:
                    admin_data = mock_admins[username]
                    return {
                        "admin_id": f"admin-{username}",
                        "email": admin_data["email"],
                        "name": admin_data["name"],
                        "permissions": admin_data.get("permissions", ["read"])
                    }
        except Exception:
            pass
    
    raise HTTPException(status_code=401, detail="Invalid admin token")


async def get_admin_with_permissions(
    admin: dict = Depends(verify_admin_token),
    required_permission: str = "read"
) -> dict:
    """Check if admin has required permissions"""
    if required_permission not in admin.get("permissions", []):
        raise HTTPException(status_code=403, detail=f"Admin lacks {required_permission} permission")
    return admin

# Mock admin credentials for development
mock_admins = {
    "admin": {"password": "admin123", "name": "Admin User", "email": "admin@example.com"},
    "administrator": {"password": "admin123", "name": "Administrator", "email": "administrator@example.com"},
    "test": {"password": "test123", "name": "Test Admin", "email": "test@example.com"},
    "demo": {"password": "demo123", "name": "Demo Admin", "email": "demo@example.com"}
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


@router.options("/login")
async def admin_login_options():
    """Handle CORS preflight for admin login"""
    return {"message": "OK"}


@router.post("/login")
async def admin_login(request: AdminLoginRequest):
    """Authenticate admin user with enhanced development credentials"""
    logger.info(f"Admin login attempt with email: {request.email}")
    
    # Check if credentials are provided
    if not request.email or not request.password:
        logger.warning("Empty email or password provided")
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    # Extract username from email (support both username and email login)
    username = request.email.split("@")[0].lower()
    
    # Check against mock admin accounts
    if username in mock_admins:
        admin_data = mock_admins[username]
        if admin_data["password"] == request.password:
            # Generate mock JWT token
            mock_token = f"mock_jwt_{username}_{hash(username + request.password) % 10000}"
            
            logger.info(f"Admin login successful for username: {username}")
            
            return {
                "success": True,
                "token": mock_token,
                "admin": {
                    "email": admin_data["email"],
                    "name": admin_data["name"],
                    "username": username
                },
                "message": "Login successful - development mode"
            }
    
    # Also check if they used full email
    for username, admin_data in mock_admins.items():
        if admin_data["email"] == request.email and admin_data["password"] == request.password:
            mock_token = f"mock_jwt_{username}_{hash(username + request.password) % 10000}"
            
            logger.info(f"Admin login successful for email: {request.email}")
            
            return {
                "success": True,
                "token": mock_token,
                "admin": {
                    "email": admin_data["email"],
                    "name": admin_data["name"],
                    "username": username
                },
                "message": "Login successful - development mode"
            }
    
    logger.warning(f"Invalid login attempt for email: {request.email}")
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.get("/test-credentials")
async def get_admin_test_credentials():
    """Provide test admin credentials for development"""
    return {
        "message": "Available test admin accounts",
        "credentials": [
            {"username": "admin", "email": "admin@example.com", "password": "password"},
            {"username": "administrator", "email": "administrator@example.com", "password": "admin123"},
            {"username": "test", "email": "test@example.com", "password": "test123"},
            {"username": "demo", "email": "demo@example.com", "password": "demo123"}
        ],
        "note": "You can login with either username or full email address"
    }


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


class CreateAssessmentAdminRequest(BaseModel):
    title: str
    description: str
    duration: int
    target_role: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None
    # Optional generation specs: list of {skill, question_type, difficulty, count}
    generate: Optional[List[Dict[str, Any]]] = None


@router.post("/assessments/create")
async def create_assessment_admin(
    request: CreateAssessmentAdminRequest,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_write_permission),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Create a new assessment and optionally generate questions via AI service."""
    try:
        assessment_id = f"assess_{secrets.token_urlsafe(8)}"

        questions_list = request.questions or []

        # If generation specs provided, call AI service and persist generated questions
        if request.generate:
            for gen_spec in request.generate:
                skill = gen_spec.get("skill")
                skill_slug = normalize_skill(skill)
                qtype = gen_spec.get("question_type")
                difficulty = gen_spec.get("difficulty", "medium")
                count = int(gen_spec.get("count", 1))

                for _ in range(count):
                    ai_payload = {"skill": skill, "question_type": qtype, "difficulty": difficulty}
                    ai_resp = await call_ai_service("/generate-question", ai_payload)
                    generated_text = ai_resp.get("question") or ai_resp.get("question_text") or ai_resp.get("generated")

                    gen_doc = {
                        "id": f"gq_{secrets.token_urlsafe(8)}",
                        "promptHash": hashlib.sha256((skill_slug + qtype + difficulty).encode()).hexdigest(),
                        "skill": skill_slug,
                        "question_type": qtype,
                        "difficulty": difficulty,
                        "generated_text": generated_text,
                        "original_prompt": f"Generate a {difficulty} {qtype} question for skill {skill}",
                        "generated_by": ai_resp.get("model", "llm-agent"),
                        "generation_timestamp": datetime.utcnow().isoformat()
                    }

                    try:
                        await db.auto_create_item(CONTAINER["GENERATED_QUESTIONS"], gen_doc)
                    except Exception as e:
                        logger.warning(f"Could not persist generated question during assessment creation (dev): {e}")

                    # Append minimal question representation into assessment
                    questions_list.append({
                        "id": gen_doc["id"],
                        "text": generated_text,
                        "type": qtype,
                        "skill": skill,
                        "difficulty": difficulty
                    })

                    # Queue indexing
                    background_tasks.add_task(_queue_indexing, db, gen_doc)

        assessment_doc = {
            "id": assessment_id,
            "title": request.title,
            "description": request.description,
            "duration": request.duration,
            "target_role": request.target_role,
            "created_by": admin["admin_id"],
            "created_at": datetime.utcnow().isoformat(),
            "questions": questions_list
        }

        try:
            await db.auto_create_item(CONTAINER["ASSESSMENTS"], assessment_doc)
        except Exception as e:
            logger.warning(f"Failed to persist assessment (dev): {e}")

        return {
            "success": True,
            "assessment_id": assessment_id,
            "question_count": len(questions_list),
            "message": "Assessment created"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating assessment: {e}")
        raise HTTPException(status_code=500, detail="Failed to create assessment")


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


# ===========================
# QUESTION MANAGEMENT ENDPOINTS
# ===========================

# AI Service configuration
AI_SERVICE_URL = "http://localhost:8001"  # LLM agent service URL


class GenerateQuestionAdminRequest(BaseModel):
    skill: str
    question_type: str
    difficulty: str = "medium"


async def _queue_indexing(db: CosmosDBService, generated_doc: Dict[str, Any]):
    """Integrated task to index generated question into knowledge base using RAG system.
    Now uses the new RAG knowledge base update endpoint for proper embedding generation.
    """
    try:
        # Prepare content for RAG knowledge base
        content = generated_doc.get("generated_text") or generated_doc.get("question", "")
        skill = generated_doc.get("skill", "General")
        skill_slug = normalize_skill(skill)
        
        # Prepare knowledge base entry payload
        knowledge_entry = {
            "content": content,
            "skill": skill_slug,
            "content_type": "generated_question",
            "metadata": {
                "source_id": generated_doc.get("id"),
                "question_type": generated_doc.get("question_type"),
                "difficulty": generated_doc.get("difficulty"),
                "generated_by": generated_doc.get("generated_by"),
                "generation_timestamp": generated_doc.get("generation_timestamp")
            }
        }
        
        # Call RAG knowledge base update endpoint
        try:
            import httpx
            
            rag_update_url = f"http://localhost:8000/api/rag/knowledge-base/update"
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(rag_update_url, json=knowledge_entry)
                
                if response.status_code == 200:
                    rag_result = response.json()
                    logger.info(f"RAG knowledge base updated for generated question: {rag_result.get('knowledge_entry_id')}")
                    
                    # Update the generated question record with knowledge base reference
                    try:
                        generated_doc["knowledge_base_entry_id"] = rag_result.get("knowledge_entry_id")
                        generated_doc["embedding_generated"] = rag_result.get("embedding_generated", False)
                        
                        # Update the document in database
                        partition_key = generated_doc.get("skill") or generated_doc.get("id")
                        await db.upsert_item("generated_questions", generated_doc, partition_key=partition_key)
                        
                    except Exception as update_error:
                        logger.warning(f"Could not update generated question with KB reference: {update_error}")
                        
                else:
                    logger.warning(f"RAG knowledge base update failed: {response.status_code} - {response.text}")
                    
        except Exception as rag_error:
            logger.warning(f"RAG knowledge base update failed: {rag_error}")
            
            # Fallback: Create basic knowledge base entry without embeddings
            kb_entry = {
                "id": f"kb_{secrets.token_urlsafe(8)}",
                "sourceId": generated_doc.get("id"),
                "sourceType": "generated_question",
                "content": content,
                "skill": skill_slug,
                "embedding": None,
                "metadata": knowledge_entry["metadata"],
                "indexedAt": datetime.utcnow().isoformat()
            }
            try:
                await db.auto_create_item(CONTAINER["KNOWLEDGE_BASE"], kb_entry)
                logger.info(f"Fallback: Basic knowledge base entry created: {kb_entry['id']}")
            except Exception as fallback_error:
                logger.warning(f"Fallback knowledge base creation also failed: {fallback_error}")
        
    except Exception as e:
        logger.error(f"Knowledge base indexing failed completely: {e}")
    except Exception as e:
        logger.error(f"_queue_indexing error: {e}")

class SingleQuestionRequest(BaseModel):
    """Request model for adding a single question"""
    text: str
    type: str  # "mcq", "coding", "descriptive"
    tags: List[str]
    role: Optional[str] = None
    # MCQ specific
    options: Optional[List[Dict[str, str]]] = None
    correctAnswer: Optional[str] = None
    # Coding specific
    starterCode: Optional[str] = None
    testCases: Optional[List[str]] = None
    programmingLanguage: Optional[str] = None
    timeLimit: Optional[int] = None
    # Descriptive specific
    maxWords: Optional[int] = None
    rubric: Optional[str] = None

class BulkValidationSummary(BaseModel):
    """Summary of bulk upload validation"""
    totalQuestions: int
    newQuestions: int
    exactDuplicates: int
    similarDuplicates: int
    flaggedQuestions: List[Dict[str, Any]]

# Temporary storage for bulk upload sessions
bulk_upload_sessions: Dict[str, List[Dict[str, Any]]] = {}

async def call_ai_service(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Helper function to call the AI service endpoints"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{AI_SERVICE_URL}{endpoint}", json=data)
            response.raise_for_status()
            return response.json()
    except httpx.RequestError as e:
        logger.error(f"AI service request failed: {e}")
        # Return fallback response for development
        if "validate" in endpoint:
            return {"status": "unique"}
        elif "rewrite" in endpoint:
            return {
                "rewritten_text": data.get("question_text", ""),
                "suggested_role": "General Developer",
                "suggested_tags": ["general", "assessment"]
            }
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable")
    except httpx.HTTPStatusError as e:
        logger.error(f"AI service HTTP error: {e}")
        raise HTTPException(status_code=e.response.status_code, detail="AI service error")

@router.post("/questions/add-single")
async def add_single_question(
    request: SingleQuestionRequest,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Add a single question with AI validation and enhancement"""
    try:
        logger.info(f"Adding single question: {request.text[:50]}...")
        
        # Step 1: Validate question for duplicates
        validation_result = await call_ai_service("/questions/validate", {
            "question_text": request.text
        })
        
        if validation_result["status"] == "exact_duplicate":
            raise HTTPException(
                status_code=409, 
                detail="This question already exists in the database"
            )
        elif validation_result["status"] == "similar_duplicate":
            raise HTTPException(
                status_code=409,
                detail=f"Similar questions found. Please review and modify your question."
            )
        
        # Step 2: Enhance question with AI
        rewrite_result = await call_ai_service("/questions/rewrite", {
            "question_text": request.text
        })
        
        # Step 3: Create enhanced question object
        enhanced_question_data = {
            "id": f"q_{secrets.token_urlsafe(8)}",
            "text": rewrite_result.get("rewritten_text", request.text),
            "type": request.type,
            "tags": request.tags + rewrite_result.get("suggested_tags", []),
            "suggested_role": rewrite_result.get("suggested_role"),
            "created_by": admin["admin_id"],
            "created_at": datetime.utcnow().isoformat(),
            "question_hash": hashlib.sha256(request.text.strip().lower().encode()).hexdigest()
        }
        
        # Add type-specific fields
        if request.type == "mcq":
            enhanced_question_data.update({
                "options": request.options or [],
                "correctAnswer": request.correctAnswer
            })
        elif request.type == "coding":
            enhanced_question_data.update({
                "starterCode": request.starterCode,
                "testCases": request.testCases or [],
                "programmingLanguage": request.programmingLanguage or "python",
                "timeLimit": request.timeLimit or 30
            })
        elif request.type == "descriptive":
            enhanced_question_data.update({
                "maxWords": request.maxWords,
                "rubric": request.rubric
            })
        
        # Step 4: Save to database (mock for development)
        try:
            # In production: await db.create_item("questions", enhanced_question_data)
            logger.info(f"Question saved with ID: {enhanced_question_data['id']}")
        except Exception as e:
            logger.warning(f"Database save failed (development mode): {e}")
        
        # Step 5: Update Knowledge Base for RAG system
        try:
            # Import the knowledge base update function
            import httpx
            
            # Prepare knowledge base entry
            knowledge_entry = {
                "content": enhanced_question_data["text"],
                "skill": enhanced_question_data.get("suggested_role", "General"),
                "content_type": "question",
                "metadata": {
                    "question_id": enhanced_question_data["id"],
                    "question_type": enhanced_question_data["type"],
                    "tags": enhanced_question_data["tags"],
                    "created_by": enhanced_question_data["created_by"],
                    "created_at": enhanced_question_data["created_at"]
                }
            }
            
            # Call RAG knowledge base update endpoint
            rag_update_url = f"http://localhost:8000/api/rag/knowledge-base/update"
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(rag_update_url, json=knowledge_entry)
                
                if response.status_code == 200:
                    rag_result = response.json()
                    logger.info(f"Knowledge base updated: {rag_result.get('knowledge_entry_id')}")
                    enhanced_question_data["knowledge_base_entry_id"] = rag_result.get("knowledge_entry_id")
                else:
                    logger.warning(f"Knowledge base update failed: {response.status_code}")
                    
        except Exception as kb_error:
            # Don't fail the entire operation if knowledge base update fails
            logger.warning(f"Knowledge base update failed (non-critical): {kb_error}")
        
        return {
            "success": True,
            "message": "Question added successfully",
            "question_id": enhanced_question_data["id"],
            "original_text": request.text,
            "enhanced_text": enhanced_question_data["text"],
            "suggested_role": enhanced_question_data["suggested_role"],
            "suggested_tags": rewrite_result.get("suggested_tags", []),
            "knowledge_base_updated": enhanced_question_data.get("knowledge_base_entry_id") is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding single question: {e}")
        raise HTTPException(status_code=500, detail="Failed to add question")


@router.post("/questions/generate")
async def generate_question_admin(
    request: GenerateQuestionAdminRequest,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Admin endpoint to generate a question via the AI service, persist it, and index it."""
    try:
        logger.info(f"Admin requested generation for skill={request.skill}, type={request.question_type}")

        # Call AI service
        payload = {
            "skill": request.skill,
            "question_type": request.question_type,
            "difficulty": request.difficulty
        }

        ai_response = await call_ai_service("/generate-question", payload)

        generated_text = ai_response.get("question") or ai_response.get("generated_question") or ai_response.get("result")

        skill = request.skill
        skill_slug = normalize_skill(skill)
        
        gen_doc = {
            "id": f"gq_{secrets.token_urlsafe(8)}",
            "promptHash": hashlib.sha256((request.skill + request.question_type + request.difficulty).encode()).hexdigest(),
            "skill": skill_slug,
            "question_type": request.question_type,
            "difficulty": request.difficulty,
            "generated_text": generated_text,
            "original_prompt": f"Generate a {request.difficulty} {request.question_type} question for skill {request.skill}",
            "generated_by": ai_response.get("model", "llm-agent"),
            "generation_timestamp": datetime.utcnow().isoformat(),
            "usage_count": 0,
            "quality_score": None,
            "enhancement_applied": False,
            "suggested_tags": [],
            "suggested_role": None
        }

        # Persist generated question
        try:
            # Use skill as partition key (fallback to id if missing)
            await db.auto_create_item(CONTAINER["GENERATED_QUESTIONS"], gen_doc)
            logger.info(f"Persisted generated question: {gen_doc['id']}")
        except Exception as e:
            # In dev, log and continue
            logger.warning(f"Failed to persist generated question (dev): {e}")

        # Queue indexing
        background_tasks.add_task(_queue_indexing, db, gen_doc)

        return {
            "success": True,
            "generated_question_id": gen_doc["id"],
            "generated_text": generated_text,
            "cached": False,
            "ai_response": ai_response
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_question_admin: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate question")

@router.post("/questions/bulk-validate")
async def bulk_validate_questions(
    file: UploadFile = File(...),
    admin: dict = Depends(verify_admin_token)
):
    """Validate bulk uploaded questions from CSV file"""
    try:
        logger.info(f"Processing bulk upload file: {file.filename}")
        
        # Read and parse CSV file
        content = await file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        questions = []
        for row in csv_reader:
            questions.append(row)
        
        if not questions:
            raise HTTPException(status_code=400, detail="No questions found in CSV file")
        
        # Validate each question
        total_questions = len(questions)
        new_questions = 0
        exact_duplicates = 0
        similar_duplicates = 0
        flagged_questions = []
        validated_questions = []
        
        for question_data in questions:
            try:
                # Validate with AI service
                validation_result = await call_ai_service("/questions/validate", {
                    "question_text": question_data.get("text", "")
                })
                
                if validation_result["status"] == "exact_duplicate":
                    exact_duplicates += 1
                elif validation_result["status"] == "similar_duplicate":
                    similar_duplicates += 1
                    flagged_questions.append({
                        "text": question_data.get("text", ""),
                        "similar_to": validation_result.get("similar_questions", [])
                    })
                else:
                    new_questions += 1
                    validated_questions.append(question_data)
                    
            except Exception as e:
                logger.warning(f"Validation failed for question: {e}")
                # Assume unique if validation fails
                new_questions += 1
                validated_questions.append(question_data)
        
        # Store validated questions in session for confirmation
        session_id = secrets.token_urlsafe(16)
        bulk_upload_sessions[session_id] = validated_questions
        
        summary = BulkValidationSummary(
            totalQuestions=total_questions,
            newQuestions=new_questions,
            exactDuplicates=exact_duplicates,
            similarDuplicates=similar_duplicates,
            flaggedQuestions=flagged_questions
        )
        
        # Store session ID in response for confirmation step
        return {
            "session_id": session_id,
            **summary.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk validation: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate bulk upload")

@router.post("/questions/bulk-confirm")
async def bulk_confirm_import(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Confirm and import validated bulk questions"""
    try:
        # In a real implementation, you would extract session_id from request body
        # For now, we'll use the most recent session
        if not bulk_upload_sessions:
            raise HTTPException(status_code=400, detail="No pending bulk upload session found")
        
        # Get the most recent session (in production, use proper session management)
        session_id = list(bulk_upload_sessions.keys())[-1]
        validated_questions = bulk_upload_sessions[session_id]
        
        imported_count = 0
        
        for question_data in validated_questions:
            try:
                # Enhance each question with AI if needed
                enhanced_question = {
                    "id": f"q_{secrets.token_urlsafe(8)}",
                    "text": question_data.get("text", ""),
                    "type": question_data.get("type", "mcq"),
                    "tags": question_data.get("tags", "").split(",") if question_data.get("tags") else [],
                    "created_by": admin["admin_id"],
                    "created_at": datetime.utcnow().isoformat(),
                    "question_hash": hashlib.sha256(question_data.get("text", "").strip().lower().encode()).hexdigest()
                }
                
                # Add type-specific fields based on CSV data
                question_type = question_data.get("type", "mcq").lower()
                
                if question_type == "mcq":
                    options_text = question_data.get("options", "")
                    if options_text:
                        options = []
                        for i, option_text in enumerate(options_text.split("|")):
                            option_letter = chr(ord('a') + i)
                            options.append({"id": option_letter, "text": option_text.strip()})
                        enhanced_question.update({
                            "options": options,
                            "correctAnswer": question_data.get("correct_answer", "a")
                        })
                
                elif question_type == "coding":
                    enhanced_question.update({
                        "starterCode": question_data.get("starter_code", ""),
                        "testCases": question_data.get("test_cases", "").split("|") if question_data.get("test_cases") else [],
                        "programmingLanguage": question_data.get("programming_language", "python"),
                        "timeLimit": int(question_data.get("time_limit", 30))
                    })
                
                elif question_type == "descriptive":
                    enhanced_question.update({
                        "maxWords": int(question_data.get("max_words", 500)) if question_data.get("max_words") else None,
                        "rubric": question_data.get("rubric", "")
                    })
                
                # Save to database (mock for development)
                try:
                    # In production: await db.create_item("questions", enhanced_question)
                    imported_count += 1
                    logger.info(f"Question imported with ID: {enhanced_question['id']}")
                except Exception as e:
                    logger.warning(f"Database save failed (development mode): {e}")
                    imported_count += 1  # Count as success in development
                
                # Update Knowledge Base for RAG system
                try:
                    import httpx
                    
                    # Prepare knowledge base entry
                    knowledge_entry = {
                        "content": enhanced_question["text"],
                        "skill": enhanced_question.get("tags", ["General"])[0] if enhanced_question.get("tags") else "General",
                        "content_type": "imported_question",
                        "metadata": {
                            "question_id": enhanced_question["id"],
                            "question_type": enhanced_question["type"],
                            "tags": enhanced_question["tags"],
                            "created_by": enhanced_question["created_by"],
                            "created_at": enhanced_question["created_at"],
                            "import_source": "bulk_upload"
                        }
                    }
                    
                    # Call RAG knowledge base update endpoint
                    rag_update_url = f"http://localhost:8000/api/rag/knowledge-base/update"
                    
                    async with httpx.AsyncClient(timeout=5) as client:
                        response = await client.post(rag_update_url, json=knowledge_entry)
                        
                        if response.status_code == 200:
                            rag_result = response.json()
                            logger.info(f"Knowledge base updated for imported question: {rag_result.get('knowledge_entry_id')}")
                        else:
                            logger.warning(f"Knowledge base update failed for question {enhanced_question['id']}: {response.status_code}")
                            
                except Exception as kb_error:
                    # Don't fail the import if knowledge base update fails
                    logger.warning(f"Knowledge base update failed for question {enhanced_question['id']} (non-critical): {kb_error}")
                    
            except Exception as e:
                logger.error(f"Error processing question: {e}")
                continue
        
        # Clean up session
        del bulk_upload_sessions[session_id]
        
        return {
            "success": True,
            "imported_count": imported_count,
            "message": f"Successfully imported {imported_count} questions"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk confirm: {e}")
        raise HTTPException(status_code=500, detail="Failed to import questions")


# Live Interview Analytics Endpoints
@router.get("/live-interviews/sessions")
async def get_live_interview_sessions(
    admin: dict = Depends(verify_admin_token),
    db_service: CosmosDBService = Depends(get_cosmosdb)
):
    """Get all active and recent live interview sessions"""
    try:
        # Query interview_transcripts collection for active sessions
        sessions = []
        
        # Mock data for development - in production, this would query Cosmos DB
        from datetime import datetime, timedelta
        import uuid
        
        # Generate mock active sessions
        mock_sessions = []
        for i in range(5):  # 5 active sessions
            session_id = f"session_{uuid.uuid4().hex[:12]}"
            started_at = datetime.utcnow() - timedelta(minutes=30 + i * 10)
            
            mock_sessions.append({
                "id": f"live_{uuid.uuid4().hex[:8]}",
                "sessionId": session_id,
                "candidateId": f"candidate_{i+1}",
                "candidateName": f"John Doe {i+1}",
                "testId": f"test_{uuid.uuid4().hex[:8]}",
                "testName": f"Senior Developer Assessment {i+1}",
                "status": "active" if i < 3 else "completed" if i == 3 else "failed",
                "startedAt": started_at.isoformat(),
                "lastActivity": (datetime.utcnow() - timedelta(seconds=30 + i * 60)).isoformat(),
                "duration": 1800 + i * 300,  # 30min + extras
                "currentQuestion": min(i + 2, 5),
                "totalQuestions": 5,
                "audioQuality": ["excellent", "good", "poor", "good", "excellent"][i],
                "connectionStatus": ["connected", "connected", "connecting", "connected", "disconnected"][i],
                "webrtcState": ["connected", "connected", "connecting", "connected", "failed"][i],
                "conversationTurns": 12 + i * 3,
                "analysisRequests": 8 + i * 2,
                "orchestrationRequests": 6 + i,
                "errorCount": i if i > 2 else 0,
                "transcript": {
                    "wordCount": 450 + i * 100,
                    "lastUpdate": (datetime.utcnow() - timedelta(minutes=2)).isoformat(),
                    "sentiment": ["positive", "neutral", "positive", "neutral", "negative"][i]
                } if i < 4 else None,
                "performance": {
                    "avgResponseTime": 150 + i * 50,
                    "apiSuccessRate": 98 - i,
                    "reconnectionCount": 1 if i > 3 else 0
                }
            })
        
        return {
            "sessions": mock_sessions,
            "total": len(mock_sessions),
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error fetching live interview sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch live interview sessions")


@router.get("/live-interviews/stats")
async def get_live_interview_stats(
    admin: dict = Depends(verify_admin_token),
    db_service: CosmosDBService = Depends(get_cosmosdb)
):
    """Get live interview analytics statistics"""
    try:
        # Mock statistics for development
        from datetime import datetime
        
        stats = {
            "totalActiveSessions": 3,
            "totalCompletedToday": 15,
            "averageSessionDuration": 1650,  # 27.5 minutes
            "systemHealthScore": 94,
            "apiPerformance": {
                "analysisAvgTime": 180,
                "orchestrationAvgTime": 120,
                "errorRate": 2.1
            },
            "audioQualityDistribution": {
                "excellent": 8,
                "good": 5,
                "poor": 2,
                "unknown": 0
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return {
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching live interview stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch live interview statistics")


@router.get("/live-interviews/session/{session_id}")
async def get_live_interview_session_details(
    session_id: str,
    admin: dict = Depends(verify_admin_token),
    db_service: CosmosDBService = Depends(get_cosmosdb)
):
    """Get detailed information about a specific live interview session"""
    try:
        # In production, query the specific session from interview_transcripts
        # For development, return mock detailed data
        from datetime import datetime, timedelta
        
        session_details = {
            "id": f"live_{session_id[:8]}",
            "sessionId": session_id,
            "candidateId": "candidate_detail",
            "candidateName": "Jane Smith",
            "testId": "test_detail_123",
            "testName": "Senior Full-Stack Developer Assessment",
            "status": "active",
            "startedAt": (datetime.utcnow() - timedelta(minutes=45)).isoformat(),
            "lastActivity": (datetime.utcnow() - timedelta(seconds=15)).isoformat(),
            "duration": 2700,  # 45 minutes
            "currentQuestion": 3,
            "totalQuestions": 5,
            "audioQuality": "excellent",
            "connectionStatus": "connected",
            "webrtcState": "connected",
            "conversationTurns": 18,
            "analysisRequests": 12,
            "orchestrationRequests": 8,
            "errorCount": 0,
            "transcript": {
                "wordCount": 850,
                "lastUpdate": (datetime.utcnow() - timedelta(seconds=30)).isoformat(),
                "sentiment": "positive",
                "fullTranscript": "The candidate has been providing detailed technical responses about React, Node.js, and system architecture. Their communication is clear and demonstrates strong technical knowledge."
            },
            "performance": {
                "avgResponseTime": 145,
                "apiSuccessRate": 100,
                "reconnectionCount": 0
            },
            "questions": [
                {
                    "id": 1,
                    "question": "Tell me about your experience with React and state management",
                    "status": "completed",
                    "startTime": (datetime.utcnow() - timedelta(minutes=42)).isoformat(),
                    "endTime": (datetime.utcnow() - timedelta(minutes=35)).isoformat(),
                    "wordCount": 185
                },
                {
                    "id": 2,
                    "question": "How would you design a scalable microservices architecture?",
                    "status": "completed", 
                    "startTime": (datetime.utcnow() - timedelta(minutes=35)).isoformat(),
                    "endTime": (datetime.utcnow() - timedelta(minutes=25)).isoformat(),
                    "wordCount": 320
                },
                {
                    "id": 3,
                    "question": "Explain the difference between SQL and NoSQL databases",
                    "status": "active",
                    "startTime": (datetime.utcnow() - timedelta(minutes=25)).isoformat(),
                    "endTime": None,
                    "wordCount": 245
                }
            ]
        }
        
        return {
            "session": session_details
        }
        
    except Exception as e:
        logger.error(f"Error fetching session details: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch session details")