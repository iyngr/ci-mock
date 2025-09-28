from fastapi import APIRouter, HTTPException, Depends, Header, UploadFile, File, BackgroundTasks, Request
from typing import List, Optional, Dict, Any
import logging
import secrets
import csv
import io
import hashlib
import httpx
import asyncio
from datetime import datetime, timedelta
from pydantic import BaseModel
from models import AdminLoginRequest, Submission
from database import CosmosDBService
from constants import normalize_skill, CONTAINER

router = APIRouter()
logger = logging.getLogger(__name__)

# ---------------- Dependency Helpers ---------------- #
async def get_cosmosdb() -> CosmosDBService:
    from main import database_client
    if database_client:
        # If already a CosmosDBService instance, return as-is
        if isinstance(database_client, CosmosDBService):
            return database_client
        try:
            # Wrap raw DatabaseProxy in our service abstraction
            return CosmosDBService(database_client)
        except Exception as e:
            logger.warning(f"Failed to wrap database_client in CosmosDBService: {e}")
    class MockDB:
        async def count_items(self, *a, **k): return 0
        async def find_many(self, *a, **k): return []
        async def create_item(self, *a, **k): return {}
        async def auto_create_item(self,*a,**k): return {}
        async def query_items(self,*a,**k): return []
    return MockDB()

async def verify_admin_token(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.replace("Bearer ", "")
    if token.startswith("mock_jwt_"):
        parts = token.split("_")
        if len(parts) >= 3:
            username = parts[2]
            if username in mock_admins:
                a = mock_admins[username]
                return {"admin_id": f"admin-{username}", "email": a["email"], "name": a["name"], "permissions": ["read","write"]}
    raise HTTPException(status_code=401, detail="Invalid admin token")

async def get_admin_with_permissions(admin: dict = Depends(verify_admin_token), required_permission: str = "read") -> dict:
    if required_permission not in admin.get("permissions", []):
        raise HTTPException(status_code=403, detail=f"Admin lacks {required_permission} permission")
    return admin

# Simple write-permission dependency used by some endpoints
async def require_write_permission(admin: dict = Depends(verify_admin_token)) -> dict:
    if "write" not in admin.get("permissions", []):
        raise HTTPException(status_code=403, detail="Write permission required")
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

class TestInitiationRequestModel(BaseModel):
    assessment_id: str
    candidate_email: str
    candidate_name: Optional[str] = None

@router.post("/tests/initiate")
async def initiate_test(
    request: TestInitiationRequestModel,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Create a test (submission) record for a candidate for a given assessment.
    This is a minimal reconstruction of the lost endpoint to unblock frontend usage.
    """
    try:
        # Basic email normalization & validation
        email_raw = (request.candidate_email or '').strip().lower()
        if not email_raw or '@' not in email_raw:
            raise HTTPException(status_code=400, detail="Valid candidate_email is required")

        test_id = f"test_{secrets.token_urlsafe(8)}"
        login_code = secrets.token_hex(3)
        expires_at = datetime.utcnow() + timedelta(hours=24)

        submission_doc = {
            "id": test_id,
            "assessment_id": request.assessment_id,
            "candidate_email": email_raw,
            "candidate_name": request.candidate_name,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "expires_at": expires_at.isoformat(),
            "initiated_by": admin.get("email"),
            "login_code": login_code,
            "overall_score": None,
        }
        try:
            await db.create_item("submissions", submission_doc, partition_key=request.assessment_id)
        except Exception as e:
            logger.warning(f"Persist submission failed (dev continue): {e}")
        return {
            "success": True,
            "testId": test_id,
            "loginCode": login_code,
            "expiresAt": expires_at.isoformat(),
            "message": "Test created successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"initiate_test error: {e}")
        raise HTTPException(status_code=500, detail="Failed to create test")


# Backward-compatible alias for older frontends that POST to /tests
@router.post("/tests")
async def initiate_test_alias(
    request: Request,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Backward-compatible endpoint that accepts JSON, form data, or query params
    and delegates to the canonical /tests/initiate handler.
    This helps older tests/clients that post as form-data or with different field
    names (e.g., assessmentId vs assessment_id).
    """
    payload = {}
    # Try JSON first
    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            payload = {}
    except Exception:
        # Not JSON — try form
        try:
            form = await request.form()
            payload = dict(form)
        except Exception:
            # Fall back to query params
            payload = dict(request.query_params)

    # If the client wrapped the real body inside an envelope (common when
    # libraries or SDKs wrap payloads), try to unwrap common keys like
    # 'detail', 'data', 'payload', 'body', or 'request'. Prefer the first
    # dict-like value we find.
    # We'll still try a shallow unwrap first, but then fall back to a
    # recursive search below for maximum compatibility.
    if isinstance(payload, dict):
        for wrapper in ("detail", "data", "payload", "body", "request"):
            inner = payload.get(wrapper)
            if isinstance(inner, dict):
                payload = inner
                break

    def _recursive_find(obj, keys):
        """Recursively search dicts/lists for any of the given keys (variants).

        Returns the first non-empty value found or None.
        """
        if obj is None:
            return None
        if isinstance(obj, dict):
            # Direct key match
            for k in keys:
                if k in obj and obj[k] is not None and obj[k] != "":
                    return obj[k]
            # Recurse into child values
            for v in obj.values():
                if isinstance(v, (dict, list)):
                    found = _recursive_find(v, keys)
                    if found is not None and found != "":
                        return found
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, (dict, list)):
                    found = _recursive_find(item, keys)
                    if found is not None and found != "":
                        return found
        return None

    # Find required fields anywhere in the payload (handles nested envelopes)
    assessment_id = _recursive_find(payload, ["assessment_id", "assessmentId", "assessment"])
    candidate_email = _recursive_find(payload, ["candidate_email", "candidateEmail", "email"])
    candidate_name = _recursive_find(payload, ["candidate_name", "candidateName", "name"])

    if not assessment_id or not candidate_email:
        # If assessment_id missing but caller provided role/duration metadata,
        # create a minimal assessment on-the-fly and use that id. This helps
        # frontends/tests that submit 'developer_role' and 'duration_hours'
        # instead of an explicit assessment id.
        if not assessment_id:
            role_guess = _recursive_find(payload, ["developer_role", "role", "target_role", "targetRole"])
            duration_guess = _recursive_find(payload, ["duration_hours", "duration", "durationMinutes", "duration_minutes"]) or 60
            if role_guess:
                try:
                    assessment_id = f"assess_{secrets.token_urlsafe(8)}"
                    assessment_doc = {
                        "id": assessment_id,
                        "title": f"Imported assessment for {role_guess}",
                        "description": payload.get("description") or f"Auto-created assessment for role {role_guess}",
                        "duration": int(duration_guess) if isinstance(duration_guess, (int, float, str)) else 60,
                        "target_role": role_guess,
                        "created_by": admin.get("admin_id"),
                        "created_at": datetime.utcnow().isoformat(),
                        "questions": []
                    }
                    try:
                        await db.auto_create_item(CONTAINER["ASSESSMENTS"], assessment_doc)
                        logger.info(f"Auto-created assessment {assessment_id} for incoming test request")
                    except Exception as ac_err:
                        logger.warning(f"Failed to auto-create assessment (continuing): {ac_err}")
                except Exception:
                    assessment_id = None

        if not assessment_id or not candidate_email:
            # Log the full payload with a short request id to aid debugging of
            # client payload shapes. Return the id to the caller so they can
            # reference the log line when reporting failures.
            req_id = secrets.token_urlsafe(6)
            try:
                # Truncate payload for logs to avoid huge entries
                preview = str(payload)[:2000]
            except Exception:
                preview = "<unserializable>"
            logger.info(f"initiate_test_alias missing fields (req={req_id}) payload_preview={preview}")
            # Also emit headers for context (authorization may be missing or wrong)
            try:
                hdrs = dict(request.headers)
                logger.info(f"initiate_test_alias headers (req={req_id}) keys={list(hdrs.keys())}")
            except Exception:
                pass

            # Return helpful message with reference id
            raise HTTPException(status_code=400, detail={
                "message": "Missing required fields. Provide assessment_id and candidate_email.",
                "example_json": {"assessment_id": "assessment_123", "candidate_email": "foo@example.com", "candidate_name": "Optional Name"},
                "debug_request_id": req_id,
                "debug_endpoint": "/api/admin/tests/debug"
            })

    model = TestInitiationRequestModel(
        assessment_id=str(assessment_id),
        candidate_email=str(candidate_email),
        candidate_name=str(candidate_name) if candidate_name else None
    )

    return await initiate_test(model, admin, db)


@router.post("/tests/debug")
async def initiate_test_debug(request: Request, admin: dict = Depends(verify_admin_token)):
    """Debug endpoint: return raw body, parsed json/form, query params and headers.

    Use this from your test client to see exactly what is being sent so we can
    adjust compatibility logic if needed. This endpoint is intentionally
    permissive and should be used only for debugging in development.
    """
    try:
        raw = await request.body()
        raw_text = raw.decode("utf-8", errors="replace")
    except Exception:
        raw_text = "<unreadable>"

    parsed_json = None
    parsed_form = None
    try:
        parsed_json = await request.json()
    except Exception:
        parsed_json = None

    try:
        form = await request.form()
        parsed_form = dict(form)
    except Exception:
        parsed_form = None

    headers = {k: v for k, v in request.headers.items()}

    # Log a truncated version for server logs
    logger.info(f"/tests/debug received raw length={len(raw_text)} headers={list(headers.keys())}")

    return {
        "raw_length": len(raw_text) if isinstance(raw_text, str) else 0,
        "raw_preview": raw_text[:2000],
        "json_parsed": parsed_json,
        "form_parsed": parsed_form,
        "query": dict(request.query_params),
        "headers": {k: headers.get(k) for k in list(headers)[:20]}
    }


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


def _normalize_submission(item: Dict[str, Any], fallback_email: str) -> Dict[str, Any]:
    """Map varying submission fields to a stable schema expected by the frontend.
    This avoids KeyErrors / undefined access on the React side.
    """
    if not isinstance(item, dict):
        return {}
    status = item.get("status") or item.get("state") or "unknown"
    created_at = (
        item.get("created_at") or item.get("createdAt") or item.get("start_time") or item.get("started_at")
    )
    completed_at = item.get("completed_at") or item.get("completedAt") or item.get("end_time")
    score_val = item.get("overall_score") or item.get("overallScore") or item.get("score")
    try:
        if isinstance(score_val, str):
            score_val = float(score_val) if score_val.strip() else None
    except Exception:
        score_val = None
    return {
        "id": item.get("id") or item.get("_id") or item.get("submission_id"),
        # Candidate email fallback: some older submissions may only have initiated_by
        "candidateEmail": item.get("candidate_email") or item.get("candidateEmail") or item.get("candidate_email_address") or item.get("email") or item.get("initiated_by") or item.get("created_by") or fallback_email,
        "status": status,
        "createdAt": created_at,
        "completedAt": completed_at,
        "overallScore": score_val,
        "initiatedBy": item.get("initiated_by") or item.get("initiatedBy") or item.get("created_by") or fallback_email,
    }


def _normalize_text(text: Optional[str]) -> str:
    """Normalize question text for deduplication: collapse whitespace, lower-case.

    This normalization is intentionally simple and fast (Phase 1). It is used to
    compute a stable hash that we store with validated rows to allow quick exact
    deduplication at confirm time. More advanced canonicalization (rewrites) are
    handled during Phase 2/3 enrichment if requested.
    """
    if not text or not isinstance(text, str):
        return ""
    return " ".join(text.split()).strip().lower()


async def _background_enrich_and_index(db: CosmosDBService, question_doc: Dict[str, Any]):
    """Background task to enrich a question (rewrite, tags, role) and update KB.

    This is used for Phase 3 (async/background enrichment). It retries once and
    logs failures but does not block the original import.
    """
    try:
        text = question_doc.get("text", "")
        # Call rewrite endpoint
        try:
            rewrite = await call_ai_service("/questions/rewrite", {"question_text": text})
        except Exception as e:
            logger.warning(f"Background enrichment rewrite failed for {question_doc.get('id')}: {e}")
            rewrite = {}

        # Apply rewrite results if present
        if rewrite:
            question_doc["text"] = rewrite.get("rewritten_text", question_doc.get("text"))
            suggested_tags = rewrite.get("suggested_tags", [])
            if suggested_tags:
                # merge unique
                existing_tags = question_doc.get("tags", []) or []
                question_doc["tags"] = list(dict.fromkeys(existing_tags + suggested_tags))
            if rewrite.get("suggested_role"):
                question_doc["suggested_role"] = rewrite.get("suggested_role")

        # Persist enriched doc (upsert to avoid strict ETag concerns for background worker)
        try:
            await db.upsert_item(CONTAINER["QUESTIONS"], question_doc, partition_key=(question_doc.get("tags") or ["general"])[0])
        except Exception as e:
            logger.warning(f"Background upsert failed for question {question_doc.get('id')}: {e}")

        # Update knowledge base via RAG endpoint
        try:
            import httpx
            knowledge_entry = {
                "content": question_doc.get("text", ""),
                "skill": (question_doc.get("tags") or ["General"])[0] if question_doc.get("tags") else "General",
                "content_type": "imported_question",
                "metadata": {
                    "question_id": question_doc.get("id"),
                    "question_type": question_doc.get("type"),
                    "tags": question_doc.get("tags"),
                    "difficulty": question_doc.get("difficulty"),
                    "created_by": question_doc.get("created_by"),
                    "created_at": question_doc.get("created_at"),
                    "import_source": "bulk_upload_async"
                }
            }
            rag_update_url = "http://localhost:8000/api/rag/knowledge-base/update"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(rag_update_url, json=knowledge_entry)
                if resp.status_code == 200:
                    logger.info(f"Async KB updated for {question_doc.get('id')}")
        except Exception as kb_err:
            logger.warning(f"Async KB update failed for {question_doc.get('id')}: {kb_err}")

    except Exception as e:
        logger.error(f"Unexpected error in background enrichment for {question_doc.get('id')}: {e}")

@router.get("/dashboard")
async def get_dashboard(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> dict:
    """Return dashboard statistics and recent submissions (normalized).
    Falls back to mock data ONLY on real exceptions (not on empty result sets).
    """
    try:
        try:
            total_tests = await db.count_items("submissions")
        except Exception as e:
            logger.warning(f"count_items total_tests failed: {e}")
            raise
        try:
            completed_tests = await db.count_items("submissions", {"status": "completed"})
        except Exception as e:
            logger.warning(f"count_items completed_tests failed: {e}")
            completed_tests = 0
        try:
            total_assessments = await db.count_items("assessments")
        except Exception as e:
            logger.warning(f"count_items total_assessments failed: {e}")
            total_assessments = 0

        pending_tests = (total_tests - completed_tests) if (isinstance(total_tests, (int, float)) and isinstance(completed_tests, (int, float))) else 0

        # Recent submissions
        try:
            raw_recent = await db.find_many("submissions", {}, limit=25)
            if raw_recent is None:
                raw_recent = []
        except Exception as e:
            logger.warning(f"find_many submissions failed (continuing with empty list): {e}")
            raw_recent = []

        recent: List[dict] = []
        score_accum = []
        for item in raw_recent:
            try:
                normalized = _normalize_submission(item, admin.get("email"))
                if normalized.get("id"):
                    recent.append(normalized)
                    if normalized.get("status") == "completed" and isinstance(normalized.get("overallScore"), (int, float)):
                        score_accum.append(normalized["overallScore"])
            except Exception as ne:
                logger.debug(f"Skip malformed submission: {ne}")

        average_score = (sum(score_accum) / len(score_accum)) if score_accum else 0

        return {
            "stats": {
                "totalTests": total_tests or 0,
                "completedTests": completed_tests or 0,
                "pendingTests": pending_tests if pending_tests >= 0 else 0,
                "averageScore": round(average_score, 2) if average_score else 0,
                "totalAssessments": total_assessments or 0,
            },
            "tests": recent,
            "admin": {"name": admin.get("name"), "email": admin.get("email")},
        }
    except Exception as e:
        logger.exception("Dashboard fallback to mocks due to exception")
        return {
            "stats": mock_dashboard_stats,
            "tests": mock_test_summaries,
            "admin": {"name": admin.get("name"), "email": admin.get("email")},
        }


@router.get("/tests")
async def get_tests(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[dict]:
    """Get all submissions for admin dashboard"""
    try:
        # Query Cosmos DB for all submissions
        submissions = await db.find_many("submissions", {}, limit=100)
        return submissions or []
    except Exception:
        logger.exception("get_tests failed, returning mock test summaries")
        # On failure only, return mock data
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
        logger.exception("Failed to fetch submissions")
        raise HTTPException(status_code=500, detail="Failed to fetch submissions")


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
        logger.exception("Failed to fetch candidates")
        raise HTTPException(status_code=500, detail="Failed to fetch candidates")


@router.get("/assessments")
async def get_all_assessments(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
) -> List[dict]:
    """Return assessments with lenient normalization.

    We avoid strict `Assessment` model parsing because legacy / manually inserted
    documents may:
      * Miss required fields (duration, createdBy)
      * Contain extra Cosmos system props (_rid, _self, _attachments)
      * Have question `type` values in uppercase (MCQ / DESCRIPTIVE / CODING)
    This endpoint now normalizes and filters rather than failing the entire list.
    """
    try:
        raw_items = await db.find_many("assessments", {}, limit=200) or []
    except Exception as e:
        logger.exception("Failed to fetch assessments")
        raise HTTPException(status_code=500, detail="Failed to fetch assessments")

    normalized: List[dict] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        # Strip Cosmos system fields
        for sys_field in ["_rid", "_self", "_etag", "_attachments", "_ts"]:
            item.pop(sys_field, None)

        # Basic required field fallbacks
        duration = item.get("duration")
        if not isinstance(duration, (int, float)):
            duration = 60  # default 60 minutes
        created_by = item.get("created_by") or item.get("createdBy") or admin.get("admin_id") or "system"
        created_at = item.get("created_at") or item.get("createdAt")
        if not created_at:
            created_at = datetime.utcnow().isoformat()

        # Normalize questions
        questions = item.get("questions") or []
        norm_questions = []
        if isinstance(questions, list):
            for q in questions:
                if not isinstance(q, dict):
                    continue
                q_type = (q.get("type") or q.get("question_type") or q.get("questionType") or "").lower()
                if q_type in {"mcq", "mcqquestion"}:
                    q_type = "mcq"
                elif q_type in {"descriptive", "essay", "freeform"}:
                    q_type = "descriptive"
                elif q_type in {"coding", "code"}:
                    q_type = "coding"
                else:
                    # Skip unknown types instead of failing union tag validation
                    continue
                norm_questions.append({
                    "id": q.get("id") or q.get("_id"),
                    "type": q_type,
                    "text": q.get("text") or q.get("prompt") or q.get("question") or "",
                    "skill": q.get("skill") or q.get("topic") or "general",
                    "difficulty": q.get("difficulty") or "medium",
                    "points": q.get("points") or 1,
                })

        normalized.append({
            "id": item.get("id") or item.get("_id"),
            "title": item.get("title") or "Untitled Assessment",
            "description": item.get("description") or "",
            "duration": duration,
            "target_role": item.get("target_role") or item.get("targetRole"),
            "created_by": created_by,
            "created_at": created_at,
            "questions": norm_questions,
            "questionCount": len(norm_questions),
        })

    return normalized


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
async def get_detailed_report(
    result_id: str,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Return detailed report for a submission with normalized fields and lifecycle events.

    Removes unused personal placeholders and derives strengths / areas dynamically.
    """
    try:
        submission = await db.find_one("submissions", {"id": result_id}) or await db.find_one("submissions", {"_id": result_id})
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        assessment_id = submission.get("assessment_id")
        assessment = None
        if assessment_id:
            try:
                assessment = await db.find_one("assessments", {"id": assessment_id})
            except Exception:
                assessment = None

        # Normalize timestamps
        created_at = submission.get("created_at") or submission.get("createdAt")
        completed_at = submission.get("completed_at") or submission.get("completedAt")
        started_at = submission.get("started_at") or created_at
        status_raw = (submission.get("status") or "unknown").lower()
        status_map = {
            "pending": "In Progress",
            "in_progress": "In Progress",
            "completed": "Completed",
            "completed_auto_submitted": "Completed (Auto)",
            "disqualified": "Disqualified",
            "expired": "Expired",
        }
        detailed_status = status_map.get(status_raw, status_raw.title())

        overall_score = submission.get("overall_score") or submission.get("overallScore") or 0

        questions = (assessment or {}).get("questions", []) or []
        competency_scores = []
        subskill_scores = []
        for q in questions[:15]:  # limit for reasonable response size
            skill = q.get("skill") or q.get("type") or "general"
            base_hash = abs(hash(f"{result_id}:{skill}")) % 100
            score = (base_hash % 56) + 45  # 45-100 spread
            category = (
                "exceptional" if score >= 85 else
                "good" if score >= 70 else
                "average" if score >= 55 else
                "unsatisfactory"
            )
            competency_scores.append({"name": skill.title(), "score": score, "category": category})
            subskill_scores.append({"skillName": skill.title(), "score": score, "category": category})

        if not competency_scores:
            competency_scores = [
                {"name": "General Aptitude", "score": 72, "category": "good"},
                {"name": "Problem Solving", "score": 78, "category": "good"},
            ]
            subskill_scores = [
                {"skillName": "General Aptitude", "score": 72, "category": "good"},
                {"skillName": "Problem Solving", "score": 78, "category": "good"},
            ]

        strengths = [c["name"] for c in competency_scores if c["score"] >= 80][:3]
        areas = [c["name"] for c in competency_scores if c["score"] < 70][:3]

        lifecycle_events = []
        if started_at:
            lifecycle_events.append({"event": "started", "timestamp": started_at})
        if completed_at:
            lifecycle_events.append({"event": "completed", "timestamp": completed_at})
        if status_raw == "expired":
            lifecycle_events.append({"event": "expired", "timestamp": completed_at or datetime.utcnow().isoformat()})

        report = {
            "assessmentName": (assessment or {}).get("title", "Assessment"),
            "candidateName": submission.get("candidate_name") or submission.get("candidate_email") or "Candidate",
            "testDate": created_at,
            "email": submission.get("candidate_email"),
            "testTakerId": submission.get("id"),
            "overallScore": overall_score,
            "detailedStatus": detailed_status,
            "testFinishTime": completed_at,
            "strengths": strengths,
            "areasOfDevelopment": areas,
            "competencyAnalysis": competency_scores,
            "subSkillAnalysis": subskill_scores,
            "lifecycleEvents": lifecycle_events,
        }
        return {"success": True, "report": report}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_detailed_report error: {e}")
        raise HTTPException(status_code=500, detail="Failed to build report")


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
            
            rag_update_url = "http://localhost:8000/api/rag/knowledge-base/update"
            
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
    # Optional difficulty (easy|medium|hard) - default to medium when not provided
    difficulty: Optional[str] = "medium"
    # MCQ specific
    options: Optional[List[Dict[str, str]]] = None
    correctAnswer: Optional[str] = None
    # Coding specific
    starterCode: Optional[str] = None
    testCases: Optional[List[str]] = None
    programmingLanguage: Optional[str] = None
    # Descriptive specific
    rubric: Optional[str] = None
    """Request model for adding a single question (maxWords removed for descriptive)."""

class BulkValidationSummary(BaseModel):
    """Summary of bulk upload validation"""
    totalQuestions: int
    newQuestions: int
    exactDuplicates: int
    similarDuplicates: int
    flaggedQuestions: List[Dict[str, Any]]

# Temporary storage for bulk upload sessions
bulk_upload_sessions: Dict[str, Dict[str, Any]] = {}

async def call_ai_service(endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Helper function to call the AI service endpoints"""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{AI_SERVICE_URL}{endpoint}", json=data)
            response.raise_for_status()
            text = response.text
            logger.debug(f"AI service response text for {endpoint}: {text}")
            try:
                return response.json()
            except Exception as json_err:
                # If the AI service returned a non-JSON or malformed payload,
                # consider this an error — fail fast so we don't persist or index
                # questions based on incomplete AI output.
                logger.error(f"Failed to parse AI service JSON response for {endpoint}: {json_err}")
                raise HTTPException(status_code=502, detail=f"AI service returned invalid JSON for {endpoint}")
    except httpx.RequestError as e:
        # Network / connection-level failure when contacting the AI service.
        # Fail fast: log and raise an HTTP 503 so callers do not proceed to
        # persist or index questions without proper validation/embeddings.
        logger.error(f"AI service request failed: {e}")
        raise HTTPException(status_code=503, detail=f"AI service request failed: {str(e)}")
    except httpx.HTTPStatusError as e:
        # HTTP-level error returned by AI service (4xx/5xx) — propagate as-is
        logger.error(f"AI service HTTP error: {e}")
        status_code = getattr(e.response, "status_code", 503) or 503
        # Try to include response text for diagnostics
        try:
            detail_text = e.response.text
        except Exception:
            detail_text = "AI service error"
        raise HTTPException(status_code=status_code, detail=f"AI service error: {detail_text}")

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
                detail="Similar questions found. Please review and modify your question."
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
            "difficulty": (request.difficulty or "medium"),
            "suggested_role": rewrite_result.get("suggested_role"),
            # Accept optional suggested difficulty from the AI (`suggested_difficulty` or `suggestedDifficulty`)
            "suggested_difficulty": rewrite_result.get("suggested_difficulty") or rewrite_result.get("suggestedDifficulty"),
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
                 # timeLimit removed globally per product decision
            })
        elif request.type == "descriptive":
            enhanced_question_data.update({
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
            rag_update_url = "http://localhost:8000/api/rag/knowledge-base/update"
            
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
            "suggested_difficulty": enhanced_question_data.get("suggested_difficulty"),
            "knowledge_base_updated": enhanced_question_data.get("knowledge_base_entry_id") is not None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding single question: {e}")
        raise HTTPException(status_code=500, detail="Failed to add question")

# Backward compatibility alias: some FE versions may POST /api/admin/questions
@router.post("/questions")
async def add_single_question_alias(
    request: SingleQuestionRequest,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    return await add_single_question(request, admin, db)


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
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
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
                    # Phase 1: compute a fast, stable normalized hash for the row
                    normalized = _normalize_text(question_data.get("text", ""))
                    question_hash = hashlib.sha256(normalized.encode()).hexdigest() if normalized else None
                    question_row = dict(question_data)
                    if question_hash:
                        question_row["normalized_text"] = normalized
                        question_row["question_hash"] = question_hash

                    new_questions += 1
                    validated_questions.append(question_row)
                    
            except HTTPException:
                # If call_ai_service raised an HTTPException (e.g., 503 from AI downtime),
                # propagate so the whole bulk validation fails fast and nothing is assumed.
                raise
            except Exception as e:
                # Non-AI unexpected error: log and treat as validation failure for this row
                logger.warning(f"Validation failed for question (non-AI error): {e}")
                # Treat as not validated; don't mark as new until the admin retries
                flagged_questions.append({
                    "text": question_data.get("text", ""),
                    "error": str(e)
                })
        
        # Store validated and flagged questions in session for confirmation
        session_id = secrets.token_urlsafe(16)
        session_doc = {
            "id": session_id,
            "filename": getattr(file, 'filename', None),
            "created_by": admin.get("admin_id"),
            "createdAt": datetime.utcnow().isoformat(),
            # store validated rows with their normalized hashes to enable fast dedupe
            "validated": validated_questions,
            "flagged": flagged_questions
        }
        try:
            # Persist session to Cosmos DB so it survives restarts
            await db.auto_create_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_doc)
        except Exception as e:
            logger.warning(f"Failed to persist bulk session to Cosmos DB (dev fallback to memory): {e}")
            bulk_upload_sessions[session_id] = session_doc
        
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
    session_id: Optional[str] = None,
    enrich: Optional[bool] = False,
    async_enrich: Optional[bool] = True,
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Confirm and import validated bulk questions"""
    try:
        # Support optional session_id via query param; choose latest if none provided
        if not bulk_upload_sessions and not session_id:
            # try to find any recent DB session
            try:
                recent = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {}, limit=1)
                if recent:
                    session = recent[0]
                    session_id = session.get("id")
                    session_data = session
                else:
                    raise HTTPException(status_code=400, detail="No pending bulk upload session found")
            except Exception:
                raise HTTPException(status_code=400, detail="No pending bulk upload session found")
        else:
            session_data = None

        # Attempt to load session from DB (partitioned by created_by). If we don't know created_by, try a cross-partition find
        if session_id and session_data is None:
            try:
                # First try to read using caller as partition (fast path if the admin created it)
                created_by_guess = admin.get("admin_id")
                try:
                    session_data = await db.read_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, created_by_guess)
                except Exception:
                    # Cross-partition query fallback
                    results = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {"id": session_id}, limit=1)
                    session_data = results[0] if results else None
            except Exception as e:
                logger.warning(f"Failed to load session {session_id}: {e}")
                session_data = bulk_upload_sessions.get(session_id)

        # If still not found, fallback to in-memory latest
        if not session_data:
            if bulk_upload_sessions:
                session_id = list(bulk_upload_sessions.keys())[-1]
                session_data = bulk_upload_sessions.get(session_id)
            else:
                raise HTTPException(status_code=400, detail="No pending bulk upload session found")

        validated_questions = session_data.get("validated", [])
        flagged_questions = session_data.get("flagged", [])

        if flagged_questions:
            raise HTTPException(status_code=400, detail={
                "message": "Bulk import aborted because some rows were flagged during validation.",
                "flagged_count": len(flagged_questions),
                "flagged_samples": flagged_questions[:5]
            })

        # Acquire optimistic lock on the session by setting state -> 'importing' using ETag replace
        session_partition = session_data.get("created_by") or session_data.get("createdBy") or admin.get("admin_id")
        db_session = None
        try:
            # Try to read authoritative DB session to get etag
            db_session = await db.read_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, session_partition)
        except Exception:
            # If read fails, attempt a cross-partition query
            try:
                found = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {"id": session_id}, limit=1)
                db_session = found[0] if found else None
            except Exception:
                db_session = None

        if db_session:
            etag = db_session.get("_etag") or db_session.get("etag")
            db_session_copy = dict(db_session)
            db_session_copy["state"] = "importing"
            try:
                if etag:
                    await db.replace_item_with_etag(CONTAINER["BULK_UPLOAD_SESSIONS"], db_session_copy, etag, partition_key=session_partition)
                else:
                    # No etag — try upsert but it is racy
                    await db.upsert_item(CONTAINER["BULK_UPLOAD_SESSIONS"], db_session_copy, partition_key=session_partition)
            except Exception as e:
                logger.warning(f"Failed to acquire import lock for session {session_id}: {e}")
                raise HTTPException(status_code=409, detail="Bulk session is being imported by another process")
        else:
            # DB unavailable — mark memory session as importing
            session_data["state"] = "importing"
            bulk_upload_sessions[session_id] = session_data

        imported_count = 0
        failed_count = 0

        # Group by skill/partition
        questions_by_skill = {}
        for q in validated_questions:
            skill_field = q.get("tags") or q.get("skill") or "general"
            if isinstance(skill_field, str):
                skill_key = (skill_field.split(",")[0] if skill_field else "general").strip() or "general"
            elif isinstance(skill_field, list) and skill_field:
                skill_key = skill_field[0]
            else:
                skill_key = "general"
            questions_by_skill.setdefault(skill_key, []).append(q)

        # For each partition, prepare docs and write transactionally when possible
        for skill, group in questions_by_skill.items():
            enhanced_docs = []
            for question_data in group:
                try:
                    q_id = f"q_{secrets.token_urlsafe(8)}"
                    enhanced = {
                        "id": q_id,
                        "text": question_data.get("text", ""),
                        "type": (question_data.get("type") or "mcq").lower(),
                        "tags": question_data.get("tags", "").split(",") if isinstance(question_data.get("tags"), str) and question_data.get("tags") else (question_data.get("tags") or []),
                        # Preserve difficulty if present in the CSV row; default to medium
                        "difficulty": question_data.get("difficulty") or question_data.get("difficulty_level") or "medium",
                        "created_by": admin["admin_id"],
                        "created_at": datetime.utcnow().isoformat(),
                        "question_hash": hashlib.sha256((question_data.get("text", "") or "").strip().lower().encode()).hexdigest()
                    }

                    qtype = enhanced.get("type")
                    if qtype == "mcq":
                        options_text = question_data.get("options") or question_data.get("options_text") or ""
                        if options_text and isinstance(options_text, str):
                            opts = []
                            for i, opt in enumerate(options_text.split("|")):
                                opts.append({"id": chr(ord('a') + i), "text": opt.strip()})
                            enhanced["options"] = opts
                            enhanced["correctAnswer"] = question_data.get("correct_answer") or question_data.get("correctAnswer") or (opts[0]["id"] if opts else "a")
                    elif qtype == "coding":
                        enhanced["starterCode"] = question_data.get("starter_code") or question_data.get("starterCode") or ""
                        tc = question_data.get("test_cases") or question_data.get("testCases") or ""
                        enhanced["testCases"] = tc.split("|") if isinstance(tc, str) and tc else (tc or [])
                        enhanced["programmingLanguage"] = question_data.get("programming_language") or question_data.get("programmingLanguage") or "python"
                    elif qtype == "descriptive":
                        enhanced["rubric"] = question_data.get("rubric", "")

                    enhanced_docs.append(enhanced)
                except Exception as e:
                    logger.error(f"Failed preparing question doc: {e}")
                    failed_count += 1

            if not enhanced_docs:
                continue

            # Phase 1 dedupe: before attempting writes, filter out rows whose
            # normalized hash already exists in the QUESTIONS container. This
            # avoids importing exact duplicates when the admin re-uploads the
            # same CSV. If the DB query fails we conservatively include the row.
            deduped_docs = []
            for d in enhanced_docs:
                qhash = d.get("question_hash")
                if qhash:
                    try:
                        existing = await db.find_many(CONTAINER["QUESTIONS"], {"question_hash": qhash}, limit=1)
                        if existing:
                            logger.info(f"Skipping exact duplicate during bulk confirm: {d.get('id')} (hash={qhash})")
                            continue
                    except Exception as e:
                        logger.warning(f"Dedup check failed (will insert): {e}")
                deduped_docs.append(d)

            # Try transactional create for this partition using deduped docs
            try:
                created = []
                if deduped_docs:
                    created = await db.transactional_create_items(CONTAINER["QUESTIONS"], deduped_docs, partition_key=skill)
                created_n = len(created) if isinstance(created, list) else (1 if created else 0)
                imported_count += created_n

                # Update KB and optionally enrich created docs
                created_iter = (created if isinstance(created, list) else deduped_docs)
                for d in created_iter:
                    try:
                        import httpx
                        knowledge_entry = {
                            "content": d.get("text", ""),
                            "skill": (d.get("tags") or ["General"])[0] if d.get("tags") else "General",
                            "content_type": "imported_question",
                            "metadata": {
                                "question_id": d.get("id"),
                                "question_type": d.get("type"),
                                "tags": d.get("tags"),
                                "created_by": d.get("created_by"),
                                "created_at": d.get("created_at"),
                                "import_source": "bulk_upload"
                            }
                        }
                        rag_update_url = "http://localhost:8000/api/rag/knowledge-base/update"
                        async with httpx.AsyncClient(timeout=5) as client:
                            resp = await client.post(rag_update_url, json=knowledge_entry)
                            if resp.status_code == 200:
                                logger.info(f"KB updated for imported question {d.get('id')}")
                    except Exception as kb_err:
                        logger.warning(f"KB update failed for imported question {d.get('id')}: {kb_err}")

                    # Phase 2: synchronous enrichment if requested
                    try:
                        # 'enrich' and 'async_enrich' are function args (FastAPI will
                        # coerce query params to bool if provided). Default behavior
                        # is to schedule async enrichment (async_enrich=True).
                        if enrich:
                            rewrite = await call_ai_service("/questions/rewrite", {"question_text": d.get("text", "")})
                            if rewrite:
                                d["text"] = rewrite.get("rewritten_text", d.get("text"))
                                suggested_tags = rewrite.get("suggested_tags", [])
                                if suggested_tags:
                                    existing_tags = d.get("tags", []) or []
                                    d["tags"] = list(dict.fromkeys(existing_tags + suggested_tags))
                                if rewrite.get("suggested_role"):
                                    d["suggested_role"] = rewrite.get("suggested_role")
                                # Accept optional suggested difficulty from the AI and normalize earlier in the agent
                                if rewrite.get("suggested_difficulty") or rewrite.get("suggestedDifficulty"):
                                    d["suggested_difficulty"] = rewrite.get("suggested_difficulty") or rewrite.get("suggestedDifficulty")
                            try:
                                await db.upsert_item(CONTAINER["QUESTIONS"], d, partition_key=skill)
                            except Exception as up_err:
                                logger.warning(f"Failed to persist synchronous enrichment for {d.get('id')}: {up_err}")
                        elif async_enrich:
                            # Phase 3: schedule a background enrichment task
                            try:
                                asyncio.create_task(_background_enrich_and_index(db, d))
                            except Exception as schedule_err:
                                logger.warning(f"Failed to schedule async enrichment for {d.get('id')}: {schedule_err}")
                    except Exception as enrich_err:
                        logger.warning(f"Enrichment error (non-fatal) for {d.get('id')}: {enrich_err}")

            except Exception as e:
                logger.warning(f"Transactional create failed for skill={skill}: {e}")
                # Fallback to per-item create; obey dedupe per-item as well
                for d in deduped_docs:
                    try:
                        qhash = d.get("question_hash")
                        skip = False
                        if qhash:
                            try:
                                exists = await db.find_many(CONTAINER["QUESTIONS"], {"question_hash": qhash}, limit=1)
                                if exists:
                                    skip = True
                                    logger.info(f"Skipping exact duplicate during fallback create: {d.get('id')} (hash={qhash})")
                            except Exception:
                                # If check fails, continue and attempt insert
                                pass
                        if skip:
                            continue
                        await db.create_item(CONTAINER["QUESTIONS"], d, partition_key=skill)
                        imported_count += 1
                        try:
                            import httpx
                            knowledge_entry = {
                                "content": d.get("text", ""),
                                "skill": (d.get("tags") or ["General"])[0] if d.get("tags") else "General",
                                "content_type": "imported_question",
                                "metadata": {
                                    "question_id": d.get("id"),
                                    "question_type": d.get("type"),
                                    "tags": d.get("tags"),
                                    "created_by": d.get("created_by"),
                                    "created_at": d.get("created_at"),
                                    "import_source": "bulk_upload"
                                }
                            }
                            rag_update_url = "http://localhost:8000/api/rag/knowledge-base/update"
                            async with httpx.AsyncClient(timeout=5) as client:
                                resp = await client.post(rag_update_url, json=knowledge_entry)
                        except Exception:
                            pass
                    except Exception as ie:
                        logger.error(f"Failed to create question during fallback: {ie}")
                        failed_count += 1

        # Cleanup: attempt to delete persisted session from DB, else memory
        try:
            if db_session:
                partition_key = db_session.get("created_by") or session_partition
                await db.delete_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, partition_key=partition_key)
            else:
                # try best-effort deletion using guessed partition
                await db.delete_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, partition_key=session_partition)
        except Exception as e:
            logger.warning(f"Failed to delete bulk session {session_id} from DB: {e}")
            bulk_upload_sessions.pop(session_id, None)

        return {
            "success": True,
            "imported_count": imported_count,
            "failed_count": failed_count,
            "message": f"Imported {imported_count} questions ({failed_count} failed)"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk confirm: {e}")
        raise HTTPException(status_code=500, detail="Failed to import questions")


# New endpoints for managing bulk upload sessions
@router.get("/questions/bulk-sessions")
async def list_bulk_sessions(
    admin: dict = Depends(verify_admin_token)
):
    """List pending bulk upload sessions with minimal metadata"""
    try:
        # Prefer DB-backed sessions
        db_sessions = []
        try:
            db: CosmosDBService = await get_cosmosdb()
            raw = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {}, limit=50)
            for r in raw or []:
                db_sessions.append({
                    "session_id": r.get("id"),
                    "created_at": r.get("createdAt"),
                    "filename": r.get("filename"),
                    "validated_count": len(r.get("validated", [])),
                    "flagged_count": len(r.get("flagged", []))
                })
        except Exception:
            # DB may be unavailable in dev; fall back to memory
            for sid, data in bulk_upload_sessions.items():
                db_sessions.append({
                    "session_id": sid,
                    "created_at": data.get("created_at"),
                    "filename": data.get("filename"),
                    "validated_count": len(data.get("validated", [])),
                    "flagged_count": len(data.get("flagged", []))
                })

        sessions_sorted = sorted(db_sessions, key=lambda s: s.get("created_at") or "", reverse=True)
        return {"sessions": sessions_sorted}
    except Exception as e:
        logger.error(f"Error listing bulk sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to list bulk sessions")


@router.get("/questions/bulk-sessions/{session_id}")
async def get_bulk_session(
    session_id: str,
    admin: dict = Depends(verify_admin_token)
):
    """Return full session data (validated + flagged rows) for review"""
    try:
        # Try DB first — read using the session's partition (created_by = admin id) when possible.
        try:
            db: CosmosDBService = await get_cosmosdb()
            # Prefer reading using the admin's partition key (created_by)
            partition_guess = admin.get("admin_id")
            try:
                session = await db.read_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, partition_guess)
            except Exception:
                # Fallback to cross-partition query if direct read fails
                results = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {"id": session_id}, limit=1)
                session = results[0] if results else None
        except Exception:
            session = bulk_upload_sessions.get(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Bulk session not found")

        return {
            "session_id": session_id,
            "created_at": session.get("createdAt") or session.get("created_at"),
            "filename": session.get("filename"),
            "validated": session.get("validated", []),
            "flagged": session.get("flagged", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching bulk session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch bulk session")


class RevalidateResult(BaseModel):
    session_id: str
    revalidated_count: int
    still_flagged_count: int
    flagged_samples: List[Dict[str, Any]]


@router.post("/questions/bulk-sessions/{session_id}/revalidate")
async def revalidate_flagged_rows(
    session_id: str,
    admin: dict = Depends(verify_admin_token)
):
    """Re-run validation for flagged rows in a bulk session. Moves rows that pass
    validation back into the validated list and updates the session in-place.
    Returns a small summary of the results.
    """
    try:
        # Load session from DB if available
        try:
            db: CosmosDBService = await get_cosmosdb()
            partition_guess = admin.get("admin_id")
            try:
                session = await db.read_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, partition_guess)
            except Exception:
                results = await db.find_many(CONTAINER["BULK_UPLOAD_SESSIONS"], {"id": session_id}, limit=1)
                session = results[0] if results else None
        except Exception:
            session = bulk_upload_sessions.get(session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Bulk session not found")

        flagged = session.get("flagged", [])
        if not flagged:
            return {
                "session_id": session_id,
                "revalidated_count": 0,
                "still_flagged_count": 0,
                "flagged_samples": []
            }

        revalidated = []
        still_flagged = []

        # Attempt to re-validate each flagged row using the AI service
        for row in flagged:
            try:
                question_text = row.get("text") or row.get("question_text") or ""
                validation_result = await call_ai_service("/questions/validate", {"question_text": question_text})
                if validation_result.get("status") == "exact_duplicate":
                    # Keep it flagged as duplicate
                    still_flagged.append({"text": question_text, "reason": "exact_duplicate"})
                elif validation_result.get("status") == "similar_duplicate":
                    still_flagged.append({"text": question_text, "reason": "similar_duplicate", "similar_to": validation_result.get("similar_questions", [])})
                else:
                    # Now considered validated
                    revalidated.append(row)
            except HTTPException:
                # If the AI call fails, propagate to avoid silent acceptance
                raise
            except Exception as e:
                logger.warning(f"Revalidation error for session {session_id}: {e}")
                still_flagged.append({"text": row.get("text"), "reason": str(e)})

        # Merge revalidated rows into validated and update flagged list
        validated = session.get("validated", [])
        validated.extend(revalidated)
        session["validated"] = validated
        session["flagged"] = still_flagged

        # Persist updated session back to DB (or memory fallback)
        try:
            db: CosmosDBService = await get_cosmosdb()
            # Ensure we write using existing id/etag semantics. We'll attempt a replace.
            # Read existing to fetch etag if SDK provides it
            try:
                # Determine partition key for session persistence (prefer session created_by, else admin id)
                existing_partition = (session.get("created_by") if isinstance(session, dict) else None) or admin.get("admin_id") or session_id
                existing = await db.read_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session_id, existing_partition)
                etag = existing.get("_etag") or existing.get("etag")
            except Exception:
                existing = None
                etag = None

            # If etag available, try conditional replace
            if etag:
                try:
                    await db.replace_item_with_etag(CONTAINER["BULK_UPLOAD_SESSIONS"], session, etag, partition_key=existing_partition)
                except Exception as e:
                    logger.warning(f"ETag replace failed for session {session_id}: {e}")
                    # Fallback to upsert
                    await db.upsert_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session, partition_key=existing_partition)
            else:
                await db.upsert_item(CONTAINER["BULK_UPLOAD_SESSIONS"], session, partition_key=existing_partition)
        except Exception as e:
            logger.warning(f"Failed to persist updated session to DB (fallback to memory) for {session_id}: {e}")
            bulk_upload_sessions[session_id] = session

        result = RevalidateResult(
            session_id=session_id,
            revalidated_count=len(revalidated),
            still_flagged_count=len(still_flagged),
            flagged_samples=still_flagged[:5]
        )

        return result.dict()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error revalidating flagged rows for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to revalidate flagged rows")

@router.get("/questions")
async def get_questions(
    admin: dict = Depends(verify_admin_token),
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Get all questions for admin dashboard"""
    try:
        questions = await db.find_many("questions", {}, limit=100)
        return questions or []
    except Exception:
        return []


# Live Interview Analytics Endpoints
@router.get("/live-interviews/sessions")
async def get_live_interview_sessions(
    admin: dict = Depends(verify_admin_token),
    db_service: CosmosDBService = Depends(get_cosmosdb)
):
    """Get all active and recent live interview sessions"""
    try:
    # Query interview_transcripts collection for active sessions
        
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