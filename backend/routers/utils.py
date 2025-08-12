from fastapi import APIRouter, HTTPException
from models import CodeExecutionRequest, EvaluationRequest
import httpx
import asyncio

router = APIRouter()


@router.post("/run-code")
async def run_code(request: CodeExecutionRequest):
    """Execute code using Judge0 API (mock implementation for now)"""
    
    # Mock code execution for development
    # In production, this would call the actual Judge0 API
    await asyncio.sleep(1)  # Simulate execution time
    
    if "error" in request.code.lower():
        return {
            "success": False,
            "error": "Compilation error: syntax error on line 1",
            "executionTime": 0.5
        }
    
    # Mock successful execution
    mock_output = "Output from code execution"
    if "print" in request.code.lower():
        mock_output = "Hello, World!"
    elif "return" in request.code.lower():
        mock_output = "Function executed successfully"
    
    return {
        "success": True,
        "output": mock_output,
        "executionTime": 1.2
    }


@router.post("/evaluate")
async def evaluate_result(request: EvaluationRequest):
    """Evaluate a completed test using AI (mock implementation)"""
    
    # Mock AI evaluation
    await asyncio.sleep(2)  # Simulate AI processing time
    
    # In production, this would:
    # 1. Fetch the result from database
    # 2. Evaluate each answer (MCQ, coding tests, descriptive via LLM)
    # 3. Generate overall score and summary
    # 4. Update the result in database
    
    mock_evaluation = {
        "overallScore": 85.0,
        "competencyScores": {
            "Programming": 90.0,
            "Problem Solving": 80.0,
            "System Design": 85.0
        },
        "finalSummary": "The candidate demonstrated strong technical skills with excellent programming abilities. Shows good understanding of algorithms and data structures. Could improve on system design concepts."
    }
    
    return {
        "success": True,
        "evaluation": mock_evaluation,
        "message": "Result evaluated successfully"
    }