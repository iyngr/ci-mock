from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Tuple, Optional
import time
import asyncio
import os
from datetime import datetime
from datetime_utils import now_ist, now_ist_iso
import uuid
import json
from functools import lru_cache

import httpx

from models import (
    ScoringTriageRequest, ScoringTriageResponse,
    MCQValidationRequest, MCQBatchValidationRequest, MCQBatchValidationResponse,
    MCQScoreResult, LLMScoreResult,
    QuestionType, MCQQuestion, DescriptiveQuestion, CodingQuestion,
    MCQOption, SubmissionStatus,
    Submission, Assessment, Answer,
    EvaluationRecord, EvaluationSummary, SubmissionEvaluationField
)
from database import CosmosDBService, get_cosmosdb_service
from constants import CONTAINER  # added near imports

router = APIRouter()

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
USE_AZURE_OPENAI = os.getenv("USE_AZURE_OPENAI", "false").lower() == "true"
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")
AZURE_OPENAI_DEPLOYMENT = (
    os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    or os.getenv("AZURE_OPENAI_DEPLOYMENT")
)

# NOTE: We intentionally do NOT fall back to AZURE_OPENAI_MODEL at runtime.
# Use AZURE_OPENAI_DEPLOYMENT_NAME to specify the Azure deployment (e.g. "gpt-5-mini").
# If a legacy AZURE_OPENAI_MODEL env var is present, warn the operator but do not use it.
if os.getenv("AZURE_OPENAI_MODEL"):
    print("Warning: AZURE_OPENAI_MODEL is set but is no longer used at runtime. Please set AZURE_OPENAI_DEPLOYMENT_NAME to your Azure deployment (e.g., 'gpt-5-mini').")

LLM_AGENT_URL = os.getenv("LLM_AGENT_URL", "http://localhost:8080")
LLM_HTTP_TIMEOUT = float(os.getenv("LLM_HTTP_TIMEOUT", "8.0"))
LLM_MAX_RETRIES = int(os.getenv("LLM_MAX_RETRIES", "2"))
DB_WRITE_TIMEOUT_S = float(os.getenv("DB_WRITE_TIMEOUT_S", "6.0"))

# --------- Rubric & Azure helpers ---------
@lru_cache(maxsize=1)
def _rubric_fallback() -> Dict[str, Any]:
    return {
        "weights": {
            "communication": 0.20,
            "problemSolving": 0.20,
            "codingCorrectness": 0.30,
            "codingEfficiency": 0.15,
            "explanationQuality": 0.15,
        },
        "bands": {
            "0-39": "Below expectations",
            "40-59": "Developing",
            "60-74": "Solid",
            "75-89": "Strong",
            "90-100": "Exceptional",
        },
        "anchorDescriptors": {}
    }

@lru_cache(maxsize=4)
def _rubric_cache_key(name: str) -> str:
    return name

async def _get_default_rubric(name: str = "default") -> Dict[str, Any]:
    """Fetch rubric JSON from llm-agent, with fallback to embedded default."""
    url = f"{LLM_AGENT_URL.rstrip('/')}/rubrics/{name}"
    try:
        async with httpx.AsyncClient(timeout=LLM_HTTP_TIMEOUT) as client:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json() or {}
                return data.get("rubric") or data
    except Exception:
        pass
    return _rubric_fallback()


def _build_rubric_prompt(
    question_text: str,
    submission_text: str,
    criteria: List[str],
    weights: Dict[str, float],
    extra_instructions: str = "",
    is_code: bool = False,
    language: Optional[str] = None,
) -> str:
    crit_str = ", ".join(criteria)
    lang_line = f"Language: {language}\n" if language else ""
    code_line = "Submission is CODE.\n" if is_code else "Submission is TEXT.\n"
    return f"""
You are an impartial evaluator. Score the candidate submission against the specified criteria.

STRICT POLICIES:
- Never reveal correct solutions or implementation details
- Do not suggest improvements; only evaluate
- Return STRICT JSON that conforms to the schema below

Context:
{lang_line}{code_line}
Question: {question_text}
Submission: {submission_text}
Additional Rubric Notes: {extra_instructions}

Criteria to score in [0.0..1.0]: {crit_str}
Weights (for your awareness): {weights}

Respond ONLY with a minified JSON object of this exact shape:
{{
  "scores": {{"<criterion>": <float 0..1>}},
  "rationales": {{"<criterion>": "<one-line reason>"}}
}}
""".strip()


async def _call_azure_json(prompt: str) -> Dict[str, Any]:
    """Call Azure OpenAI Chat Completions expecting a JSON object. Retries with backoff and honors timeout."""
    if not (USE_AZURE_OPENAI and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY and AZURE_OPENAI_DEPLOYMENT):
        return {}
    url = f"{AZURE_OPENAI_ENDPOINT.rstrip('/')}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
    headers = {
        "api-key": AZURE_OPENAI_API_KEY,
        "content-type": "application/json",
    }
    # Build payload and adapt parameters for GPT-5 deployments
    body = {
        "messages": [
            {"role": "system", "content": "You return STRICT JSON only."},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
    }
    dep = (AZURE_OPENAI_DEPLOYMENT or "").lower()
    # For GPT-5 family deployments, prefer `max_completion_tokens` and do not send temperature/top_p
    if dep and ("gpt-5" in dep or dep.startswith("gpt5") or "gpt5" in dep):
        body["max_completion_tokens"] = 400
    else:
        # Older models expect temperature and max_tokens
        body["temperature"] = 0.0
        body["max_tokens"] = 400
    delay = 0.5
    for attempt in range(LLM_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=LLM_HTTP_TIMEOUT) as client:
                resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 200:
                data = resp.json() or {}
                choices = data.get("choices") or []
                if choices and choices[0].get("message", {}).get("content"):
                    content = choices[0]["message"]["content"]
                    try:
                        return json.loads(content)
                    except Exception:
                        return {}
            elif resp.status_code in (429, 500, 502, 503, 504) and attempt < LLM_MAX_RETRIES:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 4.0)
                continue
            else:
                return {}
        except Exception:
            if attempt < LLM_MAX_RETRIES:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 4.0)
                continue
            return {}
    return {}


def _extract_breakdown(result: Dict[str, Any], criteria: List[str]) -> Dict[str, float]:
    scores = (result or {}).get("scores", {})
    out: Dict[str, float] = {}
    for c in criteria:
        v = scores.get(c, 0.5)
        try:
            out[c] = max(0.0, min(1.0, float(v)))
        except Exception:
            out[c] = 0.5
    return out


def _weighted_score(breakdown: Dict[str, float], weights: Dict[str, float]) -> float:
    total_w = 0.0
    acc = 0.0
    for k, v in breakdown.items():
        w = float(weights.get(k, 0.0))
        if w > 0:
            acc += v * w
            total_w += w
    return (acc / total_w) if total_w > 0 else 0.0


def _format_feedback(breakdown: Dict[str, float], rubric: Dict[str, Any]) -> str:
    weights = rubric.get("weights", {})
    pct = int(round(_weighted_score(breakdown, weights) * 100))
    band_label = _band_for_percent(pct, rubric.get("bands", {}))
    top_dims = sorted(breakdown.items(), key=lambda kv: kv[1], reverse=True)[:2]
    top_txt = ", ".join([f"{k}: {int(v*100)}%" for k, v in top_dims])
    return f"Overall {pct}% ({band_label}). Strongest dimensions: {top_txt}."


def _band_for_percent(percent: int, bands: Dict[str, str]) -> str:
    for rng, label in bands.items():
        try:
            lo, hi = rng.split("-")
            if int(lo) <= percent <= int(hi):
                return label
        except Exception:
            continue
    return "Unspecified"


def _summarize_execution(execution_result: Optional[Any]) -> str:
    if not execution_result:
        return "no execution context"
    try:
        passed = getattr(execution_result, 'passed', None)
        if passed is None and isinstance(execution_result, dict):
            passed = execution_result.get('passed')
        return f"passed={passed}"
    except Exception:
        return "execution context available"


# Database dependency
async def get_cosmosdb() -> CosmosDBService:
    """Get Cosmos DB service dependency"""
    from main import database_client
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)


class ScoringTriageService:
    """Main service for hybrid scoring workflow"""
    
    def __init__(self, db: CosmosDBService):
        self.db = db
    
    async def process_submission(self, submission_id: str) -> ScoringTriageResponse:
        """Main orchestration method for hybrid scoring"""
        start_time = time.time()
        
        # 1. Fetch submission and assessment data
        submission, assessment = await self._fetch_submission_data(submission_id)
        # Build a quick lookup map of question_id -> points for accurate max point calculation
        try:
            self._assessment_questions_map = {q.id: getattr(q, 'points', 1.0) for q in assessment.questions}
        except Exception:
            self._assessment_questions_map = {}
        
        # 2. Separate answers by question type
        mcq_answers, descriptive_answers, coding_answers = await self._categorize_answers(
            submission, assessment
        )
        
        # 3. Score MCQs directly (fast and cheap)
        mcq_results = await self._score_mcq_batch(mcq_answers, assessment)
        
        # 4. Score descriptive and coding questions with LLM agents (parallel)
        llm_results = await self._score_llm_questions(
            descriptive_answers, coding_answers, assessment
        )
        
        # 5. Calculate final scores and update submission
        total_score, max_score, percentage = self._calculate_final_scores(
            mcq_results, llm_results
        )
        
        # 6. Persist full evaluation record + submission summary
        evaluation_record_id = await self._persist_full_evaluation(
            submission, assessment, total_score, max_score, percentage,
            mcq_results, llm_results, start_time
        )
        await self._update_submission_summary(
            submission_id, total_score, percentage, max_score,
            mcq_results, llm_results, evaluation_record_id
        )
        
        evaluation_time = time.time() - start_time
        
        return ScoringTriageResponse(
            submission_id=submission_id,
            total_score=total_score,
            max_possible_score=max_score,
            percentage_score=percentage,
            mcq_results=mcq_results,
            llm_results=llm_results,
            evaluation_time=evaluation_time,
            cost_breakdown={
                "mcq_calls": len(mcq_answers),
                "llm_calls": len(descriptive_answers) + len(coding_answers),
                "estimated_tokens": len(descriptive_answers) * 500 + len(coding_answers) * 800
            }
        )
    
    async def _fetch_submission_data(self, submission_id: str) -> Tuple[Submission, Assessment]:
        """Fetch submission and corresponding assessment"""
        try:
            # Fetch submission
            submission_data = await self.db.find_one(
                CONTAINER["SUBMISSIONS"], {"id": submission_id}
            )
            if not submission_data:
                raise HTTPException(status_code=404, detail="Submission not found")
            assessment_id = submission_data.get("assessment_id")
            if not assessment_id:
                raise HTTPException(status_code=500, detail="Submission missing assessment_id")
            # Remove Cosmos DB SDK metadata fields (e.g., _rid, _self, _etag, _ts)
            submission_data = {k: v for k, v in submission_data.items() if not (isinstance(k, str) and k.startswith("_"))}

            # Defensive normalization: remove any accidental runtime-added keys (e.g., partition_key)
            if 'partition_key' in submission_data:
                submission_data.pop('partition_key', None)

            # Remove evaluation summary fields that may have been added by prior runs or dev helpers
            for extra_key in ('evaluated_at', 'evaluatedAt', 'evaluation'):
                if extra_key in submission_data:
                    submission_data.pop(extra_key, None)

            # Normalize assessment id key (support both alias and pythonic names)
            assessment_id = submission_data.get("assessment_id") or submission_data.get("assessmentId")
            if not assessment_id:
                raise HTTPException(status_code=500, detail="Submission missing assessment_id")

            # Normalize answers to use the alias-style keys Answer expects (questionId, questionType, submittedAnswer, timeSpent)
            # Some write paths persist snake_case keys (question_id, submitted_answer, etc.). Convert them here so Pydantic
            # validation (which expects alias keys on Answer) succeeds regardless of storage shape.
            raw_answers = submission_data.get('answers', []) or []
            normalized_answers = []
            for a in raw_answers:
                if isinstance(a, dict):
                    # Build a new dict containing alias keys only
                    na = {}
                    # direct alias-preserving (if already stored in alias form)
                    if 'questionId' in a:
                        na['questionId'] = a.get('questionId')
                    if 'questionType' in a:
                        na['questionType'] = a.get('questionType')
                    if 'submittedAnswer' in a:
                        na['submittedAnswer'] = a.get('submittedAnswer')
                    if 'timeSpent' in a:
                        na['timeSpent'] = a.get('timeSpent')

                    # snake_case fallbacks
                    if 'question_id' in a and 'questionId' not in na:
                        na['questionId'] = a.get('question_id')
                    if 'question_type' in a and 'questionType' not in na:
                        na['questionType'] = a.get('question_type')
                    if 'submitted_answer' in a and 'submittedAnswer' not in na:
                        na['submittedAnswer'] = a.get('submitted_answer')
                    if 'time_spent' in a and 'timeSpent' not in na:
                        na['timeSpent'] = a.get('time_spent')

                    # Preserve evaluation object if present
                    if 'evaluation' in a:
                        na['evaluation'] = a.get('evaluation')

                    # If still empty (unexpected shape), keep original dict to let Pydantic produce a helpful error
                    normalized_answers.append(na if na else a)
                else:
                    # Not a dict (already model instance or other), keep as-is
                    normalized_answers.append(a)

            submission_data['answers'] = normalized_answers

            # Instantiate Pydantic Submission model (populate_by_name enabled)
            submission = Submission(**submission_data)

            assessment_data = await self.db.find_one(CONTAINER["ASSESSMENTS"], {"id": submission.assessment_id})
            if not assessment_data:
                raise HTTPException(status_code=404, detail="Assessment not found")
            # Strip SDK metadata from assessment document before validation
            assessment_data = {k: v for k, v in assessment_data.items() if not (isinstance(k, str) and k.startswith("_"))}

            # Remove any runtime-inserted partition keys or other unexpected extras that
            # may have been persisted by dev helpers or other services. This function
            # walks the document and strips keys named 'partition_key' or 'partitionKey'.
            def _strip_partition_keys(obj):
                if isinstance(obj, dict):
                    for bad in ('partition_key', 'partitionKey'):
                        if bad in obj:
                            obj.pop(bad, None)
                    for v in obj.values():
                        _strip_partition_keys(v)
                elif isinstance(obj, list):
                    for item in obj:
                        _strip_partition_keys(item)

            _strip_partition_keys(assessment_data)

            assessment = Assessment(**assessment_data)
            return submission, assessment
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.exception("Failed to fetch submission or assessment data")
            raise HTTPException(status_code=500, detail="Failed to fetch submission or assessment data")
    
    async def _categorize_answers(
        self, submission: Submission, assessment: Assessment
    ) -> Tuple[List[Tuple[Answer, MCQQuestion]], List[Tuple[Answer, DescriptiveQuestion]], List[Tuple[Answer, CodingQuestion]]]:
        """Categorize answers by question type"""
        
        # Create question lookup
        question_lookup = {q.id: q for q in assessment.questions}
        
        mcq_answers = []
        descriptive_answers = []
        coding_answers = []
        
        for answer in submission.answers:
            question = question_lookup.get(answer.question_id)
            if not question:
                continue
                
            if question.type == QuestionType.MCQ:
                mcq_answers.append((answer, question))
            elif question.type == QuestionType.DESCRIPTIVE:
                descriptive_answers.append((answer, question))
            elif question.type == QuestionType.CODING:
                coding_answers.append((answer, question))
        
        return mcq_answers, descriptive_answers, coding_answers
    
    async def _score_mcq_batch(
        self, mcq_answers: List[Tuple[Answer, MCQQuestion]], assessment: Assessment
    ) -> List[MCQScoreResult]:
        """Score all MCQ questions via direct database lookup"""
        results = []
        
        for answer, question in mcq_answers:
            selected_option_id = answer.submitted_answer
            correct_option_id = question.correct_answer
            is_correct = selected_option_id == correct_option_id
            points_awarded = question.points if is_correct else 0.0
            
            results.append(MCQScoreResult(
                question_id=answer.question_id,
                correct=is_correct,
                selected_option_id=selected_option_id,
                correct_option_id=correct_option_id,
                points_awarded=points_awarded
            ))
        
        return results
    
    async def _score_llm_questions(
        self, 
        descriptive_answers: List[Tuple[Answer, DescriptiveQuestion]], 
        coding_answers: List[Tuple[Answer, CodingQuestion]], 
        assessment: Assessment
    ) -> List[LLMScoreResult]:
        """Score descriptive and coding questions using specialized LLM agents"""
        
        tasks = []
        
        # Score descriptive questions with Text_Analyst
        for answer, question in descriptive_answers:
            tasks.append(self._score_descriptive_question(answer, question))
        
        # Score coding questions with Code_Analyst
        for answer, question in coding_answers:
            tasks.append(self._score_coding_question(answer, question))
        
        # Run all LLM evaluations in parallel
        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter out exceptions and return valid results
            valid_results = [r for r in results if isinstance(r, LLMScoreResult)]
            return valid_results
        
        return []
    
    async def _score_descriptive_question(
        self, answer: Answer, question: DescriptiveQuestion
    ) -> LLMScoreResult:
        """Score descriptive question using Text_Analyst agent"""
        
        if USE_AZURE_OPENAI and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
            # Use actual Azure OpenAI for evaluation
            score, feedback, breakdown = await self._evaluate_with_text_analyst(
                question.text, answer.submitted_answer, question.rubric
            )
        else:
            # Mock evaluation for development
            score, feedback = await self._mock_text_evaluation(
                question.text, answer.submitted_answer
            )
            # Create a simple breakdown aligned with descriptive criteria
            _rubric_json = await _get_default_rubric()
            criteria = ["communication", "problemSolving", "explanationQuality"]
            breakdown = {c: score for c in criteria}
        
        points_awarded = score * question.points

        return LLMScoreResult(
            question_id=answer.question_id,
            score=score,
            feedback=feedback,
            rubric_breakdown=breakdown,
            points_awarded=points_awarded
        )
    
    async def _score_coding_question(
        self, answer: Answer, question: CodingQuestion
    ) -> LLMScoreResult:
        """Score coding question using Code_Analyst agent"""
        
        if USE_AZURE_OPENAI and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
            # Use actual Azure OpenAI + Judge0 for evaluation
            score, feedback, breakdown = await self._evaluate_with_code_analyst(
                question, answer.submitted_answer, answer.evaluation
            )
        else:
            # Mock evaluation for development
            score, feedback = await self._mock_code_evaluation(
                question.text, answer.submitted_answer
            )
            # Create a simple breakdown aligned with coding criteria
            _rubric_json = await _get_default_rubric()
            criteria = ["codingCorrectness", "codingEfficiency", "explanationQuality"]
            breakdown = {c: score for c in criteria}
        
        points_awarded = score * question.points

        return LLMScoreResult(
            question_id=answer.question_id,
            score=score,
            feedback=feedback,
            rubric_breakdown=breakdown,
            points_awarded=points_awarded
        )
    
    async def _evaluate_with_text_analyst(
        self, question_text: str, answer_text: str, rubric: Optional[str] = None
    ) -> Tuple[float, str, Dict[str, float]]:
        """Evaluate descriptive answer using Azure OpenAI and rubric; returns (score_0_1, feedback, breakdown)."""
        rubric_json = await _get_default_rubric()
        weights = rubric_json.get("weights", {})
        # Focus on non-coding dimensions for descriptive
        criteria = ["communication", "problemSolving", "explanationQuality"]
        prompt = _build_rubric_prompt(
            question_text=question_text,
            submission_text=answer_text,
            criteria=criteria,
            weights=weights,
            extra_instructions=rubric or "",
        )
        result = await _call_azure_json(prompt)
        breakdown = _extract_breakdown(result, criteria)
        overall = _weighted_score(breakdown, weights)
        feedback = _format_feedback(breakdown, rubric_json)
        return overall, feedback, breakdown
    
    async def _evaluate_with_code_analyst(
        self, question: CodingQuestion, code: str, execution_result: Optional[Any] = None
    ) -> Tuple[float, str, Dict[str, float]]:
        """Evaluate coding answer using Azure OpenAI and rubric; returns (score_0_1, feedback, breakdown)."""
        rubric_json = await _get_default_rubric()
        weights = rubric_json.get("weights", {})
        criteria = ["codingCorrectness", "codingEfficiency", "explanationQuality"]
        exec_context = _summarize_execution(execution_result)
        prompt = _build_rubric_prompt(
            question_text=question.text,
            submission_text=code,
            criteria=criteria,
            weights=weights,
            extra_instructions=f"Execution Context: {exec_context}",
            is_code=True,
            language=question.programming_language.value if hasattr(question.programming_language, 'value') else str(question.programming_language),
        )
        result = await _call_azure_json(prompt)
        breakdown = _extract_breakdown(result, criteria)
        overall = _weighted_score(breakdown, weights)
        feedback = _format_feedback(breakdown, rubric_json)
        return overall, feedback, breakdown
    
    async def _mock_text_evaluation(self, question: str, answer: str) -> Tuple[float, str]:
        """Mock text evaluation for development"""
        await asyncio.sleep(0.5)
        
        if len(answer) < 50:
            return 0.4, "Answer is too brief. Please provide more detailed explanation."
        elif len(answer) > 1000:
            return 0.8, "Comprehensive answer with good coverage of the topic."
        else:
            return 0.7, "Good answer with adequate explanation."
    
    async def _mock_code_evaluation(self, question: str, code: str) -> Tuple[float, str]:
        """Mock code evaluation for development"""
        await asyncio.sleep(0.8)
        
        if "def " in code or "function " in code:
            return 0.85, "Code structure is good with proper function definition."
        elif len(code) < 20:
            return 0.3, "Code solution is incomplete."
        else:
            return 0.6, "Basic code solution provided."
    
    def _calculate_final_scores(
        self, mcq_results: List[MCQScoreResult], llm_results: List[LLMScoreResult]
    ) -> Tuple[float, float, float]:
        """Calculate final scores from all results"""
        total_points = sum(float(r.points_awarded) for r in mcq_results) + \
                       sum(float(r.points_awarded) for r in llm_results)

        # Derive the max possible points from the questions earlier attached to the assessment.
        # We expect the assessment to have been fetched by the caller and available in scope
        # where this helper is called. To keep the function pure, we attempt to look up max
        # points by interrogating each result's question id against the global assessment
        # mapping if available; fallback to 1.0 if not found.
        try:
            # Build a map of question_id -> points from the assessment stored on `self` if present
            # (the caller constructs this service and passes assessment to scoring functions)
            assessment_questions_map = getattr(self, '_assessment_questions_map', None)
        except Exception:
            assessment_questions_map = None

        def _max_for(qid: str) -> float:
            if assessment_questions_map and qid in assessment_questions_map:
                return float(assessment_questions_map[qid])
            return 1.0

        max_points = sum(_max_for(r.question_id) for r in mcq_results) + sum(_max_for(r.question_id) for r in llm_results)

        percentage = (total_points / max_points * 100) if max_points > 0 else 0.0
        # Cap percentage between 0 and 100
        percentage = max(0.0, min(100.0, percentage))

        return total_points, max_points, percentage
    
    def _get_max_points_for_question(self, question_id: str) -> float:
        """Get maximum points for a question - simplified for now"""
        return 1.0  # This should lookup actual question points
    
    async def _persist_full_evaluation(
        self,
        submission: Submission,
        assessment: Assessment,
        total_score: float,
        max_score: float,
        percentage: float,
        mcq_results: List[MCQScoreResult],
        llm_results: List[LLMScoreResult],
        start_time: float
    ) -> str:
        """Create and store full EvaluationRecord, return its ID."""
        duration = time.time() - start_time
        record = EvaluationRecord(
            id=f"eval_{uuid.uuid4().hex[:12]}",
            submissionId=submission.id,
            assessmentId=assessment.id,
            method="hybrid_scoring_v1",
            runSequence=1,  # Future: compute by counting existing evaluations for submission
            timing={
                "started_at": datetime.utcfromtimestamp(start_time).isoformat(),
                "completed_at": now_ist().isoformat(),
                "duration_seconds": duration
            },
            driverVersions={
                "scoring_service": "1.0.0"
            },
            mcqResults=[r.model_dump() for r in mcq_results],
            llmResults=[r.model_dump() for r in llm_results],
            aggregates={
                "total_points": total_score,
                "max_points": max_score,
                "percentage": percentage
            },
            costBreakdown={
                "mcq_calls": len(mcq_results),
                "llm_calls": len(llm_results)
            }
        )
        # Apply a soft timeout to DB write to avoid hanging the scoring pipeline
        try:
            # Dump by_alias=False so top-level `id` and snake_case partition keys are present for Cosmos
            await asyncio.wait_for(
                self.db.auto_create_item(CONTAINER["EVALUATIONS"], record.model_dump(by_alias=False)),
                timeout=DB_WRITE_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            print("Warning: timed out persisting evaluation record; continuing")
        return record.id

    async def _update_submission_summary(
        self,
        submission_id: str,
        total_score: float,
        percentage: float,
        max_score: float,
        mcq_results: List[MCQScoreResult],
        llm_results: List[LLMScoreResult],
        evaluation_record_id: str
    ):
        """Update submission with summary evaluation field."""
        try:
            submission_data = await self.db.find_one(CONTAINER["SUBMISSIONS"], {"id": submission_id})
            if not submission_data:
                raise HTTPException(status_code=404, detail="Submission not found for score update")
            assessment_id = submission_data.get("assessment_id")
            summary = EvaluationSummary(
                totalPoints=total_score,
                maxPoints=max_score,
                percentage=percentage,
                mcqCorrect=sum(1 for r in mcq_results if r.correct),
                mcqTotal=len(mcq_results),
                llmQuestions=len(llm_results)
            )
            evaluation_field = SubmissionEvaluationField(
                method="hybrid_scoring_v1",
                summary=summary,
                latestEvaluationId=evaluation_record_id
            )
            try:
                await asyncio.wait_for(
                    self.db.update_item(
                        CONTAINER["SUBMISSIONS"],
                        submission_id,
                        {
                            "score": percentage,
                            "evaluated_at": now_ist().isoformat(),
                            "evaluation": evaluation_field.model_dump(by_alias=True)
                        },
                        partition_key=assessment_id
                    ),
                    timeout=DB_WRITE_TIMEOUT_S,
                )
            except asyncio.TimeoutError:
                print("Warning: timed out updating submission summary; continuing")
        except Exception as e:
            print(f"Failed to update submission evaluation summary: {e}")


# ===========================
# API ENDPOINTS
# ===========================

@router.post("/validate-mcq", response_model=MCQScoreResult)
async def validate_mcq_answer(
    request: MCQValidationRequest,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Fast MCQ validation endpoint for single questions"""
    
    try:
        # NOTE: Questions container currently partitioned by /skill (target model) or /type (legacy).
        # Since we don't have the partition key here, perform a fallback query by id.
        # This uses find_one which does a cross-partition query (acceptable for low volume path).
        question_data = await db.find_one(CONTAINER["QUESTIONS"], {"id": request.question_id})
        if not question_data:
            raise HTTPException(status_code=404, detail="Question not found")

        question = MCQQuestion(**question_data)
        is_correct = request.selected_option_id == question.correct_answer
        points_awarded = question.points if is_correct else 0.0

        return MCQScoreResult(
            question_id=request.question_id,
            correct=is_correct,
            selected_option_id=request.selected_option_id,
            correct_option_id=question.correct_answer,
            points_awarded=points_awarded
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"MCQ validation failed: {str(e)}")


@router.post("/validate-mcq-batch", response_model=MCQBatchValidationResponse)
async def validate_mcq_batch(
    request: MCQBatchValidationRequest,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Batch MCQ validation for multiple questions"""
    
    results = []
    for mcq_request in request.mcq_answers:
        try:
            result = await validate_mcq_answer(mcq_request, db)
            results.append(result)
        except Exception as e:
            print(f"Failed to validate MCQ {mcq_request.question_id}: {e}")
            continue
    
    total_correct = sum(1 for r in results if r.correct)
    
    return MCQBatchValidationResponse(
        results=results,
        total_correct=total_correct,
        total_questions=len(results)
    )


@router.post("/process-submission", response_model=ScoringTriageResponse)
async def process_submission_scoring(
    request: ScoringTriageRequest,
    background_tasks: BackgroundTasks,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Main endpoint for hybrid scoring workflow"""
    
    try:
        triage_service = ScoringTriageService(db)
        result = await triage_service.process_submission(request.submission_id)
        
        # Log the scoring results in background
        background_tasks.add_task(
            log_scoring_analytics, 
            request.submission_id, 
            result.cost_breakdown,
            result.evaluation_time
        )
        
        return result
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Submission scoring failed")
        raise HTTPException(status_code=500, detail="Submission scoring failed")


# Backwards-compatible endpoint: some clients call /triage
@router.post("/triage", response_model=ScoringTriageResponse)
async def triage_compat(
    request: ScoringTriageRequest,
    background_tasks: BackgroundTasks,
    db: CosmosDBService = Depends(get_cosmosdb)
):
    """Compatibility wrapper for legacy /triage clients.

    Forwards to the new process_submission_scoring implementation to
    avoid duplicating orchestration logic.
    """
    return await process_submission_scoring(request, background_tasks, db)


@router.get("/health")
async def scoring_health_check():
    """Health check endpoint for scoring service"""
    return {
        "status": "healthy",
        "service": "hybrid_scoring",
        "version": "1.0.0",
        "azure_openai_enabled": USE_AZURE_OPENAI,
    "timestamp": now_ist().isoformat()
    }


@router.post("/dev/create-mock-submission")
async def create_mock_submission(db: CosmosDBService = Depends(get_cosmosdb)):
    """Dev-only helper: create a minimal assessment and submission to test scoring end-to-end.

    This will create:
    - an `assessments` document with two questions (one MCQ, one descriptive)
    - a `submissions` document with answers for those questions

    Returns the created submission id.
    """
    # Only enable in non-production environments
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="Not allowed in production")

    # Build Pydantic objects to ensure schema compliance and avoid extra fields
    assessment_id = f"assess_{uuid.uuid4().hex[:8]}"
    q1_id = f"q_{uuid.uuid4().hex[:8]}"
    q2_id = f"q_{uuid.uuid4().hex[:8]}"

    mcq_q = MCQQuestion(
        id=q1_id,
        text="What is 2+2?",
        skill="general",
        options=[
            MCQOption(id="a", text="3"),
            MCQOption(id="b", text="4"),
            MCQOption(id="c", text="5"),
        ],
        correct_answer="b",
        points=1
    )

    desc_q = DescriptiveQuestion(
        id=q2_id,
        text="Explain the concept of a binary search.",
        skill="algorithms",
        points=4
    )

    assessment_obj = Assessment(
        id=assessment_id,
        title="Mock Assessment",
        description="Auto-generated mock assessment for scoring tests",
        duration=30,
        created_by="admin_mock",
        questions=[mcq_q, desc_q]
    )

    submission_id = f"sub_{uuid.uuid4().hex[:8]}"
    now = now_ist()
    # Create Answer objects using aliases/names
    # Create Answer dicts using alias keys so Pydantic expects the correct field names
    ans1_dict = {
        "questionId": q1_id,
        "questionType": QuestionType.MCQ,
        "submittedAnswer": "b",
        "timeSpent": 5
    }
    ans2_dict = {
        "questionId": q2_id,
        "questionType": QuestionType.DESCRIPTIVE,
        "submittedAnswer": "Binary search repeatedly halves the search space...",
        "timeSpent": 120
    }

    # Instantiate Answer models from alias-dicts to validate shape
    ans1 = Answer(**ans1_dict)
    ans2 = Answer(**ans2_dict)

    submission_obj = Submission(
        id=submission_id,
        assessmentId=assessment_id,
        candidateId="candidate_mock",
        status=SubmissionStatus.COMPLETED,
        startTime=now,
        expirationTime=now,
        loginCode=f"code_{uuid.uuid4().hex[:6]}",
        createdBy="admin_mock",
        answers=[ans1, ans2]
    )

    # Persist both documents using by_alias to store expected field names
    try:
        # Dump without aliases to ensure top-level 'id' field is present for Cosmos
        assessment_payload = assessment_obj.model_dump(by_alias=False)
        submission_payload = submission_obj.model_dump(by_alias=False)

        # Ensure partition keys are explicit where our service infers them
        await db.upsert_item(CONTAINER["ASSESSMENTS"], assessment_payload, partition_key=assessment_obj.id)
        await db.upsert_item(CONTAINER["SUBMISSIONS"], submission_payload, partition_key=submission_obj.assessment_id)
        return {"success": True, "submission_id": submission_id, "assessment_id": assessment_id}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to create mock submission")
        # Return a generic failure message; avoid returning tracebacks to clients
        return {"success": False, "message": "Failed to create mock submission"}


@router.get("/dev/evaluations/{submission_id}")
async def dev_get_evaluations(submission_id: str, db: CosmosDBService = Depends(get_cosmosdb)):
    """Dev-only: get evaluations for a submission and the submission doc itself for verification."""
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="Not allowed in production")

    try:
        # Query evaluations by submissionId (snake_case persisted)
        results = await db.find_many(CONTAINER["EVALUATIONS"], {"submission_id": submission_id})
        # Also return the submission document
        submission = await db.find_one(CONTAINER["SUBMISSIONS"], {"id": submission_id})
        return {"evaluations": results, "submission": submission}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to read evaluations for dev endpoint")
        raise HTTPException(status_code=500, detail="Failed to read evaluations")


@router.get("/dev/rag-queries")
async def dev_get_rag_queries(limit: int = 10, db: CosmosDBService = Depends(get_cosmosdb)):
    """Dev-only: return recent RAG_QUERIES entries for telemetry checks."""
    if os.getenv("ENVIRONMENT", "development") == "production":
        raise HTTPException(status_code=403, detail="Not allowed in production")
    try:
        # Simple query to get recent entries (assuming created_at or _ts presence)
        # Fallback: use find_many for compatibility
        results = await db.find_many(CONTAINER["RAG_QUERIES"], {}, limit=limit)
        return {"count": len(results), "items": results}
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception("Failed to read rag queries for dev endpoint")
        raise HTTPException(status_code=500, detail="Failed to read rag queries")


# ===========================
# BACKGROUND TASKS
# ===========================

async def log_scoring_analytics(
    submission_id: str, cost_breakdown: Dict[str, Any], evaluation_time: float
):
    """Log scoring analytics for monitoring and optimization"""
    analytics_record = {
        "id": str(uuid.uuid4()),
        "submission_id": submission_id,
        "cost_breakdown": cost_breakdown,
        "evaluation_time": evaluation_time,
    "timestamp": now_ist().isoformat(),
        "service": "hybrid_scoring"
    }
    
    # In production, this would go to analytics/monitoring service
    print(f"Scoring Analytics: {analytics_record}")
