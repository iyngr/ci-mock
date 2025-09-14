"""Centralized constants for Cosmos DB containers and utilities."""
from typing import Dict
import re

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
    "RAG_QUERIES": {"name": "RAGQueries", "pk_field": "assessment_id"},
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
