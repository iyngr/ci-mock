# Implementation Plan - Question Generation System Fixes

**Status:** � IN PROGRESS - Phase 3 Complete, Phase 4 Pending  
**Progress:** 3/6 Phases Complete (50%)  
**Priority:** URGENT - Must complete before production deployment

---

## Executive Summary

This plan addresses critical issues in the question generation workflow that currently cause:
- ~~Empty assessments falling back to mock data~~ ✅ FIXED (Phase 1)
- ~~No question generation during test initiation~~ ✅ FIXED (Phase 2)
- ~~No auto-submission state tracking~~ ✅ FIXED (Phase 3)
- State-based blocking not working ⏳ IN PROGRESS (Phase 4)
- Duplicate questions generated without detection (Phase 5)
- Missing deduplication across three levels (Phase 6)

---

## Phase 1: ✅ COMPLETE - Production Safety (DONE)

**Status:** ✅ **COMPLETED**  
**Completed:** October 2, 2025  
**Documentation:** `docs/PHASE_1_COMPLETED.md`

**Achievements:**
- ✅ Removed all mock data fallbacks from candidate.py (~250 lines)
- ✅ Added validate_assessment_ready() function
- ✅ Added production safety configuration (STRICT_MODE, MIN_QUESTIONS_REQUIRED)
- ✅ Enhanced structured error handling with proper HTTP status codes
- ✅ Backend tested successfully - zero errors

---

## Phase 2: ✅ COMPLETE - Question Generation Flow Fixes (DONE)

**Status:** ✅ **COMPLETED**  
**Completed:** October 2, 2025  
**Documentation:** `docs/PHASE_2_COMPLETED.md` (pending)

**Achievements:**
- ✅ Added LLM agent health check function (check_llm_agent_health)
- ✅ Implemented retry logic with exponential backoff (call_ai_service_with_retry)
- ✅ Extended test initiation endpoint to support inline assessment creation
- ✅ Created create_assessment_inline() helper function
- ✅ Question generation now triggers during test initiation
- ✅ Backend compiles and runs with zero errors

---

## Phase 3: ✅ COMPLETE - Auto-Submission State Tracking (DONE)

**Status:** ✅ **COMPLETED**  
**Completed:** October 2, 2025  
**Documentation:** `docs/PHASE_3_COMPLETED.md`

**Achievements:**
- ✅ Added auto-submission timer configuration (AUTO_SUBMIT_ENABLED, AUTO_SUBMIT_GRACE_PERIOD)
- ✅ Implemented POST /assessment/{id}/submit endpoint with auto-submission tracking
- ✅ Implemented GET /assessment/{id}/timer endpoint for timer sync
- ✅ Added server-side timer expiration detection with grace period
- ✅ Updated submission model with auto_submitted, auto_submit_reason, auto_submit_timestamp
- ✅ Backend compiles and runs with zero errors

**Next Steps (Frontend):**
- ⏳ Implement timer component with sync
- ⏳ Add auto-submit on timer expiry
- ⏳ Add UI indicators for auto-submitted state

---

## Phase 4: ⏳ PENDING - State-Based Blocking

**Status:** ⏳ **NOT STARTED**  
**Original Name:** Phase 3 in old plan

**Objective:** Remove all mock fallbacks and prevent test data leakage to production

### Task 1.1: Remove Mock Data from candidate.py ⚠️ URGENT
**File:** `backend/routers/candidate.py`  
**Time:** 2 hours

**Actions:**
- [ ] Remove `mock_questions` array (lines 244-280)
- [ ] Remove `mock_tests` dictionary (lines 226-233)
- [ ] Remove all `DEV_MOCK_FALLBACK` environment checks
- [ ] Remove mock fallback at line 171 (verify_candidate_access)
- [ ] Remove mock fallback at line 352 (start_assessment)
- [ ] Remove mock fallback at line 540 (db=None case)
- [ ] Remove mock fallback at line 571 (assessment not found)
- [ ] Remove mock fallback at line 592 (questions empty)
- [ ] Remove mock fallback at line 926 (mock tests)

**Replace with proper errors:**
```python
# Before (line 571):
if not assessment:
    assessment = mock_questions  # DANGEROUS!

# After:
if not assessment:
    raise HTTPException(
        status_code=404,
        detail={
            "error": "assessment_not_found",
            "message": f"Assessment {assessment_id} does not exist",
            "test_id": test_id
        }
    )
```

**Testing:**
```powershell
# Test with invalid assessment ID - should return 404
curl -X GET http://localhost:8000/api/candidate/assessment/invalid_id/questions/page?page_num=1

# Test with valid but empty assessment - should return 400
curl -X GET http://localhost:8000/api/candidate/assessment/{valid_id}/questions/page?page_num=1
```

---

### Task 1.2: Add Assessment Validation ⚠️ URGENT
**File:** `backend/routers/candidate.py`  
**Time:** 1 hour

**Actions:**
- [ ] Add `validate_assessment_ready()` function
- [ ] Check assessment exists AND has questions before allowing test start
- [ ] Return detailed error messages
- [ ] Block test initiation if validation fails

**Implementation:**
```python
async def validate_assessment_ready(assessment_id: str, db) -> dict:
    """Validate assessment is ready for test taking"""
    assessment = await db.read_item(
        CONTAINER["ASSESSMENTS"],
        assessment_id,
        assessment_id  # partition key = id
    )
    
    if not assessment:
        raise HTTPException(404, detail={
            "error": "assessment_not_found",
            "message": "Assessment does not exist"
        })
    
    questions = assessment.get("questions", [])
    if not questions or len(questions) == 0:
        raise HTTPException(400, detail={
            "error": "assessment_incomplete",
            "message": "Assessment has no questions. Generation may still be in progress.",
            "assessment_id": assessment_id
        })
    
    return {
        "valid": True,
        "question_count": len(questions),
        "assessment_id": assessment_id
    }

# Use in start_assessment endpoint:
@router.post("/assessment/{test_id}/start")
async def start_assessment(test_id: str, ...):
    submission = await db.read_item(...)
    
    # Validate before starting
    validation = await validate_assessment_ready(
        submission["assessment_id"], 
        db
    )
    
    # Update submission to in_progress
    # Return validated assessment
```

**Testing:**
- [ ] Test with assessment that has 0 questions → 400 error
- [ ] Test with assessment that has questions → success
- [ ] Test with non-existent assessment → 404 error

---

### Task 1.3: Update Environment Configuration
**Files:** `.env`, `backend/constants.py`  
**Time:** 30 minutes

**Actions:**
- [ ] Remove `DEV_MOCK_FALLBACK` from environment variables
- [ ] Add `STRICT_MODE=true` for production
- [ ] Add `MIN_QUESTIONS_REQUIRED=5` validation threshold
- [ ] Update deployment documentation

**Add to constants.py:**
```python
# Production safety settings
STRICT_MODE = os.getenv("STRICT_MODE", "true").lower() == "true"
MIN_QUESTIONS_REQUIRED = int(os.getenv("MIN_QUESTIONS_REQUIRED", "5"))
ALLOW_EMPTY_ASSESSMENTS = os.getenv("ALLOW_EMPTY_ASSESSMENTS", "false").lower() == "true"
```

---

### Task 1.4: Add Comprehensive Error Logging
**File:** `backend/routers/candidate.py`, `backend/routers/admin.py`  
**Time:** 1 hour

**Actions:**
- [ ] Log all assessment not found errors with context
- [ ] Log all empty assessment fallback attempts
- [ ] Log all question generation failures
- [ ] Add structured logging (JSON format)

**Implementation:**
```python
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# In error handlers:
logger.error(
    "Assessment validation failed",
    extra={
        "timestamp": datetime.utcnow().isoformat(),
        "assessment_id": assessment_id,
        "error_type": "empty_questions",
        "question_count": 0,
        "test_id": test_id,
        "candidate_email": candidate_email
    }
)
```

---

## Phase 2: CRITICAL - Fix Question Generation Flow (6-8 hours)

**Objective:** Ensure question generation is triggered during test initiation

### Task 2.1: Refactor Test Initiation Endpoint
**File:** `backend/routers/admin.py`  
**Time:** 3 hours

**Current Problem:** `/tests/initiate` doesn't trigger question generation

**Solution:** Modify endpoint to accept generation specs

**Implementation:**
```python
class TestInitiationRequestModel(BaseModel):
    assessment_id: Optional[str] = None  # Use existing assessment
    title: Optional[str] = None  # Or create new assessment
    duration_minutes: int
    candidate_email: str
    
    # NEW: Support inline assessment creation
    questions: Optional[List[dict]] = None  # Existing questions
    generate: Optional[List[GenerateQuestionSpec]] = None  # Generate new
    select_existing: Optional[List[SelectExistingSpec]] = None  # From questions container

@router.post("/tests/initiate")
async def initiate_test(
    request: TestInitiationRequestModel,
    background_tasks: BackgroundTasks,
    db=Depends(get_db)
):
    assessment_id = request.assessment_id
    
    # If no assessment_id provided, create assessment inline
    if not assessment_id:
        if not (request.questions or request.generate or request.select_existing):
            raise HTTPException(400, detail={
                "error": "missing_questions",
                "message": "Must provide assessment_id OR question specs"
            })
        
        # Create assessment inline (reuse create_assessment_admin logic)
        assessment_request = CreateAssessmentRequest(
            title=request.title or f"Assessment for {request.candidate_email}",
            questions=request.questions,
            generate=request.generate,
            select_existing=request.select_existing,
            duration_minutes=request.duration_minutes
        )
        
        assessment_doc = await create_assessment_inline(
            assessment_request, 
            background_tasks, 
            db
        )
        assessment_id = assessment_doc["id"]
    
    # Validate assessment has questions
    await validate_assessment_ready(assessment_id, db)
    
    # Create submission
    submission_doc = {
        "id": f"sub_{secrets.token_urlsafe(16)}",
        "assessment_id": assessment_id,
        "candidate_email": request.candidate_email,
        "status": "not_started",
        ...
    }
    
    await db.create_item(CONTAINER["SUBMISSIONS"], submission_doc)
    
    return {
        "test_id": submission_doc["id"],
        "assessment_id": assessment_id,
        "message": "Test initiated successfully"
    }
```

**Testing:**
```powershell
# Test 1: Create test with generation specs
curl -X POST http://localhost:8000/api/admin/tests/initiate `
  -H "Content-Type: application/json" `
  -d '{
    "title": "Python Assessment",
    "duration_minutes": 60,
    "candidate_email": "test@example.com",
    "generate": [
      {"skill": "python", "question_type": "mcq", "difficulty": "medium", "count": 5}
    ]
  }'

# Test 2: Create test with existing assessment
curl -X POST http://localhost:8000/api/admin/tests/initiate `
  -H "Content-Type: application/json" `
  -d '{
    "assessment_id": "existing_assessment_id",
    "duration_minutes": 60,
    "candidate_email": "test@example.com"
  }'
```

---

### Task 2.2: Extract Common Assessment Creation Logic
**File:** `backend/routers/admin.py`  
**Time:** 2 hours

**Actions:**
- [ ] Create `create_assessment_inline()` function
- [ ] Refactor `create_assessment_admin()` to use shared logic
- [ ] Handle synchronous vs async generation
- [ ] Return assessment doc with question count

**Implementation:**
```python
async def create_assessment_inline(
    request: CreateAssessmentRequest,
    background_tasks: BackgroundTasks,
    db
) -> dict:
    """Shared logic for creating assessments"""
    questions_list = []
    
    # Phase 1: Select existing questions (if specified)
    if request.select_existing:
        existing_questions = await fetch_existing_questions(
            request.select_existing, 
            db
        )
        questions_list.extend(existing_questions)
    
    # Phase 2: Check cache and generate new questions
    if request.generate:
        generated_questions = await generate_or_reuse_questions(
            request.generate,
            background_tasks,
            db
        )
        questions_list.extend(generated_questions)
    
    # Phase 3: Add manually specified questions
    if request.questions:
        questions_list.extend(request.questions)
    
    # Validate minimum questions
    if len(questions_list) < MIN_QUESTIONS_REQUIRED:
        raise HTTPException(400, detail={
            "error": "insufficient_questions",
            "message": f"Assessment must have at least {MIN_QUESTIONS_REQUIRED} questions",
            "current_count": len(questions_list)
        })
    
    # Create assessment document
    assessment_doc = {
        "id": f"assess_{secrets.token_urlsafe(12)}",
        "title": request.title,
        "questions": questions_list,
        "metadata": {
            "question_count": len(questions_list),
            "has_generated": bool(request.generate),
            "has_existing": bool(request.select_existing)
        }
    }
    
    await db.create_item(CONTAINER["ASSESSMENTS"], assessment_doc)
    return assessment_doc
```

---

### Task 2.3: Add LLM Agent Health Check
**File:** `backend/routers/utils.py`  
**Time:** 1 hour

**Actions:**
- [ ] Create `/health/llm-agent` endpoint
- [ ] Check before assessment creation
- [ ] Add retry logic with exponential backoff
- [ ] Return degraded status if service down

**Implementation:**
```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

AI_SERVICE_URL = "http://localhost:8001"

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def check_llm_agent_health() -> dict:
    """Check if llm-agent service is reachable"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{AI_SERVICE_URL}/health")
            response.raise_for_status()
            return {
                "available": True,
                "status": "healthy",
                "url": AI_SERVICE_URL
            }
    except Exception as e:
        return {
            "available": False,
            "status": "unreachable",
            "error": str(e),
            "url": AI_SERVICE_URL
        }

@router.get("/health/llm-agent")
async def get_llm_agent_health():
    """Public endpoint to check llm-agent availability"""
    return await check_llm_agent_health()

# Use before generation:
async def generate_or_reuse_questions(...):
    if not (await check_llm_agent_health())["available"]:
        raise HTTPException(503, detail={
            "error": "llm_agent_unavailable",
            "message": "Question generation service is currently unavailable"
        })
```

**Testing:**
```powershell
# Test health check
curl http://localhost:8000/api/utils/health/llm-agent

# Stop llm-agent and test error handling
# Should return 503 with clear error message
```

---

## Phase 3: HIGH PRIORITY - Implement Deduplication (8-10 hours)

**Objective:** Prevent duplicate question generation across three levels

### Task 3.1: Level 1 - Prompt Hash Deduplication
**File:** `backend/routers/admin.py`  
**Time:** 3 hours

**Implementation:**
```python
async def generate_or_reuse_questions(
    generate_specs: List[GenerateQuestionSpec],
    background_tasks: BackgroundTasks,
    db
) -> List[dict]:
    """Generate questions with prompt hash caching"""
    questions_list = []
    
    for gen_spec in generate_specs:
        skill_slug = normalize_skill(gen_spec.skill)
        qtype = gen_spec.question_type
        difficulty = gen_spec.difficulty
        count = gen_spec.count
        
        # Calculate prompt hash
        prompt_hash = hashlib.sha256(
            (skill_slug + qtype + difficulty).encode()
        ).hexdigest()
        
        # Check cache first (Level 1 deduplication)
        query = f"""
            SELECT * FROM c 
            WHERE c.promptHash = @hash 
            AND c.skill = @skill
            ORDER BY c.usage_count DESC
        """
        
        cached_questions = await db.query_items(
            CONTAINER["GENERATED_QUESTIONS"],
            query,
            parameters=[
                {"name": "@hash", "value": prompt_hash},
                {"name": "@skill", "value": skill_slug}
            ]
        )
        
        reused_count = 0
        
        # Reuse cached questions up to requested count
        for cached_q in cached_questions[:count]:
            # Increment usage counter
            cached_q["usage_count"] = cached_q.get("usage_count", 0) + 1
            cached_q["last_used"] = datetime.utcnow().isoformat()
            
            await db.upsert_item(CONTAINER["GENERATED_QUESTIONS"], cached_q)
            questions_list.append(cached_q)
            reused_count += 1
            
            logger.info(f"Reused cached question: {cached_q['id']} (usage: {cached_q['usage_count']})")
        
        # Generate remaining questions if needed
        remaining = count - reused_count
        if remaining > 0:
            logger.info(f"Generating {remaining} new questions for {skill_slug}/{qtype}/{difficulty}")
            
            for _ in range(remaining):
                # Generate new question via llm-agent
                ai_resp = await call_ai_service("/generate-question", {
                    "skill": skill_slug,
                    "question_type": qtype,
                    "difficulty": difficulty
                })
                
                # Create new document with hash
                gen_doc = {
                    "id": f"gq_{secrets.token_urlsafe(8)}",
                    "promptHash": prompt_hash,
                    "generated_text": ai_resp["question"],
                    "skill": skill_slug,
                    "question_type": qtype,
                    "difficulty": difficulty,
                    "usage_count": 1,
                    "created_at": datetime.utcnow().isoformat()
                }
                
                # Check Level 2: Content hash (before storing)
                content_hash = hashlib.sha256(
                    gen_doc["generated_text"].encode()
                ).hexdigest()
                gen_doc["contentHash"] = content_hash
                
                # Check if content already exists
                duplicate_check = await db.query_items(
                    CONTAINER["GENERATED_QUESTIONS"],
                    f"SELECT * FROM c WHERE c.contentHash = '{content_hash}'"
                )
                
                if duplicate_check:
                    logger.warning(f"Content duplicate detected! Reusing existing: {duplicate_check[0]['id']}")
                    questions_list.append(duplicate_check[0])
                    continue
                
                # Store new question
                await db.create_item(CONTAINER["GENERATED_QUESTIONS"], gen_doc)
                
                # Queue for RAG indexing (Level 3)
                background_tasks.add_task(_queue_indexing, db, gen_doc)
                
                questions_list.append(gen_doc)
    
    return questions_list
```

**Testing:**
```python
# Test prompt hash caching
# Generate 5 questions for "Python/MCQ/Medium"
# Generate 5 more with same params
# Should reuse all 5 from cache (0 new generations)

# Test content hash
# If AI generates duplicate text
# Should detect and skip storage
```

---

### Task 3.2: Level 2 - Content Hash Deduplication
**File:** `backend/models.py`  
**Time:** 1 hour

**Actions:**
- [ ] Add `contentHash` field to GeneratedQuestion model
- [ ] Add `contentHash` field to Question model
- [ ] Create index on contentHash in Cosmos DB

**Implementation:**
```python
class GeneratedQuestion(CosmosDocument):
    id: str
    generated_text: str
    promptHash: str  # Existing
    contentHash: Optional[str] = None  # NEW
    skill: str
    question_type: str
    difficulty: str
    usage_count: int = 0
    
    def compute_content_hash(self) -> str:
        """Compute SHA256 hash of question text"""
        return hashlib.sha256(self.generated_text.encode()).hexdigest()
    
    @model_validator(mode='after')
    def set_content_hash(self):
        """Auto-compute content hash if not set"""
        if not self.contentHash:
            self.contentHash = self.compute_content_hash()
        return self
```

**Database Migration:**
```python
# Script: scripts/add_content_hashes.py
async def migrate_content_hashes():
    """Add contentHash to existing questions"""
    questions = await db.query_items(
        CONTAINER["GENERATED_QUESTIONS"],
        "SELECT * FROM c WHERE NOT IS_DEFINED(c.contentHash)"
    )
    
    for q in questions:
        q["contentHash"] = hashlib.sha256(
            q["generated_text"].encode()
        ).hexdigest()
        await db.upsert_item(CONTAINER["GENERATED_QUESTIONS"], q)
    
    logger.info(f"Migrated {len(questions)} questions with content hashes")
```

---

### Task 3.3: Level 3 - Semantic Similarity via Embeddings
**File:** `backend/routers/rag.py`  
**Time:** 4 hours

**Implementation:**
```python
@router.post("/knowledge-base/update")
async def update_knowledge_base(request: UpdateKnowledgeBaseRequest, db):
    """Update knowledge base with duplicate detection"""
    
    # Step 1: Generate embedding for new content
    embedding = await generate_embedding_via_llm_agent(request.content)
    
    # Step 2: Check for semantic duplicates (Level 3)
    similar_entries = await vector_similarity_search(
        db=db,
        embedding=embedding,
        skill=request.skill,
        threshold=0.95,  # 95% similarity = duplicate
        limit=5
    )
    
    if similar_entries and similar_entries[0]["similarity"] > 0.95:
        logger.warning(
            f"Semantic duplicate detected! Similarity: {similar_entries[0]['similarity']:.2%}",
            extra={
                "new_content": request.content[:100],
                "existing_id": similar_entries[0]["id"],
                "existing_content": similar_entries[0]["content"][:100]
            }
        )
        
        return {
            "duplicate_detected": True,
            "existing_entry_id": similar_entries[0]["id"],
            "similarity_score": similar_entries[0]["similarity"],
            "message": "Content already exists in knowledge base"
        }
    
    # Step 3: No duplicate found, create new entry
    knowledge_entry = KnowledgeBaseEntry(
        id=str(uuid.uuid4()),
        content=request.content,
        embedding=embedding,
        skill=request.skill,
        sourceType=request.content_type,
        metadata=request.metadata,
        created_at=datetime.utcnow().isoformat()
    )
    
    await db.upsert_item(CONTAINER["KNOWLEDGE_BASE"], knowledge_entry)
    
    return {
        "duplicate_detected": False,
        "entry_id": knowledge_entry["id"],
        "message": "Successfully added to knowledge base"
    }


async def vector_similarity_search(
    db,
    embedding: List[float],
    skill: str,
    threshold: float = 0.90,
    limit: int = 5
) -> List[dict]:
    """
    Perform vector similarity search in KnowledgeBase container
    Requires Cosmos DB vector search capability
    """
    
    # Cosmos DB Vector Search query
    query = """
        SELECT c.id, c.content, c.metadata, c.sourceType,
               VectorDistance(c.embedding, @embedding) AS similarity
        FROM c
        WHERE c.skill = @skill
          AND c.sourceType = 'generated_question'
        ORDER BY VectorDistance(c.embedding, @embedding)
        OFFSET 0 LIMIT @limit
    """
    
    results = await db.query_items(
        CONTAINER["KNOWLEDGE_BASE"],
        query,
        parameters=[
            {"name": "@embedding", "value": embedding},
            {"name": "@skill", "value": skill},
            {"name": "@limit", "value": limit}
        ]
    )
    
    # Filter by threshold
    filtered = [r for r in results if r["similarity"] >= threshold]
    
    return filtered
```

**Note:** Cosmos DB vector search requires:
- Container configured with vector indexing policy
- Embedding dimension specification (1536 for Azure OpenAI)
- Vector distance function (cosine similarity)

**Configuration Required:**
```json
{
  "indexingPolicy": {
    "vectorIndexes": [
      {
        "path": "/embedding",
        "type": "quantizedFlat"
      }
    ]
  },
  "vectorEmbeddingPolicy": {
    "vectorEmbeddings": [
      {
        "path": "/embedding",
        "dataType": "float32",
        "dimensions": 1536,
        "distanceFunction": "cosine"
      }
    ]
  }
}
```

---

## Phase 4: MEDIUM PRIORITY - Hybrid Workflow (4-6 hours)

**Objective:** Support mixing existing questions with generated questions

### Task 4.1: Implement Select Existing Questions
**File:** `backend/routers/admin.py`  
**Time:** 2 hours

**Implementation:**
```python
class SelectExistingSpec(BaseModel):
    skill: str
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    count: int = 5
    tags: Optional[List[str]] = None
    role: Optional[str] = None


async def fetch_existing_questions(
    select_specs: List[SelectExistingSpec],
    db
) -> List[dict]:
    """Fetch existing questions from questions container"""
    questions_list = []
    
    for spec in select_specs:
        # Build dynamic query
        conditions = [f"c.skill = '{normalize_skill(spec.skill)}'"]
        
        if spec.question_type:
            conditions.append(f"c.type = '{spec.question_type}'")
        
        if spec.difficulty:
            conditions.append(f"c.difficulty = '{spec.difficulty}'")
        
        if spec.role:
            conditions.append(f"c.role = '{spec.role}'")
        
        if spec.tags:
            # Check if any tag matches
            tag_conditions = " OR ".join([f"ARRAY_CONTAINS(c.tags, '{tag}')" for tag in spec.tags])
            conditions.append(f"({tag_conditions})")
        
        query = f"""
            SELECT * FROM c
            WHERE {' AND '.join(conditions)}
            ORDER BY c.usage_count ASC
            OFFSET 0 LIMIT {spec.count}
        """
        
        existing = await db.query_items(CONTAINER["QUESTIONS"], query)
        
        # Increment usage count
        for q in existing:
            q["usage_count"] = q.get("usage_count", 0) + 1
            await db.upsert_item(CONTAINER["QUESTIONS"], q)
        
        questions_list.extend(existing)
        
        logger.info(f"Selected {len(existing)} existing questions for {spec.skill}")
    
    return questions_list
```

**Testing:**
```python
# Test hybrid workflow
request = {
    "title": "Full Stack Assessment",
    "select_existing": [
        {"skill": "python", "difficulty": "easy", "count": 3}
    ],
    "generate": [
        {"skill": "react", "question_type": "mcq", "difficulty": "medium", "count": 5}
    ]
}

# Should return 8 questions total:
# - 3 existing Python questions from questions container
# - 5 newly generated React questions
```

---

### Task 4.2: Question Promotion System
**File:** `backend/routers/admin.py`  
**Time:** 2 hours

**Actions:**
- [ ] Add `promote_to_questions` flag
- [ ] Copy high-quality generated questions to questions container
- [ ] Add review workflow

**Implementation:**
```python
async def promote_generated_question(
    generated_question_id: str,
    db,
    reviewed_by: str
) -> dict:
    """Promote generated question to curated questions container"""
    
    # Fetch from generated_questions
    gen_q = await db.read_item(
        CONTAINER["GENERATED_QUESTIONS"],
        generated_question_id,
        normalize_skill(generated_question_id.split("_")[0])  # partition key
    )
    
    if not gen_q:
        raise HTTPException(404, detail="Generated question not found")
    
    # Convert to Question model
    promoted_question = {
        "id": f"q_{secrets.token_urlsafe(8)}",
        "text": gen_q["generated_text"],
        "type": gen_q["question_type"],
        "difficulty": gen_q["difficulty"],
        "skill": gen_q["skill"],
        "tags": gen_q.get("suggested_tags", []),
        "role": gen_q.get("suggested_role"),
        "usage_count": 0,
        "quality_score": gen_q.get("quality_score", 0.0),
        "promoted_from": generated_question_id,
        "reviewed_by": reviewed_by,
        "promoted_at": datetime.utcnow().isoformat()
    }
    
    await db.create_item(CONTAINER["QUESTIONS"], promoted_question)
    
    # Mark as promoted in generated_questions
    gen_q["promoted"] = True
    gen_q["promoted_to"] = promoted_question["id"]
    await db.upsert_item(CONTAINER["GENERATED_QUESTIONS"], gen_q)
    
    logger.info(f"Promoted question {generated_question_id} → {promoted_question['id']}")
    
    return promoted_question


@router.post("/admin/questions/promote/{generated_question_id}")
async def promote_question_endpoint(
    generated_question_id: str,
    reviewed_by: str = Depends(get_current_admin),
    db = Depends(get_db)
):
    """Admin endpoint to promote generated question to curated set"""
    return await promote_generated_question(generated_question_id, db, reviewed_by)
```

---

## Phase 5: LOWER PRIORITY - Quality Improvements (4-6 hours)

### Task 5.1: Add Question Analytics
**File:** `backend/routers/admin.py`  
**Time:** 2 hours

**Implementation:**
```python
@router.get("/admin/analytics/questions")
async def get_question_analytics(db = Depends(get_db)):
    """Get analytics on question usage and quality"""
    
    # Query generated_questions container
    stats_query = """
        SELECT 
            COUNT(1) as total_generated,
            SUM(c.usage_count) as total_usage,
            AVG(c.quality_score) as avg_quality,
            COUNT(c.promoted) as promoted_count
        FROM c
    """
    
    stats = await db.query_items(CONTAINER["GENERATED_QUESTIONS"], stats_query)
    
    # Cache hit rate
    cache_hit_query = """
        SELECT c.promptHash, COUNT(1) as reuse_count
        FROM c
        WHERE c.usage_count > 1
        GROUP BY c.promptHash
    """
    
    cache_hits = await db.query_items(CONTAINER["GENERATED_QUESTIONS"], cache_hit_query)
    
    return {
        "total_generated": stats[0]["total_generated"],
        "total_usage": stats[0]["total_usage"],
        "average_quality_score": stats[0]["avg_quality"],
        "promoted_count": stats[0]["promoted_count"],
        "cache_hit_rate": len(cache_hits) / stats[0]["total_generated"] if stats[0]["total_generated"] > 0 else 0,
        "unique_prompt_hashes": len(cache_hits)
    }
```

---

### Task 5.2: Add Question Quality Scoring
**File:** `backend/routers/scoring.py`  
**Time:** 2 hours

**Implementation:**
```python
async def calculate_question_quality_score(question_id: str, db) -> float:
    """Calculate quality score based on usage and feedback"""
    
    # Fetch question
    question = await db.read_item(
        CONTAINER["GENERATED_QUESTIONS"],
        question_id,
        question_id.split("_")[0]
    )
    
    # Factors:
    # 1. Usage count (normalized 0-1)
    # 2. Candidate feedback (if available)
    # 3. Admin review score
    # 4. Time-to-answer correlation
    
    usage_score = min(question.get("usage_count", 0) / 10, 1.0)  # Max at 10 uses
    feedback_score = question.get("avg_feedback_rating", 0.5)
    review_score = question.get("admin_review_score", 0.5)
    
    quality_score = (
        usage_score * 0.3 +
        feedback_score * 0.4 +
        review_score * 0.3
    )
    
    # Update question
    question["quality_score"] = quality_score
    await db.upsert_item(CONTAINER["GENERATED_QUESTIONS"], question)
    
    return quality_score
```

---

## Phase 6: DevOps & Monitoring (2-4 hours)

### Task 6.1: Add Health Check Dashboard
**File:** `frontend/apps/admin/src/pages/health.tsx`  
**Time:** 2 hours

**Features:**
- [ ] Real-time service status (backend, llm-agent, database)
- [ ] Question generation metrics
- [ ] Cache hit rates
- [ ] Error rates
- [ ] Recent failures log

---

### Task 6.2: Add Deployment Checklist
**File:** `docs/DEPLOYMENT_CHECKLIST.md`  
**Time:** 1 hour

**Contents:**
```markdown
# Pre-Deployment Checklist

## Environment Validation
- [ ] STRICT_MODE=true
- [ ] DEV_MOCK_FALLBACK removed
- [ ] MIN_QUESTIONS_REQUIRED configured
- [ ] All API keys configured (Azure OpenAI, Judge0)

## Service Health
- [ ] Backend health check passes
- [ ] LLM agent health check passes
- [ ] Database connection verified
- [ ] Vector search enabled in Cosmos DB

## Data Validation
- [ ] No assessments with empty questions array
- [ ] All generated_questions have promptHash
- [ ] All generated_questions have contentHash
- [ ] KnowledgeBase has vector indexing configured

## Testing
- [ ] End-to-end test: Create assessment → Initiate test → Take test
- [ ] Test with llm-agent down → Should fail gracefully
- [ ] Test with invalid assessment → Should return 404
- [ ] Test with empty assessment → Should return 400

## Monitoring
- [ ] Application Insights configured
- [ ] Error alerts configured
- [ ] Question generation failure alerts
- [ ] Cache hit rate monitoring
```

---

## Testing Strategy

### Unit Tests (4 hours)
**File:** `backend/tests/test_question_generation.py`

```python
import pytest
from unittest.mock import AsyncMock, patch

class TestQuestionGeneration:
    
    @pytest.mark.asyncio
    async def test_prompt_hash_caching(self):
        """Test Level 1: Prompt hash deduplication"""
        # Generate question for "python/mcq/medium"
        # Generate again with same params
        # Should reuse cached question (no llm-agent call)
        pass
    
    @pytest.mark.asyncio
    async def test_content_hash_deduplication(self):
        """Test Level 2: Content hash deduplication"""
        # If AI generates duplicate text
        # Should detect and skip storage
        pass
    
    @pytest.mark.asyncio
    async def test_vector_similarity_search(self):
        """Test Level 3: Semantic similarity"""
        # Generate similar questions
        # Should detect via embedding similarity
        pass
    
    @pytest.mark.asyncio
    async def test_hybrid_workflow(self):
        """Test mixing existing + generated questions"""
        # Request: 3 existing + 5 generated
        # Should return 8 total questions
        pass
    
    @pytest.mark.asyncio
    async def test_llm_agent_unavailable(self):
        """Test error handling when llm-agent is down"""
        # Mock llm-agent as unreachable
        # Should return 503 error (not mock data)
        pass
    
    @pytest.mark.asyncio
    async def test_empty_assessment_blocked(self):
        """Test that empty assessments cannot be started"""
        # Create assessment with 0 questions
        # Try to start test
        # Should return 400 error (not mock data)
        pass
```

---

### Integration Tests (4 hours)
**File:** `backend/tests/test_integration.py`

```python
@pytest.mark.integration
async def test_end_to_end_assessment_flow():
    """Test complete flow: Create → Initiate → Start → Complete"""
    
    # Step 1: Create assessment with generation
    response = await client.post("/api/admin/assessments/create", json={
        "title": "Integration Test Assessment",
        "generate": [
            {"skill": "python", "question_type": "mcq", "difficulty": "medium", "count": 5}
        ]
    })
    assert response.status_code == 200
    assessment_id = response.json()["assessment_id"]
    
    # Step 2: Verify questions were generated
    assessment = await db.read_item(CONTAINER["ASSESSMENTS"], assessment_id, assessment_id)
    assert len(assessment["questions"]) == 5
    
    # Step 3: Initiate test
    response = await client.post("/api/admin/tests/initiate", json={
        "assessment_id": assessment_id,
        "candidate_email": "test@example.com",
        "duration_minutes": 60
    })
    assert response.status_code == 200
    test_id = response.json()["test_id"]
    
    # Step 4: Start test (as candidate)
    response = await client.post(f"/api/candidate/assessment/{test_id}/start")
    assert response.status_code == 200
    assert response.json()["question_count"] == 5
    
    # Step 5: Complete test
    # ... submit answers ...
```

---

## Success Metrics

### Phase 1 (Production Safety)
- ✅ Zero mock fallbacks in production code
- ✅ All empty assessments return proper errors
- ✅ 100% assessment validation before test start

### Phase 2 (Generation Flow)
- ✅ Questions generated during test initiation
- ✅ LLM agent health check passes before generation
- ✅ Clear error messages when generation fails

### Phase 3 (Deduplication)
- ✅ Cache hit rate > 60% for repeated generation requests
- ✅ Zero duplicate questions with same content hash
- ✅ Semantic duplicates detected at >95% similarity

### Phase 4 (Hybrid Workflow)
- ✅ Can mix existing + generated questions
- ✅ High-quality questions promoted to questions container
- ✅ Usage counts tracked accurately

---

## Rollback Plan

### If Issues Arise
1. **Keep mock fallbacks in separate branch** (for emergency rollback)
2. **Feature flags for new deduplication logic**
3. **Gradual rollout** (enable for test users first)
4. **Monitor error rates** (should not exceed 0.1%)

### Emergency Rollback
```powershell
# Revert to previous version
git checkout main~1

# Disable strict mode temporarily
$env:STRICT_MODE="false"
$env:ALLOW_EMPTY_ASSESSMENTS="true"

# Restart services
cd backend; uv run uvicorn main:app --reload
```

---

## Timeline Summary

| Phase                         | Priority | Time          | Dependencies |
| ----------------------------- | -------- | ------------- | ------------ |
| Phase 1: Production Safety    | 🔴 URGENT | 4-6 hrs       | None         |
| Phase 2: Generation Flow      | 🔴 URGENT | 6-8 hrs       | Phase 1      |
| Phase 3: Deduplication        | 🟡 HIGH   | 8-10 hrs      | Phase 2      |
| Phase 4: Hybrid Workflow      | 🟢 MEDIUM | 4-6 hrs       | Phase 3      |
| Phase 5: Quality Improvements | 🔵 LOW    | 4-6 hrs       | Phase 4      |
| Phase 6: DevOps & Monitoring  | 🔵 LOW    | 2-4 hrs       | All phases   |
| **TOTAL**                     |          | **28-40 hrs** |              |

**Recommended Sprint Plan:**
- **Week 1:** Phases 1-2 (Production blockers)
- **Week 2:** Phase 3 (Deduplication)
- **Week 3:** Phases 4-6 (Enhancements)

---

## Next Steps

### Immediate Actions (Today)
1. ✅ Review this implementation plan
2. ⏳ Create GitHub issues for each phase
3. ⏳ Set up development branch: `fix/question-generation-system`
4. ⏳ Start Phase 1, Task 1.1 (Remove mock fallbacks)

### This Week
- Complete Phase 1 (Production Safety)
- Complete Phase 2 (Generation Flow)
- Deploy to staging environment
- Run end-to-end integration tests

### Next Week
- Complete Phase 3 (Deduplication)
- Monitor cache hit rates
- Adjust similarity thresholds

---

**Ready to proceed? Let me know which phase to start implementing first!** 🚀
