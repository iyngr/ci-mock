from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from typing import List, Dict, Any, Tuple
import time
import asyncio
import os
from datetime import datetime
import uuid

from models import (
    ScoringTriageRequest, ScoringTriageResponse,
    MCQValidationRequest, MCQBatchValidationRequest, MCQBatchValidationResponse,
    MCQScoreResult, LLMScoreResult,
    QuestionType, MCQQuestion, DescriptiveQuestion, CodingQuestion,
    Submission, Assessment, Answer
)
from database import CosmosDBService, get_cosmosdb_service
from constants import CONTAINER  # added near imports

router = APIRouter()

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
USE_AZURE_OPENAI = os.getenv("USE_AZURE_OPENAI", "false").lower() == "true"


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
        
        # 6. Update submission in database
        await self._update_submission_scores(submission_id, total_score, percentage, {
            "mcq_results": [result.model_dump() for result in mcq_results],
            "llm_results": [result.model_dump() for result in llm_results]
        })
        
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
            submission = Submission(**submission_data)
            assessment_data = await self.db.read_item(
                CONTAINER["ASSESSMENTS"], submission.assessment_id, partition_key=submission.target_role if hasattr(submission, 'target_role') and submission.target_role else "general"
            ) if False else await self.db.find_one(CONTAINER["ASSESSMENTS"], {"id": submission.assessment_id})
            if not assessment_data:
                raise HTTPException(status_code=404, detail="Assessment not found")
            assessment = Assessment(**assessment_data)
            return submission, assessment
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")
    
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
            score, feedback = await self._evaluate_with_text_analyst(
                question.text, answer.submitted_answer, question.rubric
            )
        else:
            # Mock evaluation for development
            score, feedback = await self._mock_text_evaluation(
                question.text, answer.submitted_answer
            )
        
        points_awarded = score * question.points
        
        return LLMScoreResult(
            question_id=answer.question_id,
            score=score,
            feedback=feedback,
            points_awarded=points_awarded
        )
    
    async def _score_coding_question(
        self, answer: Answer, question: CodingQuestion
    ) -> LLMScoreResult:
        """Score coding question using Code_Analyst agent"""
        
        if USE_AZURE_OPENAI and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY:
            # Use actual Azure OpenAI + Judge0 for evaluation
            score, feedback = await self._evaluate_with_code_analyst(
                question, answer.submitted_answer, answer.evaluation
            )
        else:
            # Mock evaluation for development
            score, feedback = await self._mock_code_evaluation(
                question.text, answer.submitted_answer
            )
        
        points_awarded = score * question.points
        
        return LLMScoreResult(
            question_id=answer.question_id,
            score=score,
            feedback=feedback,
            points_awarded=points_awarded
        )
    
    async def _evaluate_with_text_analyst(
        self, question_text: str, answer_text: str, rubric: str = None
    ) -> Tuple[float, str]:
        """Evaluate descriptive answer using Azure OpenAI Text_Analyst"""
        # TODO: Implement Azure OpenAI integration
        # This would make a call to Azure OpenAI with specialized prompts
        await asyncio.sleep(1)  # Simulate API call
        return 0.85, "Good understanding demonstrated with clear explanations."
    
    async def _evaluate_with_code_analyst(
        self, question: CodingQuestion, code: str, execution_result = None
    ) -> Tuple[float, str]:
        """Evaluate coding answer using Azure OpenAI Code_Analyst"""
        # TODO: Implement Azure OpenAI integration with code analysis
        # This would analyze code quality, correctness, efficiency
        await asyncio.sleep(1.5)  # Simulate API call
        return 0.9, "Code is correct and well-structured with good practices."
    
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
        
        total_points = sum(r.points_awarded for r in mcq_results) + \
                      sum(r.points_awarded for r in llm_results)
        
        max_points = sum(r.points_awarded if r.correct else 
                        self._get_max_points_for_question(r.question_id) for r in mcq_results) + \
                    sum(self._get_max_points_for_question(r.question_id) for r in llm_results)
        
        percentage = (total_points / max_points * 100) if max_points > 0 else 0
        
        return total_points, max_points, percentage
    
    def _get_max_points_for_question(self, question_id: str) -> float:
        """Get maximum points for a question - simplified for now"""
        return 1.0  # This should lookup actual question points
    
    async def _update_submission_scores(
        self, submission_id: str, total_score: float, percentage: float, 
        detailed_results: Dict[str, Any]
    ):
        """Update submission with calculated scores"""
        try:
            await self.db.update_item(
                CONTAINER["SUBMISSIONS"],
                submission_id,
                {
                    "score": percentage,
                    "detailed_evaluation": detailed_results,
                    "evaluated_at": datetime.utcnow().isoformat(),
                    "evaluation_method": "hybrid_scoring_v1"
                },
                partition_key=submission_id  # retained but logically PK is assessment_id; for now using find/update fallback
            )
        except Exception as e:
            print(f"Failed to update submission scores: {e}")


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
        # Fetch the question to get correct answer
        question_data = await db.get_item(
            "questions", request.question_id, partition_key="mcq"
        )
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
        raise HTTPException(status_code=500, detail=f"Submission scoring failed: {str(e)}")


@router.get("/health")
async def scoring_health_check():
    """Health check endpoint for scoring service"""
    return {
        "status": "healthy",
        "service": "hybrid_scoring",
        "version": "1.0.0",
        "azure_openai_enabled": USE_AZURE_OPENAI,
        "timestamp": datetime.utcnow().isoformat()
    }


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
        "timestamp": datetime.utcnow().isoformat(),
        "service": "hybrid_scoring"
    }
    
    # In production, this would go to analytics/monitoring service
    print(f"Scoring Analytics: {analytics_record}")
