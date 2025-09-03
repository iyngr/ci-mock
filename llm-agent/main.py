import asyncio
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from autogen_agentchat.ui import Console
from autogen_agentchat.conditions import MaxMessageTermination
from agents import create_assessment_team, create_question_generation_team, model_client
from logging_config import get_logger

# Configure application logger
logger = get_logger("main")

# Debug mode configuration
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
CONSOLE_UI_ENABLED = os.getenv("CONSOLE_UI_ENABLED", "false").lower() == "true"

app = FastAPI(
    title="Smart Mock AI Service",
    description="A multi-agent service for scoring, reporting, and question generation using Microsoft AutoGen."
)

# Pydantic models for request validation
class GenerateReportRequest(BaseModel):
    submission_id: str
    debug_mode: bool = False  # Allow per-request debug mode

class GenerateQuestionRequest(BaseModel):
    skill: str
    question_type: str
    difficulty: str
    debug_mode: bool = False  # Allow per-request debug mode

class DebugInteractionRequest(BaseModel):
    """Request model for debug console interactions"""
    task: str
    team_type: str = "assessment"  # "assessment" or "question_generation"

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Starting Smart Mock AI Service with Microsoft AutoGen")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    await model_client.close()
    logger.info("Smart Mock AI Service shutdown complete")

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {"status": "healthy", "service": "Smart Mock AI Service"}

@app.post("/generate-report")
async def generate_report(request: GenerateReportRequest) -> Dict[str, Any]:
    """
    Initiates a multi-agent workflow to score and generate a report for a submission.
    
    This endpoint uses the Microsoft AutoGen AgentChat framework with SelectorGroupChat
    to orchestrate multiple specialized agents for comprehensive assessment evaluation.
    """
    try:
        logger.info(f"Starting report generation for submission_id: {request.submission_id}")
        
        # Create the assessment team
        assessment_team = create_assessment_team()
        
        # Define the task for the team
        task = f"Please generate a comprehensive assessment report for submission_id: '{request.submission_id}'. Follow the complete workflow: fetch data, score MCQs, analyze coding and text responses, then synthesize the final report."
        
        # Initialize console for debug mode if enabled
        console = None
        if request.debug_mode or DEBUG_MODE:
            console = Console()
            logger.info("Debug mode enabled - agent conversations will be displayed")
        
        # Run the assessment workflow
        result_stream = assessment_team.run_stream(task=task)
        
        # Collect the conversation and extract the final report
        conversation_messages = []
        final_report = "No report generated."
        
        async for message in result_stream:
            # Debug console output if enabled
            if console:
                console.print(message)
                
            conversation_messages.append({
                "source": message.source if hasattr(message, 'source') else "system",
                "content": message.content if hasattr(message, 'content') else str(message)
            })
            
            # Look for the final report
            if hasattr(message, 'content') and isinstance(message.content, str):
                if "FINAL REPORT:" in message.content:
                    final_report = message.content
        
        logger.info(f"Report generation completed for submission_id: {request.submission_id}")
        
        return {
            "submission_id": request.submission_id,
            "report": final_report,
            "conversation_summary": f"Generated through {len(conversation_messages)} agent interactions",
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error generating report for submission_id {request.submission_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")

@app.post("/generate-question")
async def generate_question(request: GenerateQuestionRequest) -> Dict[str, Any]:
    """
    Uses a multi-agent workflow to generate a new assessment question.
    
    This endpoint leverages the question generation team to create contextually
    appropriate questions with proper caching and validation.
    """
    try:
        logger.info(f"Starting question generation for skill: {request.skill}, type: {request.question_type}, difficulty: {request.difficulty}")
        
        # Create the question generation team
        question_team = create_question_generation_team()
        
        # Define the task for question generation
        task = f"Generate a {request.difficulty} level {request.question_type} question for the skill: {request.skill}. Ensure the question follows platform standards and includes proper formatting."
        
        # Run the question generation workflow
        result_stream = question_team.run_stream(task=task)
        
        # Collect the results
        generated_question = None
        conversation_messages = []
        
        async for message in result_stream:
            conversation_messages.append({
                "source": message.source if hasattr(message, 'source') else "system",
                "content": message.content if hasattr(message, 'content') else str(message)
            })
            
            # Extract the generated question
            if hasattr(message, 'content') and isinstance(message.content, str):
                # Look for JSON-formatted question or structured output
                if any(keyword in message.content.lower() for keyword in ["question", "problem", "statement"]):
                    generated_question = message.content
        
        logger.info(f"Question generation completed for skill: {request.skill}")
        
        return {
            "skill": request.skill,
            "question_type": request.question_type,
            "difficulty": request.difficulty,
            "question": generated_question or "Question generation in progress",
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error generating question for skill {request.skill}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")

@app.post("/assess-submission")
async def assess_submission(request: GenerateReportRequest):
    """
    Direct assessment endpoint that provides real-time scoring.
    
    This is a streamlined version that focuses on immediate scoring
    without the full report generation workflow.
    """
    try:
        logger.info(f"Starting direct assessment for submission_id: {request.submission_id}")
        
        # Create assessment team
        assessment_team = create_assessment_team()
        
        # Simplified task for quick assessment
        task = f"Provide immediate scoring assessment for submission_id: '{request.submission_id}'. Focus on generating scores and brief feedback for each question type."
        
        # Run assessment
        result_stream = assessment_team.run_stream(task=task)
        
        # Extract scoring results
        scores = {}
        feedback = []
        
        async for message in result_stream:
            if hasattr(message, 'content') and isinstance(message.content, str):
                # Look for scoring information
                content = message.content.lower()
                if "score" in content or "points" in content:
                    feedback.append({
                        "source": message.source if hasattr(message, 'source') else "system",
                        "content": message.content
                    })
        
        return {
            "submission_id": request.submission_id,
            "scores": scores,
            "feedback": feedback,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error assessing submission {request.submission_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Assessment failed: {str(e)}")

@app.get("/agents/status")
async def get_agents_status() -> Dict[str, Any]:
    """
    Get the status of all available agents and their capabilities.
    """
    try:
        return {
            "agents": {
                "orchestrator": {
                    "name": "Orchestrator_Agent",
                    "role": "Project manager and workflow coordinator",
                    "status": "active"
                },
                "code_analyst": {
                    "name": "Code_Analyst_Agent", 
                    "role": "Code evaluation specialist",
                    "status": "active"
                },
                "text_analyst": {
                    "name": "Text_Analyst_Agent",
                    "role": "Descriptive answer evaluation expert",
                    "status": "active"
                },
                "report_synthesizer": {
                    "name": "Report_Synthesizer_Agent",
                    "role": "Final report compilation",
                    "status": "active"
                },
                "user_proxy": {
                    "name": "Admin_User_Proxy",
                    "role": "Tool execution and administrative tasks",
                    "status": "active"
                }
            },
            "model_client": {
                "type": "AzureOpenAIChatCompletionClient",
                "status": "connected"
            },
            "framework": "Microsoft AutoGen AgentChat",
            "version": "0.4.0"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@app.post("/debug/console-interaction")
async def debug_console_interaction(request: DebugInteractionRequest) -> Dict[str, Any]:
    """
    Debug endpoint for console-based agent interactions.
    Allows interactive debugging of agent conversations.
    """
    if not (DEBUG_MODE or CONSOLE_UI_ENABLED):
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    
    try:
        logger.info(f"Starting debug console interaction for task: {request.task}")
        
        # Create the appropriate team
        if request.team_type == "question_generation":
            team = create_question_generation_team()
        else:
            team = create_assessment_team()
        
        # Initialize console UI for debugging
        console = Console()
        
        if CONSOLE_UI_ENABLED:
            # Run with console UI (will show in terminal)
            result_stream = team.run_stream(
                task=request.task,
                termination_condition=MaxMessageTermination(max_messages=5)
            )
            
            # Process messages for both console display and API response
            messages = []
            async for message in result_stream:
                # Display in console for debugging
                console.print(message)
                
                # Collect for API response
                messages.append({
                    "source": getattr(message, 'source', 'system'),
                    "content": getattr(message, 'content', str(message)),
                    "timestamp": str(asyncio.get_event_loop().time())
                })
        else:
            # API-only mode without console output
            result_stream = team.run_stream(task=request.task)
            messages = []
            async for message in result_stream:
                messages.append({
                    "source": getattr(message, 'source', 'system'), 
                    "content": getattr(message, 'content', str(message)),
                    "timestamp": str(asyncio.get_event_loop().time())
                })
        
        return {
            "task": request.task,
            "team_type": request.team_type,
            "messages": messages,
            "console_enabled": CONSOLE_UI_ENABLED,
            "debug_mode": DEBUG_MODE,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Debug console interaction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Debug interaction failed: {str(e)}")


@app.get("/debug/status")
async def debug_status() -> Dict[str, Any]:
    """Get debug mode and console UI status"""
    return {
        "debug_mode": DEBUG_MODE,
        "console_ui_enabled": CONSOLE_UI_ENABLED,
        "environment_vars": {
            "DEBUG_MODE": os.getenv("DEBUG_MODE", "false"),
            "CONSOLE_UI_ENABLED": os.getenv("CONSOLE_UI_ENABLED", "false")
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
