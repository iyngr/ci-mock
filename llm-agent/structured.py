from __future__ import annotations
from typing import Any, Dict, Optional, Tuple
from pydantic import BaseModel, Field
import json

# Pydantic schemas for structured outputs the agents produce

class CriterionFeedback(BaseModel):
    name: str
    score: float = Field(ge=0, le=100)
    comment: Optional[str] = None

class AnalystOutput(BaseModel):
    overall_score: float = Field(ge=0, le=100)
    criteria: list[CriterionFeedback] = Field(default_factory=list)
    strengths: Optional[list[str]] = None
    improvements: Optional[list[str]] = None

class QuestionRewrite(BaseModel):
    rewritten_text: str
    suggested_role: str
    suggested_tags: list[str]


def try_parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Best-effort parse of a JSON object possibly surrounded by text."""
    if not text:
        return None
    # Attempt direct parse first
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass
    # Extract first {...} block
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        snippet = text[start : end + 1]
        try:
            obj = json.loads(snippet)
            if isinstance(obj, dict):
                return obj
        except Exception:
            return None
    return None


def parse_analyst_output(text: str) -> Optional[AnalystOutput]:
    data = try_parse_json_object(text)
    if not data:
        return None
    try:
        return AnalystOutput(**data)
    except Exception:
        return None


def parse_question_rewrite(text: str) -> Optional[QuestionRewrite]:
    data = try_parse_json_object(text)
    if not data:
        return None
    try:
        return QuestionRewrite(**data)
    except Exception:
        return None
