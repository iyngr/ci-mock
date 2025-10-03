"""Centralized constants for Cosmos DB containers and utilities."""
from typing import Dict
import re
import os

# ===== Production Safety Settings =====
# These settings ensure production-ready behavior with proper validation

# STRICT_MODE: When true, disables all development fallbacks and enforces production behavior
STRICT_MODE = os.getenv("STRICT_MODE", "true").lower() == "true"

# MIN_QUESTIONS_REQUIRED: Minimum questions required in an assessment before allowing test start
MIN_QUESTIONS_REQUIRED = int(os.getenv("MIN_QUESTIONS_REQUIRED", "1"))

# ALLOW_EMPTY_ASSESSMENTS: If false, block assessment creation with 0 questions
ALLOW_EMPTY_ASSESSMENTS = os.getenv("ALLOW_EMPTY_ASSESSMENTS", "false").lower() == "true"

# LLM_AGENT_TIMEOUT: Timeout in seconds for llm-agent service calls
LLM_AGENT_TIMEOUT = int(os.getenv("LLM_AGENT_TIMEOUT", "120"))

# LLM_AGENT_MAX_RETRIES: Maximum retry attempts for llm-agent calls
LLM_AGENT_MAX_RETRIES = int(os.getenv("LLM_AGENT_MAX_RETRIES", "3"))

# LLM_AGENT_URL: URL of the llm-agent microservice for Autogen multi-agent operations
LLM_AGENT_URL = os.getenv("LLM_AGENT_URL", "http://localhost:8001")

# ===== Auto-Submission Timer Settings =====
# These settings control server-side timer enforcement and auto-submission

# AUTO_SUBMIT_ENABLED: Enable server-side auto-submission when timer expires
AUTO_SUBMIT_ENABLED = os.getenv("AUTO_SUBMIT_ENABLED", "true").lower() == "true"

# AUTO_SUBMIT_GRACE_PERIOD: Grace period in seconds after expiration before forcing auto-submit
AUTO_SUBMIT_GRACE_PERIOD = int(os.getenv("AUTO_SUBMIT_GRACE_PERIOD", "30"))

# TIMER_SYNC_INTERVAL: How often frontend should sync timer with backend (seconds)
TIMER_SYNC_INTERVAL = int(os.getenv("TIMER_SYNC_INTERVAL", "60"))

# ===== Container Definitions =====

# Container definitions with intended partition key fields (logical keys, not paths)
COLLECTIONS: Dict[str, Dict[str, str]] = {
    "ASSESSMENTS": {"name": "assessments", "pk_field": "id"},
    "SUBMISSIONS": {"name": "submissions", "pk_field": "assessment_id"},
    "USERS": {"name": "users", "pk_field": "id"},
    "QUESTIONS": {"name": "questions", "pk_field": "skill"},
    "GENERATED_QUESTIONS": {"name": "generated_questions", "pk_field": "skill"},
    "KNOWLEDGE_BASE": {"name": "KnowledgeBase", "pk_field": "skill"},
    "CODE_EXECUTIONS": {"name": "code_executions", "pk_field": "submission_id"},
    "EVALUATIONS": {"name": "evaluations", "pk_field": "submission_id"},
    "REPORTS": {"name": "reports", "pk_field": "submission_id"},
    "RAG_QUERIES": {"name": "RAGQueries", "pk_field": "assessment_id"},
    # New: S2S interview docs and transcripts
    "INTERVIEWS": {"name": "interviews", "pk_field": "assessment_id"},
    "INTERVIEW_TRANSCRIPTS": {"name": "interview_transcripts", "pk_field": "assessment_id"},
    # Bulk upload session storage for admins to review/confirm uploads
    "BULK_UPLOAD_SESSIONS": {"name": "bulk_upload_sessions", "pk_field": "id"},
}

# Default embedding dimensionality used for KnowledgeBase entries (Azure OpenAI small embedding model)
EMBEDDING_DIM: int = 1536

# Convenience single-source names
CONTAINER = {k: v["name"] for k, v in COLLECTIONS.items()}


def normalize_skill(value: str) -> str:
    """Normalize a skill string into a stable partition key slug.

    Steps:
    - Trim
    - Lowercase
    - Collapse whitespace to single hyphen
    - Remove disallowed chars (keep alnum & hyphen)
    - Strip leading/trailing hyphens
    Returns original value if falsy.
    """
    if not value:
        return value
    v = value.strip().lower()
    v = re.sub(r"\s+", "-", v)
    v = re.sub(r"[^a-z0-9-]", "", v)
    v = re.sub(r"-+", "-", v).strip('-')
    return v or value  # fallback if becomes empty
