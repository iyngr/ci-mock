from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import os
import httpx
import re
from datetime import datetime

from database import CosmosDBService, get_cosmosdb_service
from constants import CONTAINER

router = APIRouter()


# ------------ Models ------------

class StartSessionRequest(BaseModel):
    assessment_id: str = Field(..., alias="assessmentId")
    login_code: str = Field(..., alias="loginCode")
    candidate_name: Optional[str] = Field(None, alias="candidateName")


class StartSessionResponse(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    token: str
    expires_at: datetime = Field(..., alias="expiresAt")


class EphemeralKeyResponse(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    ephemeral_key: str = Field(..., alias="ephemeralKey")
    webrtc_url: str = Field(..., alias="webrtcUrl")
    voice: str
    region: str
    expires_at: int = Field(..., alias="expiresAt")
    disabled: Optional[bool] = False


class CodeSubmitRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = None
    submission_id: Optional[str] = Field(None, alias="submissionId")


class FinalizeTranscriptRequest(BaseModel):
    assessment_id: str = Field(..., alias="assessmentId")
    session_id: str = Field(..., alias="sessionId")
    candidate_id: Optional[str] = Field(None, alias="candidateId")
    consent_at: Optional[str] = Field(None, alias="consentAt")
    transcript: Dict[str, Any]
    submission_id: Optional[str] = Field(None, alias="submissionId")


class InterviewPlanResponse(BaseModel):
    assessment_id: str = Field(..., alias="assessmentId")
    role: Optional[str] = None
    duration_minutes: int = 60
    sections: list[dict] = []


# ------------ Dependencies ------------

async def get_cosmosdb() -> CosmosDBService:
    from main import database_client
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)


def _redact_pii(text: str) -> str:
    if not text:
        return text

    # Safer redaction approach to avoid catastrophic backtracking on attacker-controlled input.
    # 1) Use bounded quantifiers for email/local-part and domain sections.
    # 2) For very large inputs, redact token-by-token (split on whitespace) and skip extremely long tokens.

    # Bounded regexes (limits chosen to follow typical email/phone length constraints)
    email_re = re.compile(r"[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,}", flags=re.IGNORECASE)
    phone_re = re.compile(r"\b\+?\d[\d\s().-]{7,20}\b")

    # Thresholds
    MAX_TEXT_LEN = 20000  # if input longer than this, use safe tokenized processing
    MAX_TOKEN_LEN = 1000  # skip processing tokens longer than this to avoid regex work on pathological tokens

    if len(text) <= MAX_TEXT_LEN:
        text = email_re.sub("[redacted-email]", text)
        text = phone_re.sub("[redacted-phone]", text)
        return text

    # For very long text, process in whitespace-separated chunks, preserving whitespace
    parts = re.split(r"(\s+)", text)
    out_parts = []
    for part in parts:
        if not part:
            continue
        # Preserve whitespace separators
        if part.isspace():
            out_parts.append(part)
            continue

        # Skip expensive processing for extremely long tokens
        if len(part) > MAX_TOKEN_LEN:
            out_parts.append("[redacted-long]")
            continue

        p = email_re.sub("[redacted-email]", part)
        p = phone_re.sub("[redacted-phone]", p)
        out_parts.append(p)

    return "".join(out_parts)


def _redact_transcript(obj: Any) -> Any:
    if isinstance(obj, str):
        return _redact_pii(obj)
    if isinstance(obj, list):
        return [_redact_transcript(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _redact_transcript(v) for k, v in obj.items()}
    return obj


@router.post("/session", response_model=StartSessionResponse)
async def create_interview_session(payload: StartSessionRequest, db: CosmosDBService = Depends(get_cosmosdb)):
    """Create a logical interview session document for S2S flow.
    This doesn't start Realtime; it tracks the session metadata in Cosmos.
    """
    session_id = f"s2s_{payload.login_code}_{int(datetime.utcnow().timestamp())}"

    item = {
        "id": session_id,
        "assessment_id": payload.assessment_id,
        "login_code": payload.login_code,
        "candidate_name": payload.candidate_name,
        "status": "created",
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.auto_create_item(CONTAINER["INTERVIEWS"], item)

    # Mint a short-lived token (opaque for now). For dev, reuse session_id.
    expires_at = datetime.utcnow()
    return StartSessionResponse(sessionId=session_id, token=session_id, expiresAt=expires_at)


@router.get("/plan", response_model=InterviewPlanResponse)
async def get_interview_plan(assessmentId: str, db: CosmosDBService = Depends(get_cosmosdb)):
    """Return a simple question plan for the live interview.
    In production, this should derive from the existing assessment configuration.
    """
    try:
        # Attempt to load from assessments container
        query = "SELECT c.id, c.role, c.duration, c.questions FROM c WHERE c.id = @id"
        params = [{"name": "@id", "value": assessmentId}]
        rows = await db.query_items(CONTAINER["ASSESSMENTS"], query, params)
        if rows:
            row = rows[0]
            duration = row.get("duration", 60)
            sections = [{"title": "Live Q&A", "items": row.get("questions", [])}]
            return InterviewPlanResponse(assessmentId=assessmentId, role=row.get("role"), duration_minutes=duration, sections=sections)
    except Exception:
        pass
    # Fallback mock
    return InterviewPlanResponse(
        assessmentId=assessmentId,
        role="general",
        duration_minutes=60,
        sections=[
            {"title": "Intro", "items": [{"type": "icebreaker", "prompt": "Tell me about yourself."}]},
            {"title": "Coding", "items": [{"type": "coding", "language": "python", "prompt": "Reverse a string."}]},
            {"title": "Systems", "items": [{"type": "descriptive", "prompt": "Explain CAP theorem."}]},
        ],
    )


@router.post("/realtime/ephemeral", response_model=EphemeralKeyResponse)
async def mint_ephemeral_key(authorization: Optional[str] = Header(None)):
    """Server-side mint of ephemeral key for WebRTC as per Azure docs.
    Requires AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_REALTIME_DEPLOYMENT.
    Uses API key header (not returned to client).
    """
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    deployment = os.getenv("AZURE_OPENAI_REALTIME_DEPLOYMENT", "gpt-4o-mini-realtime-preview")
    api_version = os.getenv("AZURE_OPENAI_REALTIME_API_VERSION", "2025-04-01-preview")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    region = os.getenv("AZURE_OPENAI_REALTIME_REGION", "eastus2")
    voice = os.getenv("AZURE_OPENAI_REALTIME_VOICE", "verse")

    # Dev-mode stub: if Azure envs are not configured, return a disabled payload
    if not (endpoint and api_key):
        session_id = f"dev_{int(datetime.utcnow().timestamp())}"
        webrtc_url = "https://invalid.local/realtimertc"
        # expires_at as epoch seconds
        expires_at = int(datetime.utcnow().timestamp()) + 55
        return EphemeralKeyResponse(
            sessionId=session_id,
            ephemeralKey="dev_ephemeral_disabled",
            webrtcUrl=webrtc_url,
            voice=voice,
            region=region,
            expiresAt=expires_at,
            disabled=True,
        )

    sessions_url = f"{endpoint}/openai/realtimeapi/sessions?api-version={api_version}"

    body = {"model": deployment, "voice": voice}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            sessions_url,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
            },
            json=body,
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=f"Failed to mint ephemeral key: {resp.text}")
        data = resp.json()

    ephemeral = data.get("client_secret", {}).get("value")
    session_id = data.get("id")
    expires_at = data.get("expires_at")

    if not ephemeral:
        raise HTTPException(status_code=500, detail="Ephemeral key missing in response")

    webrtc_url = f"https://{region}.realtimeapi-preview.ai.azure.com/v1/realtimertc"
    return EphemeralKeyResponse(sessionId=session_id, ephemeralKey=ephemeral, webrtcUrl=webrtc_url, voice=voice, region=region, expiresAt=expires_at)


@router.post("/code/submit")
async def proxy_code_submit(payload: CodeSubmitRequest):
    """Proxy to existing Judge0 run-code endpoint.
    This keeps frontend simple and lets us evolve execution backend freely.
    """
    api_base = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{api_base}/api/utils/run-code",
            json={
                "language": payload.language,
                "code": payload.code,
                "stdin": payload.stdin,
                "submission_id": payload.submission_id,
            },
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()


@router.post("/finalize")
async def finalize_transcript(payload: FinalizeTranscriptRequest, db: CosmosDBService = Depends(get_cosmosdb)):
    """Store final transcript JSON in Cosmos. Redact common PII before persist.
    We store a small header doc in 'interviews' and a full transcript in 'interview_transcripts'.
    """
    # Redact transcript
    redacted = _redact_transcript(payload.transcript)

    # Header update
    header_id = payload.session_id
    update = {
        "status": "finalized",
        "finalized_at": datetime.utcnow().isoformat(),
    }
    try:
        await db.update_item(CONTAINER["INTERVIEWS"], header_id, update, partition_key=payload.assessment_id)
    except Exception:
        # If update fails (e.g., dev), ignore
        pass

    # Store transcript body
    document = {
        "id": f"tx_{payload.session_id}",
        "assessment_id": payload.assessment_id,
        "session_id": payload.session_id,
        "candidate_id": payload.candidate_id,
        "consent_at": payload.consent_at,
        "schema_version": 1,
        "retention_policy_months": 6,
        "transcript": redacted,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.auto_create_item(CONTAINER["INTERVIEW_TRANSCRIPTS"], document)
    # Optionally trigger scoring pipeline if submissionId provided
    if payload.submission_id:
        api_base = os.getenv("INTERNAL_API_BASE", "http://localhost:8000")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                await client.post(f"{api_base}/api/scoring/process-submission", json={"submission_id": payload.submission_id})
        except Exception:
            # Non-fatal for finalize
            pass
    return {"success": True}
