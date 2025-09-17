from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
import os, time, re
import httpx

router = APIRouter(prefix="/api/live-interview", tags=["live-interview"])

# Environment variables for Azure OpenAI Realtime API
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_REALTIME_DEPLOYMENT = os.getenv("AZURE_OPENAI_REALTIME_DEPLOYMENT", "gpt-4o-mini-realtime-preview")
AZURE_OPENAI_REALTIME_API_VERSION = os.getenv("AZURE_OPENAI_REALTIME_API_VERSION", "2025-04-01-preview")
AZURE_OPENAI_REALTIME_REGION = os.getenv("AZURE_OPENAI_REALTIME_REGION", "eastus2")
AZURE_OPENAI_REALTIME_VOICE = os.getenv("AZURE_OPENAI_REALTIME_VOICE", "verse")

INTERNAL_API_BASE = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")
LLM_AGENT_URL = os.getenv("LLM_AGENT_URL", "http://localhost:8080")

# ---- Models ----
class Judge0Request(BaseModel):
    language: str
    code: str

class Judge0Result(BaseModel):
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    compile_output: Optional[str] = None
    status: Optional[Dict[str, Any]] = None
    time: Optional[str] = None
    memory: Optional[int] = None

class S2STurn(BaseModel):
    role: str  # "user" | "assistant" | "system"
    text: str
    started_at: float
    ended_at: float
    annotations: Optional[Dict[str, Any]] = None

class S2STranscript(BaseModel):
    schema_version: int = 1
    session_id: str
    assessment_id: Optional[str] = None
    candidate_id: Optional[str] = None
    consent_at: Optional[float] = None
    turns: List[S2STurn] = Field(default_factory=list)
    coding_tasks: Optional[List[Dict[str, Any]]] = None
    judge0_results: Optional[List[Dict[str, Any]]] = None
    redaction_info: Optional[Dict[str, Any]] = None
    finalized_at: Optional[float] = None
    
    # Auto-scoring fields for processed transcripts
    scored_at: Optional[float] = None
    assessment_score: Optional[float] = None
    assessment_feedback: Optional[str] = None
    assessment_details: Optional[Dict[str, Any]] = None
    
    # TTL and metadata fields
    retention_months: Optional[int] = 6
    metadata: Optional[Dict[str, Any]] = None


class OrchestrateRequest(BaseModel):
    event: str
    context: Dict[str, Any] = {}
    payload: Optional[Dict[str, Any]] = None

class OrchestrateResponse(BaseModel):
    next: str = "continue"  # continue | ask_followup | interrupt
    prompt: Optional[str] = None
    agent: Optional[str] = None
    reasoning: Optional[str] = None


# ---- Guardrails (lightweight policy) ----
class GuardrailRequest(BaseModel):
    phase: str  # 'pre' or 'post'
    text: str
    intent: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class GuardrailResponse(BaseModel):
    allowed: bool = True
    text: str
    reason: Optional[str] = None


PRE_POLICIES = {
    "clarification_only": "Allowed to restate the problem verbatim-in-meaning; do not add examples, algorithms, edge cases, or code.",
    "hint_or_howto": "Politely refuse hints or approach guidance and restate the policy.",
    "repeat_request": "Repeat exactly, slowly and clearly, without adding details.",
    "eval_submission": "Only ask about intent, trade-offs, and debugging plan; do not suggest fixes or algorithms.",
}

def guardrail_pre(text: str, intent: Optional[str] = None) -> GuardrailResponse:
    lower = (text or "").lower()
    # Simple heuristics to classify intent; can be replaced with llm-agent policy later
    if any(k in lower for k in ["hint", "how do i", "how to", "approach"]):
        return GuardrailResponse(
            allowed=True,
            text=(
                "I can’t provide approach or hints during the assessment. "
                "Please proceed based on the stated requirements."
            ),
            reason=PRE_POLICIES["hint_or_howto"],
        )
    if any(k in lower for k in ["repeat", "say again", "can you repeat"]):
        return GuardrailResponse(
            allowed=True,
            text=text,  # repeat as-is
            reason=PRE_POLICIES["repeat_request"],
        )
    if any(k in lower for k in ["clarify", "clarification", "confused", "explain the question"]):
        return GuardrailResponse(
            allowed=True,
            text=(
                "I can restate the problem without adding examples or guidance. "
                "Please focus on the original requirements."
            ),
            reason=PRE_POLICIES["clarification_only"],
        )
    # Default: allow text unchanged
    return GuardrailResponse(allowed=True, text=text)


def guardrail_post(text: str) -> GuardrailResponse:
    lower = (text or "").lower()
    # Block patterns that leak strategy/algorithms/APIs/complexity
    leak_markers = [
        "big-o", "time complexity", "space complexity",
        "use dijkstra", "use bfs", "use dfs", "two-pointer", "dynamic programming",
        "use hashmap", "use hash map", "use dictionary", "use api",
        "call this api", "import", "library", "code snippet",
    ]
    if any(marker in lower for marker in leak_markers):
        return GuardrailResponse(
            allowed=True,
            text=(
                "I can’t reveal solution strategies or specific APIs during the assessment. "
                "Please proceed according to the stated requirements without additional guidance."
            ),
            reason="post_reflection_scrub",
        )
    return GuardrailResponse(allowed=True, text=text)

# ---- Helpers ----
PII_PATTERNS = [
    re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I),  # Email
    re.compile(r"\+?\d[\d\s\-()]{7,}\d"),  # Phone numbers
]

def redact(text: str) -> str:
    """Redact PII from text"""
    redacted = text
    for pat in PII_PATTERNS:
        redacted = pat.sub("[REDACTED]", redacted)
    return redacted

def redact_transcript(tx: S2STranscript) -> S2STranscript:
    """Redact PII from entire transcript"""
    for t in tx.turns:
        t.text = redact(t.text)
    return tx

# ---- Endpoints ----
@router.get("/plan")
async def get_plan(assessment_id: Optional[str] = None):
    """Get assessment plan by reusing existing candidate endpoints"""
    target = f"{INTERNAL_API_BASE}/api/candidate/assessment"
    params = {}
    if assessment_id:
        params["assessment_id"] = assessment_id
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(target, params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {"plan": data}
    except Exception:
        pass
    
    return {"plan": []}

@router.post("/realtime/ephemeral")
async def mint_ephemeral_session():
    """Create ephemeral session for Azure OpenAI Realtime API"""
    if not AZURE_OPENAI_ENDPOINT or not AZURE_OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="Azure OpenAI is not configured")
    
    url = f"{AZURE_OPENAI_ENDPOINT}/openai/realtimeapi/sessions?api-version={AZURE_OPENAI_REALTIME_API_VERSION}"
    # VAD tunables from environment
    try:
        vad_threshold = float(os.getenv("AZURE_OPENAI_VAD_THRESHOLD", "0.5"))
    except ValueError:
        vad_threshold = 0.5
    try:
        vad_prefix_ms = int(os.getenv("AZURE_OPENAI_VAD_PREFIX_PADDING_MS", "300"))
    except ValueError:
        vad_prefix_ms = 300
    try:
        vad_silence_ms = int(os.getenv("AZURE_OPENAI_VAD_SILENCE_DURATION_MS", "600"))
    except ValueError:
        vad_silence_ms = 600

    payload = {
        "model": AZURE_OPENAI_REALTIME_DEPLOYMENT,
        "voice": AZURE_OPENAI_REALTIME_VOICE,
        # Enable audio+text and server-side VAD for better turn detection
        "modalities": ["audio", "text"],
        "turn_detection": {
            "type": "server_vad",
            "threshold": vad_threshold,
            "prefix_padding_ms": vad_prefix_ms,
            "silence_duration_ms": vad_silence_ms,
        },
    }
    headers = {
        "api-key": AZURE_OPENAI_API_KEY,
        "content-type": "application/json",
    }
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(url, json=payload, headers=headers)
        if r.status_code != 200:
            raise HTTPException(status_code=r.status_code, detail=r.text)
        data = r.json()
    
    # Normalize key fields for clients (keep legacy fields too for compatibility)
    ephemeral_key = (
        data.get("client_secret", {}).get("value")
        if isinstance(data, dict)
        else None
    )
    session_id = data.get("id") if isinstance(data, dict) else None
    expires_at = data.get("expires_at") if isinstance(data, dict) else None
    web_rtc_url = f"https://{AZURE_OPENAI_REALTIME_REGION}.realtimeapi-preview.ai.azure.com/v1/realtimertc"

    return {
        # Raw response for advanced clients
        "ephemeral": data,
        # Normalized fields expected by some frontends
        "sessionId": session_id,
        "ephemeralKey": ephemeral_key,
        "webrtcUrl": web_rtc_url,       # snake-case variant used by some clients
        "webRtcUrl": web_rtc_url,       # camel-case variant already in use
        "expiresAt": expires_at,
        # Context
        "region": AZURE_OPENAI_REALTIME_REGION,
        "voice": AZURE_OPENAI_REALTIME_VOICE,
        # Helper TTL for clients to refresh token
        "expiresInSeconds": 55,
    }

class ModerateRequest(BaseModel):
    text: str
    role: Optional[str] = None

@router.post("/moderate")
async def moderate_text(body: ModerateRequest):
    """Lightweight moderation using Azure AI Content Safety if configured.
    Falls back to 'safe' when not configured.
    """
    endpoint = os.getenv("AZURE_CONTENT_SAFETY_ENDPOINT")
    api_key = os.getenv("AZURE_CONTENT_SAFETY_API_KEY")

    # Default response
    default_resp = {"label": "safe", "categories": [], "scores": {}}

    if not (endpoint and api_key):
        return default_resp

    try:
        url = endpoint.rstrip("/") + "/contentsafety/text:analyze?api-version=2024-09-01"
        payload = {"text": body.text}
        headers = {"Ocp-Apim-Subscription-Key": api_key, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            if r.status_code != 200:
                return default_resp
            result = r.json() or {}
            # Simplify output
            categories = []
            scores = {}
            try:
                # Depending on API variant, adjust extraction
                harms = result.get("categoriesAnalysis") or result.get("harmCategories") or []
                for h in harms:
                    name = h.get("category") or h.get("categoryName")
                    sev = h.get("severity") or h.get("severityResult")
                    if name:
                        categories.append({"category": name, "severity": sev})
                        scores[name] = sev
                label = "safe"
                if any((c.get("severity", "") or "").lower() in ("high", "medium") for c in categories):
                    label = "flagged"
                return {"label": label, "categories": categories, "scores": scores}
            except Exception:
                return default_resp
    except Exception:
        return default_resp


@router.post("/guardrails/enforce", response_model=GuardrailResponse)
async def enforce_guardrails(body: GuardrailRequest):
    if body.phase == "pre":
        return guardrail_pre(body.text, body.intent)
    return guardrail_post(body.text)


@router.post("/orchestrate", response_model=OrchestrateResponse)
async def orchestrate(req: OrchestrateRequest):
    """Proxy orchestration to llm-agent; return graceful defaults if unavailable."""
    # Optional pre-guardrail: if the event is a user clarification/hint, rewrite response plan
    if req.event in {"user_turn_finalized", "user_message"}:
        user_text = (req.payload or {}).get("text") or req.context.get("last_user_text")
        if user_text:
            pre = guardrail_pre(user_text)
            # If pre-policy suggests a restricted response, short-circuit with a policy reminder
            if pre.text != user_text:
                return OrchestrateResponse(next="ask_followup", prompt=pre.text, agent="policy")
    url = f"{LLM_AGENT_URL.rstrip('/')}/live/orchestrate"
    body = {
        "event": req.event,
        "context": req.context,
        "payload": req.payload or {},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json=body)
            if r.status_code == 200:
                data = r.json() or {}
                return OrchestrateResponse(
                    next=data.get("next", "continue"),
                    prompt=data.get("prompt"),
                    agent=data.get("agent"),
                    reasoning=data.get("reasoning"),
                )
    except Exception:
        pass

    # Default fallback behavior
    return OrchestrateResponse(next="continue")

@router.post("/code/submit")
async def submit_code(body: Judge0Request) -> Judge0Result:
    """Forward code submission to existing utils run-code endpoint and push results to LLM-agent"""
    url = f"{INTERNAL_API_BASE}/api/utils/run-code"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(url, json=body.model_dump())
    
    if r.status_code != 200:
        raise HTTPException(status_code=r.status_code, detail=r.text)
    
    result = r.json()
    
    # Push execution results to LLM-agent for intelligent guidance
    await _push_judge0_results_to_llm_agent(body, result)
    
    return result


async def _push_judge0_results_to_llm_agent(request: Judge0Request, result: dict):
    """Push Judge0 execution results to LLM-agent for intelligent guidance"""
    try:
        # Extract session and question context from request
        session_id = getattr(request, 'session_id', None) or 'unknown_session'
        question_id = getattr(request, 'question_id', None) or 'unknown_question'
        
        # Prepare Judge0 result data for LLM-agent
        judge0_payload = {
            "session_id": session_id,
            "question_id": question_id,
            "submission_token": result.get("token", "unknown"),
            "status": result.get("status", {}).get("description", "unknown"),
            "stdout": result.get("stdout"),
            "stderr": result.get("stderr"),
            "compile_output": result.get("compile_output"),
            "time": result.get("time"),
            "memory": result.get("memory"),
            "exit_code": result.get("exit_code"),
            "test_passed": None,  # Could be enhanced with test result parsing
            "test_total": None
        }
        
        # Get LLM-agent URL from environment or use default
        llm_agent_url = os.getenv("LLM_AGENT_URL", "http://localhost:8080")
        endpoint_url = f"{llm_agent_url}/live/judge0-result"
        
        # Send results to LLM-agent (non-blocking, fire-and-forget)
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(endpoint_url, json=judge0_payload)
            
            if response.status_code == 200:
                guidance_data = response.json()
                # Could store guidance in transcript or return to frontend
                print(f"LLM-agent guidance: {guidance_data.get('guidance', 'No guidance provided')}")
            else:
                print(f"LLM-agent guidance request failed: {response.status_code}")
                
    except Exception as e:
        # Non-fatal - don't block code execution results
        print(f"Failed to send Judge0 results to LLM-agent: {str(e)}")
        pass

@router.post("/finalize")
async def finalize_transcript(req: Request, transcript: S2STranscript):
    """Finalize and persist interview transcript with PII redaction"""
    # Redact PII and set finalization timestamp
    redacted = redact_transcript(transcript)
    redacted.finalized_at = time.time()

    # Try to store if a Mongo client is configured in app.state
    try:
        db = getattr(req.app.state, "db", None)
        if db:
            coll = db.get_collection("interview_transcripts")
            doc = redacted.model_dump()
            # TTL can be set at collection level; include retention metadata
            doc["retention_months"] = 6
            await coll.update_one(
                {"session_id": doc["session_id"]}, 
                {"$set": doc}, 
                upsert=True
            )
    except Exception:
        # Non-fatal in dev
        pass

    # Optionally kick off scoring via existing scoring router if available
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(
                f"{INTERNAL_API_BASE}/api/scoring/process-submission", 
                json={"session_id": redacted.session_id}
            )
    except Exception:
        pass

    return {"ok": True}