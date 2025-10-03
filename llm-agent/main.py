import asyncio
import os
from fastapi import FastAPI, HTTPException
from werkzeug.utils import secure_filename
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
from autogen_agentchat.ui import Console
from autogen_agentchat.conditions import MaxMessageTermination
from agents import create_assessment_team, create_question_generation_team, create_question_rewriting_team, model_client
from logging_config import get_logger
import json
from functools import lru_cache
from pathlib import Path

# Configure application logger
logger = get_logger("main")

# Debug mode configuration
DEBUG_MODE = os.getenv("DEBUG_MODE", "false").lower() == "true"
CONSOLE_UI_ENABLED = os.getenv("CONSOLE_UI_ENABLED", "false").lower() == "true"

app = FastAPI(
    title="Smart Mock AI Service",
    description="A multi-agent service for scoring, reporting, and question generation using Microsoft AutoGen."
)

# CORS for local dev (Talens and Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"  # dev only
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

class QuestionValidationRequest(BaseModel):
    """Request model for question validation"""
    question_text: str

class QuestionRewriteRequest(BaseModel):
    """Request model for question rewriting and enhancement"""
    question_text: str


class AutogenScoringResponse(BaseModel):
    """Structured response from Autogen scoring workflow"""
    submission_id: str
    llm_results: list[Dict[str, Any]]  # List of LLMScoreResult-compatible dicts
    agent_conversation: list[Dict[str, Any]] | None = None  # Optional debug info
    scoring_summary: Dict[str, Any] | None = None  # Overall scoring metadata
    status: str = "success"


class ReportGenerationResponse(BaseModel):
    """Structured response from Autogen report generation workflow"""
    submission_id: str
    report: Dict[str, Any]  # Structured report data
    executive_summary: str  # High-level overview
    detailed_analysis: str  # Full report content
    recommendations: list[str]  # Actionable recommendations
    competency_breakdown: Dict[str, Any] | None = None  # Skills analysis
    agent_conversation: list[Dict[str, Any]] | None = None  # Optional debug info
    generation_metadata: Dict[str, Any] | None = None  # Timing, agent stats
    status: str = "success"


# Live S2S analyzer/orchestrator models
class LiveAnalyzeRequest(BaseModel):
    text: str
    question_type: str | None = None  # "descriptive" | "coding" | etc.
    min_tokens: int = 30
    persona: str | None = None  # interviewer persona name

class LiveAnalyzeResponse(BaseModel):
    decision: str  # CONTINUE | PROBE
    reason: str
    follow_up: str | None = None

class LiveOrchestrateRequest(BaseModel):
    event: str  # answer_submitted | timer_expired | code_result
    context: Dict[str, Any] | None = None

class LiveOrchestrateResponse(BaseModel):
    next: str  # ask_followup | next_question | request_clarification
    prompt: str | None = None

class Judge0ResultRequest(BaseModel):
    session_id: str
    question_id: str
    submission_token: str
    status: str  # "accepted", "wrong_answer", "compilation_error", etc.
    stdout: str | None = None
    stderr: str | None = None
    compile_output: str | None = None
    time: float | None = None
    memory: int | None = None
    exit_code: int | None = None
    test_passed: bool | None = None
    test_total: int | None = None

class Judge0ResultResponse(BaseModel):
    guidance: str  # AI-generated guidance based on execution results
    next_action: str  # "continue" | "retry" | "hint" | "move_on"
    encouragement: str | None = None

# --- Smart Screen (resume) ---
class ResumeScreenRequest(BaseModel):
    mode: str = "auto"  # auto | customized
    role: str | None = None
    domain: str | None = None
    skills: list[str] | None = None
    resume_text: str

class ResumeScreenResponse(BaseModel):
    summary: list[str]
    recommendation: str


AI_STATUS: dict[str, dict[str, any]] = {"chat": {"ok": False, "details": "not validated"}, "embedding": {"ok": False, "details": "not validated"}}


async def call_llm(client, messages, **kwargs):
    """Wrapper around model_client.create that handles GPT-5 family differences.

    - Removes unsupported params like `temperature` and `top_p` for GPT-5 deployments
    - Maps `max_tokens` -> `max_completion_tokens` for GPT-5 if present
    - Falls back gracefully for older clients
    """
    # Normalize messages: AutoGen clients expect autogen_core LLMMessage types
    # (SystemMessage / UserMessage / AssistantMessage). Allow callers to pass
    # simple dicts (role/content) or plain strings and convert them here.
    try:
        from autogen_core.models import SystemMessage, UserMessage, AssistantMessage
    except Exception:
        SystemMessage = None
        UserMessage = None
        AssistantMessage = None

    normalized_messages = []
    if messages:
        for m in messages:
            # If already an object the client understands, pass through
            if SystemMessage and isinstance(m, (SystemMessage, UserMessage, AssistantMessage)):
                normalized_messages.append(m)
                continue

            # If it's a BaseChatMessage-like object with .to_model_message, use that
            if hasattr(m, "to_model_message"):
                try:
                    normalized_messages.append(m.to_model_message())
                    continue
                except Exception:
                    pass

            # If dict with role/content, map to appropriate autogen_core model
            if isinstance(m, dict):
                role = (m.get("role") or m.get("type") or "user").lower()
                content = m.get("content")
                if role == "system" and SystemMessage:
                    normalized_messages.append(SystemMessage(content=content))
                    continue
                if role == "assistant" and AssistantMessage:
                    # assistant messages may include 'thought' or function_call
                    try:
                        normalized_messages.append(AssistantMessage(content=content, source=m.get("source", "assistant")))
                        continue
                    except Exception:
                        pass
                # default to UserMessage
                if UserMessage:
                    normalized_messages.append(UserMessage(content=content, source=m.get("source", "user")))
                    continue

            # If it's a string, wrap as UserMessage (source=user)
            if isinstance(m, str) and UserMessage:
                normalized_messages.append(UserMessage(content=m, source="user"))
                continue

            # Fallback: pass as-is
            normalized_messages.append(m)

    else:
        normalized_messages = messages

    # Use normalized_messages for the rest of the function
    messages = normalized_messages

    # Determine whether we're targeting GPT-5 family based on deployment or model env vars
    # Require deployment name to be set. Prefer deployment env var over legacy model name.
    dep = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    if not dep:
        # Fail fast: deployment name is required to avoid accidentally targeting wrong model
        raise RuntimeError(
            "AZURE_OPENAI_DEPLOYMENT_NAME is required and not set. Set it to your Azure deployment (e.g. gpt-5-mini)."
        )
    # Do NOT use legacy AZURE_OPENAI_MODEL for runtime behavior. Require deployment name.
    is_gpt5 = False
    # Determine whether we're targeting GPT-5 family based on deployment name
    try:
        if "gpt-5" in dep or dep.startswith("gpt5") or "gpt5" in dep:
            is_gpt5 = True
    except Exception:
        is_gpt5 = False

    params = dict(kwargs) if kwargs else {}
    if is_gpt5:
        # GPT-5 family doesn't accept temperature/top_p in many configurations; remove them
        params.pop("temperature", None)
        params.pop("top_p", None)
        # Map max_tokens to max_completion_tokens which newer models expect
        if "max_tokens" in params:
            params["max_completion_tokens"] = params.pop("max_tokens")

    try:
        return await client.create(messages=messages, **params)
    except TypeError as te:
        # Some client implementations (or newer model families) don't accept
        # `max_tokens` while others expect `max_completion_tokens`. Attempt a
        # sequence of fallbacks:
        # 1) Map `max_tokens` -> `max_completion_tokens` and retry
        # 2) If that fails, try mapping back (if needed)
        # 3) Finally, strip token-related kwargs and retry
        logger.debug(f"client.create TypeError: {te}; attempting fallback key mapping")
        fallback = dict(params)
        # If caller provided max_tokens, try the newer name first
        if "max_tokens" in fallback and "max_completion_tokens" not in fallback:
            fallback["max_completion_tokens"] = fallback.pop("max_tokens")

        # Also be defensive: if only max_completion_tokens present but the
        # underlying client expects max_tokens, ensure both paths are tried
        if "max_completion_tokens" in fallback and "max_tokens" not in fallback:
            # keep a copy for the next retry attempt
            fallback2 = dict(fallback)
            fallback2["max_tokens"] = fallback2.get("max_completion_tokens")
        else:
            fallback2 = None

        # Try the first fallback
        try:
            return await client.create(messages=messages, **fallback)
        except TypeError as te2:
            logger.debug(f"Fallback client.create failed: {te2}")
            # Try the alternate mapping if available
            if fallback2:
                try:
                    return await client.create(messages=messages, **fallback2)
                except TypeError as te3:
                    logger.debug(f"Alternate fallback also failed: {te3}")

            # Last resort: strip token/generation params that may be unsupported
            stripped = dict(params)
            for k in ("max_tokens", "max_completion_tokens", "temperature", "top_p"):
                stripped.pop(k, None)

            logger.debug("Retrying client.create with token/generation params removed as last resort")
            return await client.create(messages=messages, **stripped)


async def _validate_azure_openai() -> None:
    """Proactively validate Azure OpenAI chat & embedding deployments so we fail fast with clear guidance.

    Populates global AI_STATUS. We intentionally swallow exceptions after recording them so the
    service can still start and fallback logic (rule-based rewriting, heuristics) continues to work.
    """
    global AI_STATUS
    chat_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME") or "(unset)"
    # Do not rely on AZURE_OPENAI_MODEL at runtime. If present, warn operators.
    model_name = "(unset)"
    if os.getenv("AZURE_OPENAI_MODEL"):
        print("Warning: AZURE_OPENAI_MODEL is set but is ignored at runtime. Use AZURE_OPENAI_DEPLOYMENT_NAME instead.")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or "(unset)"
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview")

    # Validate chat deployment by issuing a tiny test request (max_tokens=1) if possible.
    try:
        test_messages = [
            {"role": "system", "content": "health-check"},
            {"role": "user", "content": "Reply with OK"},
        ]
        _ = await call_llm(model_client, test_messages, temperature=0.0, max_tokens=1)
        AI_STATUS["chat"] = {
            "ok": True,
            "deployment": chat_deployment,
            "model": model_name,
            "api_version": api_version,
            "endpoint": endpoint,
            "details": "validated",
        }
        logger.info(
            "Azure OpenAI chat deployment validated: deployment=%s model=%s api_version=%s",
            chat_deployment,
            model_name,
            api_version,
        )
    except Exception as e:
        # Record short error hint for status and log full exception
        err_line = str(e).splitlines()[0]
        AI_STATUS["chat"] = {
            "ok": False,
            "deployment": chat_deployment,
            "model": model_name,
            "api_version": api_version,
            "endpoint": endpoint,
            "error": "chat validation failed",
            "action": "Verify deployment name exists in Azure OpenAI resource and matches AZURE_OPENAI_DEPLOYMENT_NAME; confirm model is deployed and API version is supported.",
        }
        logger.exception("Azure OpenAI chat deployment validation failed: %s", err_line)

    # Validate embedding deployment (optional)
    embed_dep = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT") or os.getenv("EMBEDDING_MODEL")
    if embed_dep:
        try:
            try:
                import openai  # type: ignore
            except Exception as imp_err:
                raise RuntimeError(f"openai SDK not importable: {imp_err}")
            openai_client = openai.AsyncAzureOpenAI(
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
            )
            _ = await openai_client.embeddings.create(model=embed_dep, input="ping")
            AI_STATUS["embedding"] = {
                "ok": True,
                "deployment": embed_dep,
                "details": "validated",
            }
            logger.info("Azure OpenAI embedding deployment validated: deployment=%s", embed_dep)
        except Exception as e:  # pragma: no cover - network path
            err_line = str(e).splitlines()[0]
            AI_STATUS["embedding"] = {
                "ok": False,
                "deployment": embed_dep,
                "error": "embedding validation failed",
                "action": "Create embedding deployment or update AZURE_OPENAI_EMBED_DEPLOYMENT to an existing one.",
            }
            logger.exception("Azure OpenAI embedding deployment validation failed: %s", err_line)
    else:
        AI_STATUS["embedding"] = {"ok": False, "details": "no deployment specified (optional)"}

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Starting Smart Mock AI Service with Microsoft AutoGen")
    # Fire validation but don't block startup if it fails
    try:
        await _validate_azure_openai()
    except Exception as e:  # pragma: no cover - defensive
        logger.exception("AI validation encountered unexpected error")

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    await model_client.close()
    logger.info("Smart Mock AI Service shutdown complete")

@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Smart Mock AI Service",
        "ai": {
            "chat": AI_STATUS.get("chat", {}),
            "embedding": AI_STATUS.get("embedding", {}),
        },
    }

@app.get("/ai/status")
async def ai_status() -> Dict[str, Any]:
    """Detailed AI deployment validation status."""
    return {"ai": AI_STATUS}


@app.post("/live/analyze", response_model=LiveAnalyzeResponse)
async def live_analyze(req: LiveAnalyzeRequest) -> Dict[str, Any]:
    """AI-powered analyzer using Azure OpenAI for intelligent interview guidance.
    Policies:
    - Never reveal answers or provide step-by-step solution code
    - Ask probing questions to assess deeper understanding
    - Maintain professional interviewer persona
    - Focus on problem-solving approach, not solutions
    """
    try:
        # Build context-aware prompt for analysis
        analysis_prompt = f"""You are an experienced technical interviewer conducting a live assessment. Your role is to analyze a candidate's response and decide whether to probe deeper or continue to the next question.

STRICT POLICIES:
- NEVER reveal the correct answer or provide solution steps
- NEVER give hints about the implementation
- Focus on understanding the candidate's thought process
- Ask probing questions about approach, trade-offs, and considerations

Question Type: {req.question_type}
Question: {req.question}
Candidate's Answer: {req.text}
Minimum Expected Length: {req.min_tokens} words
Current Length: {len((req.text or "").split())} words

Based on the candidate's response, decide:
1. PROBE - if the answer needs more depth, clarity, or shows gaps in understanding
2. CONTINUE - if the answer demonstrates sufficient understanding for this stage

If you decide to PROBE, provide a follow-up question that:
- Explores their reasoning without giving hints
- Asks about considerations, trade-offs, or edge cases
- Encourages them to elaborate on their approach
- Tests deeper understanding of concepts

Respond in this exact JSON format:
{{
    "decision": "PROBE" or "CONTINUE",
    "reason": "Clear explanation of your decision",
    "follow_up": "Your probing question (null if CONTINUE)"
}}"""

        # Use Azure OpenAI to analyze the response
        messages = [
            {"role": "system", "content": "You are an expert technical interviewer. Analyze responses and provide intelligent guidance while never revealing solutions."},
            {"role": "user", "content": analysis_prompt}
        ]

        # Get AI analysis using the configured model client
        response = await call_llm(model_client, messages, temperature=0.3, max_tokens=300)

        if response and response.content:
            import json
            try:
                # Parse the JSON response
                analysis_result = json.loads(response.content)
                
                # Validate the response structure
                if "decision" in analysis_result and "reason" in analysis_result:
                    return {
                        "decision": analysis_result["decision"],
                        "reason": analysis_result["reason"],
                        "follow_up": analysis_result.get("follow_up")
                    }
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse AI analysis response: {response.content}")
        
        # Fallback to heuristic analysis if AI fails
        logger.warning("AI analysis failed, falling back to heuristics")
        return _fallback_analyze(req)
        
    except Exception as e:
        logger.error(f"Error in live_analyze: {str(e)}")
        # Fallback to heuristic analysis
        return _fallback_analyze(req)


def _fallback_analyze(req: LiveAnalyzeRequest) -> Dict[str, Any]:
    """Fallback heuristic analysis when AI is unavailable"""
    text = (req.text or "").strip()
    token_like = len(text.split())
    if token_like < max(1, req.min_tokens):
        follow = "Could you elaborate a bit more on your approach and key trade-offs?"
        if req.question_type == "coding":
            follow = "Please expand on your approach: key steps, edge cases, and time/space complexity."
        return {
            "decision": "PROBE",
            "reason": f"Answer is brief ({token_like} words) below threshold {req.min_tokens}.",
            "follow_up": follow,
        }
    return {
        "decision": "CONTINUE",
        "reason": "Answer length is sufficient for progression.",
        "follow_up": None,
    }


# Lightweight rubric server for backend scoring
RUBRICS_DIR = Path(__file__).parent / "rubrics"

@lru_cache(maxsize=8)
def _load_rubric(name: str = "default") -> Dict[str, Any]:
    # Extra defense: sanitize and forbid path separators/traversal in name BEFORE path use
    import re
    sanitized = secure_filename(name)
    if name != sanitized:
        raise FileNotFoundError(f"Rubric '{sanitized}' not found (invalid name or unsafe characters)")
    if "/" in name or "\\" in name or ".." in name or not re.fullmatch(r"[a-zA-Z0-9_\-]+", sanitized):
        raise FileNotFoundError(f"Rubric '{sanitized}' not found (invalid name)")
    # Construct and normalize the rubric file path, always use sanitized name
    rubric_path = RUBRICS_DIR / f"{sanitized}.json"
    try:
        # Python 3.9+ robust ancestry/path check
        resolved_root = RUBRICS_DIR.resolve()
        resolved_path = rubric_path.resolve()
        is_contained = resolved_path.is_relative_to(resolved_root)
    except AttributeError:
        # Compatibility: fallback for Python < 3.9. Check ancestry without using string prefix.
        resolved_root = RUBRICS_DIR.resolve()
        resolved_path = rubric_path.resolve()
        def _is_relative_to(path, root):
            # Returns True if `root` is a parent of `path` or same as path
            try:
                path.relative_to(root)
                return True
            except ValueError:
                return False
        is_contained = _is_relative_to(resolved_path, resolved_root)
    if not is_contained:
        raise FileNotFoundError(f"Rubric '{sanitized}' not found (invalid path)")
    if not resolved_path.exists():
        raise FileNotFoundError(f"Rubric '{sanitized}' not found")
    with resolved_path.open("r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/rubrics/{name}")
async def get_rubric(name: str) -> Dict[str, Any]:
    try:
        rubric = _load_rubric(name)
        return {"name": name, "rubric": rubric}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Rubric not found")
    except Exception as e:
        logger.exception("Failed to load rubric %s", name)
        raise HTTPException(status_code=500, detail="Failed to load rubric")


@app.post("/live/orchestrate", response_model=LiveOrchestrateResponse)
async def live_orchestrate(req: LiveOrchestrateRequest) -> Dict[str, Any]:
    """AI-powered orchestration for intelligent interview flow management.
    Policies:
    - Never reveal answers or provide step-by-step solution code
    - Intelligently guide interview flow based on context
    - Adapt to time constraints and candidate performance
    - Maintain professional interviewer persona
    """
    try:
        # Build context-aware orchestration prompt
        orchestration_prompt = f"""You are an experienced technical interviewer managing a live assessment. Based on the current event and context, decide the next action in the interview flow.

STRICT POLICIES:
- NEVER reveal correct answers or provide solution steps
- NEVER give implementation hints or code snippets
- Focus on assessment flow and candidate evaluation
- Maintain professional interviewer demeanor

Current Context:
- Event: {req.event}
- Interview Progress: {req.context.get('progress', 'unknown')}
- Time Remaining: {req.context.get('time_remaining', 'unknown')} minutes
- Question Type: {req.context.get('question_type', 'unknown')}
- Current Question: {req.context.get('current_question', 'Not provided')}

Event-specific guidance:
- timer_expired: Politely transition without revealing answers
- answer_submitted: Decide whether to probe further or move forward
- code_result: Focus on understanding approach, not correctness
- question_start: Provide appropriate context without hints

Based on this context, decide the next action:
1. "ask_followup" - Ask a probing question to assess deeper understanding
2. "next_question" - Move to the next question in the assessment
3. "wrap_up" - Begin interview conclusion sequence
4. "extend_time" - Give a bit more time if candidate is making progress

If providing a prompt for "ask_followup", ensure it:
- Tests understanding of concepts, not implementation
- Asks about approach, trade-offs, or considerations
- Does not reveal any part of the solution
- Maintains encouraging but professional tone

Respond in this exact JSON format:
{{
    "next": "ask_followup|next_question|wrap_up|extend_time",
    "prompt": "Your follow-up question or null if next_question"
}}"""

        # Use Azure OpenAI for intelligent orchestration
        messages = [
            {"role": "system", "content": "You are an expert technical interviewer managing interview flow with intelligence and professionalism."},
            {"role": "user", "content": orchestration_prompt}
        ]

        # Get AI orchestration decision
        response = await call_llm(model_client, messages, temperature=0.2, max_tokens=200)

        if response and response.content:
            import json
            try:
                # Parse the JSON response
                orchestration_result = json.loads(response.content)
                
                # Validate the response structure
                if "next" in orchestration_result:
                    return {
                        "next": orchestration_result["next"],
                        "prompt": orchestration_result.get("prompt")
                    }
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse AI orchestration response: {response.content}")
        
        # Fallback to heuristic orchestration if AI fails
        logger.warning("AI orchestration failed, falling back to heuristics")
        return _fallback_orchestrate(req)
        
    except Exception as e:
        logger.error(f"Error in live_orchestrate: {str(e)}")
        # Fallback to heuristic orchestration
        return _fallback_orchestrate(req)


def _fallback_orchestrate(req: LiveOrchestrateRequest) -> Dict[str, Any]:
    """Fallback heuristic orchestration when AI is unavailable"""
    event = req.event
    if event == "timer_expired":
        return {"next": "ask_followup", "prompt": "Thanks. Briefly summarize your approach before we move on."}
    if event == "answer_submitted":
        return {"next": "next_question", "prompt": None}
    if event == "code_result":
        return {"next": "ask_followup", "prompt": "What is the time and space complexity of your solution? Any edge cases you considered?"}
    return {"next": "next_question", "prompt": None}


@app.post("/live/judge0-result", response_model=Judge0ResultResponse)
async def process_judge0_result(req: Judge0ResultRequest) -> Dict[str, Any]:
    """AI-powered analysis of Judge0 code execution results for intelligent guidance.
    Policies:
    - Never reveal the correct solution or implementation details
    - Provide constructive guidance based on execution results
    - Encourage learning through discovery, not direct answers
    - Focus on understanding concepts and debugging skills
    """
    try:
        # Build context-aware guidance prompt
        result_analysis_prompt = f"""You are an experienced technical interviewer analyzing a candidate's code execution results. Provide intelligent guidance without revealing solutions.

STRICT POLICIES:
- NEVER show the correct code or implementation
- NEVER provide step-by-step solution fixes
- Focus on helping them understand concepts and debugging approaches
- Encourage independent problem-solving

Code Execution Context:
- Session ID: {req.session_id}
- Question ID: {req.question_id}
- Status: {req.status}
- Execution Time: {req.time}s (if available)
- Memory Usage: {req.memory} KB (if available)
- Exit Code: {req.exit_code}

Output Analysis:
- Standard Output: {req.stdout or 'None'}
- Error Output: {req.stderr or 'None'}
- Compilation Output: {req.compile_output or 'None'}
- Tests Passed: {req.test_passed}/{req.test_total} (if available)

Based on the execution results, provide guidance that:
1. Acknowledges what they accomplished (if successful)
2. Points toward concepts to review (if errors occurred)
3. Suggests debugging approaches without giving solutions
4. Maintains encouraging tone regardless of outcome

Determine the next recommended action:
- "continue" - Good result, can proceed to next question
- "retry" - Encourage another attempt with gentle guidance
- "hint" - Provide conceptual hint without implementation details
- "move_on" - Time to move forward regardless of result

Respond in this exact JSON format:
{{
    "guidance": "Your encouraging and educational response to the candidate",
    "next_action": "continue|retry|hint|move_on",
    "encouragement": "Brief positive reinforcement message"
}}"""

        # Use Azure OpenAI for intelligent result analysis
        messages = [
            {"role": "system", "content": "You are an expert technical interviewer providing guidance on code execution results while never revealing solutions."},
            {"role": "user", "content": result_analysis_prompt}
        ]

        # Get AI analysis of the execution results
        response = await call_llm(model_client, messages, temperature=0.3, max_tokens=400)

        if response and response.content:
            import json
            try:
                # Parse the JSON response
                guidance_result = json.loads(response.content)
                
                # Validate the response structure
                if "guidance" in guidance_result and "next_action" in guidance_result:
                    return {
                        "guidance": guidance_result["guidance"],
                        "next_action": guidance_result["next_action"],
                        "encouragement": guidance_result.get("encouragement")
                    }
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse AI guidance response: {response.content}")
        
        # Fallback to heuristic guidance if AI fails
        logger.warning("AI guidance failed, falling back to heuristics")
        return _fallback_judge0_guidance(req)
        
    except Exception as e:
        logger.error(f"Error in process_judge0_result: {str(e)}")
        # Fallback to heuristic guidance
        return _fallback_judge0_guidance(req)


def _fallback_judge0_guidance(req: Judge0ResultRequest) -> Dict[str, Any]:
    """Fallback heuristic guidance when AI is unavailable"""
    if req.status == "accepted":
        return {
            "guidance": "Great! Your solution executed successfully. What approach did you take?",
            "next_action": "continue",
            "encouragement": "Well done on getting a working solution!"
        }
    elif req.status == "compilation_error":
        return {
            "guidance": "There seems to be a compilation issue. Check your syntax and variable declarations.",
            "next_action": "retry",
            "encouragement": "Don't worry, compilation errors are common and fixable!"
        }
    elif req.status == "wrong_answer":
        return {
            "guidance": "Your code runs but doesn't produce the expected output. Consider testing with the sample inputs.",
            "next_action": "retry",
            "encouragement": "You're on the right track - keep debugging!"
        }
    else:
        return {
            "guidance": "Let's review your approach and see if we can optimize it.",
            "next_action": "hint",
            "encouragement": "Every attempt helps you learn more about the problem!"
        }


@app.post("/generate-report")
async def generate_report(request: GenerateReportRequest) -> ReportGenerationResponse:
    """
    Initiates a multi-agent workflow to score and generate a comprehensive report.
    
    This endpoint uses Microsoft AutoGen AgentChat framework with SelectorGroupChat
    to orchestrate multiple specialized agents:
    1. Orchestrator coordinates the workflow
    2. User_Proxy fetches data and scores MCQs
    3. Text_Analyst evaluates descriptive questions
    4. Code_Analyst evaluates coding questions
    5. Report_Synthesizer compiles the final comprehensive report
    
    Returns structured report with executive summary, detailed analysis, and recommendations.
    """
    import re
    from datetime import datetime
    
    try:
        logger.info(f"Starting report generation for submission_id: {request.submission_id}")
        start_time = datetime.now()
        
        # Create the assessment team
        assessment_team = create_assessment_team()
        
        # Define comprehensive report generation task
        task = f"""Generate a comprehensive assessment report for submission_id: '{request.submission_id}'.

Complete Workflow:
1. Fetch submission and assessment data
2. Score all MCQ questions deterministically
3. Evaluate all descriptive questions for quality, completeness, and technical accuracy
4. Evaluate all coding questions for correctness, efficiency, and code quality
5. Synthesize a comprehensive final report

Report Requirements:
- Executive Summary: High-level overview with overall score and key findings
- Detailed Analysis: Question-by-question breakdown with scores and feedback
- Competency Breakdown: Skills assessment across technical areas
- Strengths: Top 3-5 areas of excellence
- Areas for Development: 3-5 areas needing improvement
- Recommendations: Actionable steps for candidate improvement

IMPORTANT: Format the Report_Synthesizer's output with these sections:
- EXECUTIVE SUMMARY: [2-3 paragraphs]
- DETAILED ANALYSIS: [Full breakdown]
- COMPETENCY BREAKDOWN: [Skills with scores]
- STRENGTHS: [Bullet points]
- AREAS FOR DEVELOPMENT: [Bullet points]
- RECOMMENDATIONS: [Numbered list]
"""
        
        # Initialize console for debug mode if enabled
        console = None
        if request.debug_mode or DEBUG_MODE:
            console = Console()
            logger.info("Debug mode enabled - agent conversations will be displayed")
        
        # Run the assessment workflow with message limit protection
        result_stream = assessment_team.run_stream(task=task)
        
        # Collect conversation and extract report components
        conversation_messages = []
        raw_report = ""
        executive_summary = ""
        detailed_analysis = ""
        recommendations_list = []
        competency_data = {}
        message_count = 0
        max_messages = 50  # Hard limit for report generation
        
        async for message in result_stream:
            message_count += 1
            if message_count > max_messages:
                logger.warning(f"Report generation exceeded {max_messages} messages, terminating")
                break
            # Debug console output if enabled
            if console:
                console.print(message)
                
            msg_data = {
                "source": message.source if hasattr(message, 'source') else "system",
                "content": message.content if hasattr(message, 'content') else str(message),
                "timestamp": datetime.now().isoformat()
            }
            conversation_messages.append(msg_data)
            
            # Extract report from Report_Synthesizer messages
            if hasattr(message, 'content') and isinstance(message.content, str):
                content = message.content
                
                # Look for final report marker
                if "FINAL REPORT:" in content or "Report_Synthesizer" in msg_data.get("source", ""):
                    raw_report = content
                    
                    # Extract executive summary
                    exec_match = re.search(r'EXECUTIVE SUMMARY[:\s]*([^#]+?)(?=DETAILED ANALYSIS|COMPETENCY|STRENGTHS|$)', content, re.DOTALL | re.IGNORECASE)
                    if exec_match:
                        executive_summary = exec_match.group(1).strip()
                    
                    # Extract detailed analysis
                    detail_match = re.search(r'DETAILED ANALYSIS[:\s]*([^#]+?)(?=COMPETENCY|STRENGTHS|RECOMMENDATIONS|$)', content, re.DOTALL | re.IGNORECASE)
                    if detail_match:
                        detailed_analysis = detail_match.group(1).strip()
                    
                    # Extract recommendations
                    rec_match = re.search(r'RECOMMENDATIONS?[:\s]*([^#]+?)$', content, re.DOTALL | re.IGNORECASE)
                    if rec_match:
                        rec_text = rec_match.group(1).strip()
                        # Parse numbered or bulleted list
                        rec_lines = [line.strip() for line in rec_text.split('\n') if line.strip()]
                        recommendations_list = [
                            re.sub(r'^[\d\.\-\*]+\s*', '', line)
                            for line in rec_lines
                            if re.match(r'^[\d\.\-\*]+\s', line)
                        ]
                    
                    # Extract competency breakdown (if structured)
                    comp_match = re.search(r'COMPETENCY BREAKDOWN[:\s]*([^#]+?)(?=STRENGTHS|RECOMMENDATIONS|$)', content, re.DOTALL | re.IGNORECASE)
                    if comp_match:
                        comp_text = comp_match.group(1).strip()
                        # Try to parse as structured data (e.g., "Skill: 85%")
                        competency_data = {"raw_text": comp_text}
        
        # Fallback: If no structured extraction, use raw report
        if not executive_summary and raw_report:
            # Take first paragraph as executive summary
            paragraphs = [p.strip() for p in raw_report.split('\n\n') if p.strip()]
            executive_summary = paragraphs[0] if paragraphs else "Report generated successfully."
        
        if not detailed_analysis and raw_report:
            detailed_analysis = raw_report
        
        if not executive_summary:
            executive_summary = f"Assessment report for submission {request.submission_id} generated successfully."
        
        if not recommendations_list:
            recommendations_list = [
                "Continue practicing problem-solving skills",
                "Focus on code optimization techniques",
                "Improve technical communication in explanations"
            ]
        
        # Calculate generation metadata
        end_time = datetime.now()
        duration_seconds = (end_time - start_time).total_seconds()
        
        generation_metadata = {
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration_seconds,
            "agent_messages": len(conversation_messages),
            "agents_involved": list(set(msg["source"] for msg in conversation_messages))
        }
        
        logger.info(f"Report generation completed for {request.submission_id} in {duration_seconds:.2f}s")
        
        return ReportGenerationResponse(
            submission_id=request.submission_id,
            report={
                "executive_summary": executive_summary,
                "detailed_analysis": detailed_analysis,
                "recommendations": recommendations_list,
                "raw_report": raw_report,
                "competency_breakdown": competency_data
            },
            executive_summary=executive_summary,
            detailed_analysis=detailed_analysis,
            recommendations=recommendations_list,
            competency_breakdown=competency_data if competency_data else None,
            agent_conversation=conversation_messages if request.debug_mode or DEBUG_MODE else None,
            generation_metadata=generation_metadata,
            status="success"
        )
        
    except Exception as e:
        logger.exception(f"Error generating report for submission {request.submission_id}")
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(e)}"
        )

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
        
        # Define the task for question generation with explicit completion instruction
        task = f"""Generate a single {request.difficulty} level {request.question_type} question for the skill: {request.skill}.

Return ONLY the question text without any additional commentary or metadata. Be concise and direct."""
        
        # Run the question generation workflow with timeout protection
        result_stream = question_team.run_stream(task=task)
        
        # Collect the results with strict message limit
        generated_question = None
        message_count = 0
        max_messages = 10  # Absolute hard limit
        
        async for message in result_stream:
            message_count += 1
            if message_count > max_messages:
                logger.warning(f"Question generation exceeded {max_messages} messages, terminating")
                break
            
            # Extract the generated question from the first substantial response
            if hasattr(message, 'content') and isinstance(message.content, str):
                content = message.content.strip()
                # Take the first substantial message as the question
                if len(content) > 20 and not generated_question:
                    generated_question = content
                    logger.info(f"Question extracted after {message_count} messages")
                    break  # Got the question, stop immediately
        
        logger.info(f"Question generation completed for skill: {request.skill} in {message_count} messages")
        
        if not generated_question:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate question - no valid output received"
            )
        
        return {
            "skill": request.skill,
            "question_type": request.question_type,
            "difficulty": request.difficulty,
            "question": generated_question,
            "status": "success",
            "message_count": message_count
        }
        
    except Exception as e:
        logger.exception("Error generating question for skill %s", request.skill)
        raise HTTPException(status_code=500, detail="Question generation failed")


@app.post("/generate-question-direct")
async def generate_question_direct(request: GenerateQuestionRequest) -> Dict[str, Any]:
    """
    Generate a question using single Assistant Agent with structured prompt (Autogen compatible).
    
    This endpoint uses an Assistant Agent that loads the question_generator.yaml prompt file.
    The agent returns structured JSON directly, eliminating complex parsing logic.
    
    Benefits:
    - Speed: 2-3 seconds (single agent, no multi-agent coordination)
    - Cost: ~200-500 tokens (vs ~50,000 with multi-agent)
    - Reliability: Structured JSON output, minimal parsing
    - Maintainability: Prompt managed in YAML file
    - Autogen Compatible: Uses AssistantAgent pattern
    """
    try:
        logger.info(f"Assistant Agent question generation for skill: {request.skill}, type: {request.question_type}, difficulty: {request.difficulty}")
        
        # Load question generator prompt from YAML file
        from prompt_loader import load_prompty
        from autogen_agentchat.agents import AssistantAgent
        
        _qgen_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "question_generator.yaml"))
        
        if not _qgen_prompty or not _qgen_prompty.system:
            raise HTTPException(
                status_code=500,
                detail="Failed to load question_generator.yaml - check file path and format"
            )
        
        # Create single Assistant Agent with the loaded prompt
        question_agent = AssistantAgent(
            name="Question_Generator",
            model_client=model_client,
            system_message=_qgen_prompty.system
        )
        
        # Construct task message for the agent
        task = f"""Generate a {request.question_type} question for the skill: {request.skill} at {request.difficulty} difficulty level.

Remember: Return ONLY minified JSON (no markdown, no code blocks, no explanations)."""
        
        # Run the agent to generate question
        messages = [{"role": "user", "content": task}]
        
        # Call the agent directly (single turn, no team needed)
        response = await call_llm(
            client=model_client,
            messages=[
                {"role": "system", "content": _qgen_prompty.system},
                {"role": "user", "content": task}
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=10000
        )
        
        # Extract the response content
        if hasattr(response, 'choices') and len(response.choices) > 0:
            content = response.choices[0].message.content.strip()
        elif isinstance(response, dict) and 'choices' in response:
            content = response['choices'][0]['message']['content'].strip()
        else:
            raise ValueError("Unexpected response format from model")
        
        # Parse JSON response
        try:
            # Remove markdown code blocks if present (defensive)
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            elif content.startswith("```"):
                content = content.replace("```", "").strip()
            
            response_data = json.loads(content)
            
            # Validate required fields
            if "skill" not in response_data:
                response_data["skill"] = request.skill
            if "question_type" not in response_data:
                response_data["question_type"] = request.question_type
            if "difficulty" not in response_data:
                response_data["difficulty"] = request.difficulty
            if "status" not in response_data:
                response_data["status"] = "success"
            
            # Add metadata
            tokens_used = getattr(response, 'usage', {}).get('total_tokens', 0) if hasattr(response, 'usage') else response.get('usage', {}).get('total_tokens', 0)
            response_data["tokens_used"] = tokens_used
            response_data["method"] = "assistant-agent"
            
            logger.info(f"Assistant Agent question generation completed in {tokens_used} tokens")
            
            return response_data
            
        except json.JSONDecodeError as json_err:
            logger.error(f"Failed to parse JSON response: {content}")
            logger.exception(f"JSON decode error: {json_err}")
            
            # Fallback: Try to extract JSON from text if AI added extra text
            import re
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                try:
                    response_data = json.loads(json_match.group(0))
                    response_data.setdefault("skill", request.skill)
                    response_data.setdefault("question_type", request.question_type)
                    response_data.setdefault("difficulty", request.difficulty)
                    response_data.setdefault("status", "success")
                    response_data["method"] = "assistant-agent"
                    logger.warning("Recovered JSON from response with regex")
                    return response_data
                except:
                    pass
            
            raise HTTPException(
                status_code=500,
                detail=f"Agent returned invalid JSON. Content: {content[:200]}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Assistant Agent question generation failed")
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


@app.post("/assess-submission")
async def assess_submission(request: GenerateReportRequest) -> AutogenScoringResponse:
    """
    Direct assessment endpoint that provides real-time scoring using Autogen multi-agent workflow.
    
    This endpoint orchestrates the following workflow:
    1. Orchestrator fetches submission data via fetch_submission_data tool
    2. User_Proxy scores MCQs deterministically via score_mcqs tool
    3. Text_Analyst evaluates descriptive questions
    4. Code_Analyst evaluates coding questions
    5. Results are extracted and returned in structured format
    """
    try:
        logger.info(f"Starting Autogen scoring workflow for submission_id: {request.submission_id}")
        
        # Create assessment team
        assessment_team = create_assessment_team()
        
        # Define scoring task (orchestrator will coordinate the workflow)
        task = f"""Score all questions in submission_id: '{request.submission_id}'.

Workflow:
1. Fetch submission and assessment data
2. Score MCQ questions deterministically
3. Evaluate descriptive questions for quality and completeness
4. Evaluate coding questions for correctness and efficiency
5. Return structured scoring results with feedback

For each question, provide:
- question_id: The question identifier
- score: Normalized score (0.0 to 1.0)
- feedback: Brief evaluation feedback
- points_awarded: Calculated points based on question weight

IMPORTANT: Format your final results as JSON with this structure:
{{
  "llm_results": [
    {{
      "questionId": "q1",
      "score": 0.85,
      "feedback": "Good explanation...",
      "pointsAwarded": 8.5
    }}
  ]
}}"""
        
        # Run multi-agent workflow with message limit protection
        result_stream = assessment_team.run_stream(task=task)
        
        # Collect conversation and extract scoring results
        conversation_messages = []
        llm_results = []
        scoring_summary = {}
        message_count = 0
        max_messages = 50  # Hard limit for assessment scoring
        
        async for message in result_stream:
            message_count += 1
            if message_count > max_messages:
                logger.warning(f"Assessment scoring exceeded {max_messages} messages, terminating")
                break
            # Store message for debugging
            msg_data = {
                "source": message.source if hasattr(message, 'source') else "system",
                "content": message.content if hasattr(message, 'content') else str(message)
            }
            conversation_messages.append(msg_data)
            
            # Extract structured scoring results from agent messages
            if hasattr(message, 'content') and isinstance(message.content, str):
                content = message.content
                
                # Look for JSON-formatted results in the content
                try:
                    # Try to extract JSON blocks from the message
                    import re
                    json_pattern = r'```(?:json)?\s*({[^`]+})\s*```|({\s*"llm_results"[^}]+}(?:,\s*{[^}]+})*\s*})'
                    json_matches = re.findall(json_pattern, content, re.DOTALL)
                    
                    for match_tuple in json_matches:
                        json_str = match_tuple[0] or match_tuple[1]
                        if json_str:
                            try:
                                parsed = json.loads(json_str)
                                if isinstance(parsed, dict) and "llm_results" in parsed:
                                    llm_results.extend(parsed["llm_results"])
                                elif isinstance(parsed, list):
                                    llm_results.extend(parsed)
                            except json.JSONDecodeError:
                                continue
                except Exception as e:
                    logger.debug(f"Could not extract JSON from message: {e}")
                
                # Also look for tool call results (from score_mcqs tool)
                if "score_mcqs" in content.lower() or "mcq_results" in content.lower():
                    try:
                        # Extract MCQ results from tool response
                        mcq_pattern = r'{\s*"questionId"[^}]+}'
                        mcq_matches = re.findall(mcq_pattern, content)
                        for mcq_str in mcq_matches:
                            try:
                                mcq_result = json.loads(mcq_str)
                                # Convert MCQ result to LLMScoreResult format
                                if "is_correct" in mcq_result:
                                    llm_results.append({
                                        "questionId": mcq_result["questionId"],
                                        "score": 1.0 if mcq_result["is_correct"] else 0.0,
                                        "feedback": "Correct answer" if mcq_result["is_correct"] else "Incorrect answer",
                                        "pointsAwarded": 1.0 if mcq_result["is_correct"] else 0.0  # Will be recalculated by backend
                                    })
                            except json.JSONDecodeError:
                                continue
                    except Exception as e:
                        logger.debug(f"Could not extract MCQ results: {e}")
        
        # If no structured results found, log warning and return empty results
        if not llm_results:
            logger.warning(f"No structured scoring results extracted for submission {request.submission_id}. Check agent prompts and tool responses.")
            logger.debug(f"Conversation had {len(conversation_messages)} messages")
        
        # Calculate scoring summary
        if llm_results:
            total_score = sum(r.get("score", 0.0) for r in llm_results)
            avg_score = total_score / len(llm_results) if llm_results else 0.0
            scoring_summary = {
                "total_questions": len(llm_results),
                "average_score": round(avg_score, 3),
                "questions_scored": len([r for r in llm_results if r.get("score", 0) > 0])
            }
        
        logger.info(f"Autogen scoring completed for {request.submission_id}: {len(llm_results)} questions scored")
        
        return AutogenScoringResponse(
            submission_id=request.submission_id,
            llm_results=llm_results,
            agent_conversation=conversation_messages if request.debug_mode or DEBUG_MODE else None,
            scoring_summary=scoring_summary,
            status="success"
        )
        
    except Exception as e:
        logger.exception(f"Error in Autogen scoring workflow for submission {request.submission_id}")
        raise HTTPException(
            status_code=500, 
            detail=f"Autogen scoring workflow failed: {str(e)}"
        )

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
        logger.exception("Status check failed")
        raise HTTPException(status_code=500, detail="Status check failed")


@app.post("/questions/validate")
async def validate_question(request: QuestionValidationRequest) -> Dict[str, Any]:
    """
    Two-phase validation for questions:
    Phase 1: Exact match using SHA256 hash
    Phase 2: Semantic similarity using vector embeddings
    """
    try:
        logger.info(f"Starting question validation for: {request.question_text[:50]}...")
        
        # Use the unified validation tool which performs exact + semantic checks
        from tools import validate_question

        result = validate_question(request.question_text)
        # `validate_question` may call the async similarity path internally; it
        # returns a dict indicating status and details. If it returns a dict
        # synchronously, return it. If it returns a coroutine (unlikely here),
        # await it.
        if hasattr(result, '__await__'):
            result = await result

        logger.info(f"Question validation completed with status: {result.get('status')}")
        return result

    except Exception as e:
        logger.exception("Error in validate_question")
        raise HTTPException(status_code=500, detail="Failed to validate question")

@app.post("/questions/rewrite")
async def rewrite_question(request: QuestionRewriteRequest) -> Dict[str, Any]:
    """
    AI-powered question enhancement and auto-tagging using a single specialized agent.
    Relies on the agent's system message for instructions; inputs the question directly.
    Falls back to rule-based if AI fails.
    """
    try:
        logger.info(f"Starting question rewriting for: {request.question_text[:50]}...")
        
        # Create the rewriting agent (single agent)
        rewrite_agent = create_question_rewriting_team()  # Returns AssistantAgent
        
        # Send the original question directly as the user message
        # (Agent's system prompt + YAML user template handle enhancement/tagging)
        from autogen_agentchat.messages import TextMessage
        from autogen_core import CancellationToken
        
        cancellation_token = CancellationToken()
        response = await rewrite_agent.on_messages(
            [TextMessage(content=request.question_text, source="user")],  # Raw input; no extra instructions
            cancellation_token
        )
        
        # Extract the JSON response (agent outputs minified JSON per system prompt)
        final_response = response.chat_message.content if hasattr(response.chat_message, 'content') else str(response)
        
        # Parse the JSON
        import json
        rewrite_result = json.loads(final_response.strip())

        # Validate structure (matches YAML outputs)
        required_keys = ["rewritten_text", "suggested_role", "suggested_tags"]
        if not all(key in rewrite_result for key in required_keys):
            raise ValueError("Invalid AI response structure")

        # Normalize optional suggested difficulty if provided by the agent.
        # Agent may return snake_case `suggested_difficulty` or camelCase `suggestedDifficulty`.
        suggested = rewrite_result.get("suggested_difficulty") or rewrite_result.get("suggestedDifficulty")
        if suggested:
            try:
                s = str(suggested).strip().lower()
                if s in ("easy", "medium", "hard"):
                    rewrite_result["suggested_difficulty"] = s
                else:
                    # If the agent returned something unexpected, default to None (don't fail the flow)
                    logger.debug(f"Agent returned nonstandard suggested_difficulty: {suggested}")
            except Exception:
                logger.debug(f"Failed to normalize suggested_difficulty: {suggested}")

        logger.info("Question rewriting completed successfully with single agent")
        return rewrite_result
            
    except Exception as ai_error:
        logger.warning(f"AI-based rewriting failed: {ai_error}, falling back to rule-based enhancement")
        
        # Fallback to rule-based enhancement for development
        enhanced_text = request.question_text.strip()
        
        # Basic text cleanup
        if enhanced_text and not enhanced_text[0].isupper():
            enhanced_text = enhanced_text[0].upper() + enhanced_text[1:]
        if enhanced_text and not enhanced_text.endswith(('?', '.', '!')):
            enhanced_text += "?"
        
        # Rule-based role and tag suggestions
        text_lower = request.question_text.lower()
        suggested_role = "General Developer"
        suggested_tags = ["general", "assessment"]
        
        # Frontend keywords
        if any(keyword in text_lower for keyword in ["react", "javascript", "html", "css", "frontend", "ui", "component"]):
            suggested_role = "Frontend Developer"
            suggested_tags = ["frontend", "javascript"]
            if "react" in text_lower:
                suggested_tags.append("react")
        
        # Backend keywords  
        elif any(keyword in text_lower for keyword in ["python", "java", "backend", "api", "server", "database", "sql"]):
            suggested_role = "Backend Developer"
            suggested_tags = ["backend", "api"]
            if "python" in text_lower:
                suggested_tags.append("python")
            elif "java" in text_lower:
                suggested_tags.append("java")
        
        # Algorithm/Data Structure keywords
        elif any(keyword in text_lower for keyword in ["algorithm", "complexity", "sorting", "search", "tree", "array"]):
            suggested_role = "Software Engineer"
            suggested_tags = ["algorithms", "programming"]
            if "complexity" in text_lower:
                suggested_tags.append("complexity")
        
        # DevOps keywords
        elif any(keyword in text_lower for keyword in ["docker", "kubernetes", "aws", "deployment", "ci/cd"]):
            suggested_role = "DevOps Engineer"
            suggested_tags = ["devops", "infrastructure"]
        
        logger.info("Question rewriting completed with rule-based fallback")
        return {
            "rewritten_text": enhanced_text,
            "suggested_role": suggested_role,
            "suggested_tags": suggested_tags[:3]  # Limit to 3 tags
        }
    

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
            message_count = 0
            max_messages = 30  # Hard limit for debug interactions
            async for message in result_stream:
                message_count += 1
                if message_count > max_messages:
                    logger.warning(f"Debug interaction exceeded {max_messages} messages, terminating")
                    break
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
        logger.exception("Debug console interaction failed")
        raise HTTPException(status_code=500, detail="Debug interaction failed")


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


# ===========================
# RAG SYSTEM ENDPOINTS
# ===========================

class RAGQueryRequest(BaseModel):
    """Request model for RAG queries"""
    question: str
    context_limit: int = 5
    similarity_threshold: float = 0.7
    skill: str | None = None
    limit: int | None = None


class EmbeddingGenerationRequest(BaseModel):
    """Request model for embedding generation"""
    text: str


@app.post("/rag/query")
async def rag_query(request: RAGQueryRequest) -> Dict[str, Any]:
    """
    Process RAG queries using the RAG-powered agent team.
    Retrieves context and generates informed answers.
    """
    try:
        logger.info(f"Processing RAG query: {request.question[:100]}...")
        
        # Import RAG functions
        from agents import rag_query_async
        
        # Process the query using RAG team
        messages = await rag_query_async(request.question)
        
        # Extract answer from the conversation
        answer = ""
        context_documents = []
        confidence_score = None
        
        for message in messages:
            if hasattr(message, 'content') and message.content:
                # Look for the final answer in the conversation
                if "answer:" in message.content.lower() or "response:" in message.content.lower():
                    answer = message.content
                    break
        
        # If no specific answer found, use the last message as answer
        if not answer and messages:
            answer = messages[-1].content if hasattr(messages[-1], 'content') else str(messages[-1])
        
        # Try to extract context documents from tools (if available)
        # This would be populated by the query_cosmosdb_for_rag tool results
        context_documents = []  # Placeholder - would be extracted from tool results
        
        return {
            "success": True,
            "answer": answer or "I couldn't find specific information about that question.",
            "context_documents": context_documents,
            "confidence_score": confidence_score,
            "messages_count": len(messages),
            "query_processed": True
        }
        
    except Exception as e:
        logger.exception("RAG query processing failed")
        return {
            "success": False,
            "answer": None,
            "context_documents": [],
            "confidence_score": None,
            "error": "An internal error has occurred during the query."
        }


@app.post("/rag/search")
async def rag_search(request: RAGQueryRequest) -> Dict[str, Any]:
    """
    Perform vector similarity search in the knowledge base.
    Returns relevant documents without generating an answer.
    """
    try:
        logger.info(f"Processing RAG search: {request.question[:100]}...")
        
        # Import RAG tools
        from tools import query_cosmosdb_for_rag
        
        # Perform the search (forward optional filters to the tool)
        result = await query_cosmosdb_for_rag(
            request.question,
            skill=request.skill,
            limit=(request.limit or request.context_limit),
            threshold=request.similarity_threshold,
        )

        # result can be a structured dict {"documents": [...], "context": str, "request_charge": float}
        # or the older {"context": str, "request_charge": float} or a mock string.
        request_charge = 0.0
        documents = []
        context = None

        try:
            if isinstance(result, dict):
                # Prefer structured 'documents' if present
                documents = result.get('documents') or []
                context = result.get('context')
                request_charge = float(result.get('request_charge', 0.0))
            else:
                # Fallback to the older string context
                context = result

            # If the tool returned a plain context string, try to parse numeric relevance
            # (backward compatibility). Otherwise ensure documents are in the expected shape.
            if context and not documents:
                if isinstance(context, str) and context.startswith('Mock context'):
                    documents = [{"content": context, "skill": "unknown"}]
                else:
                    # Attempt lightweight parse of numbered sections (best-effort)
                    try:
                        sections = context.split('\n')
                        current_doc = None
                        for line in sections:
                            line = line.strip()
                            if line.startswith(('1.', '2.', '3.', '4.', '5.')):
                                if current_doc:
                                    documents.append(current_doc)
                                # start a new document
                                current_doc = {"content": '', "skill": 'unknown'}
                                # line may contain the first chunk (keep as content fallback)
                                current_doc['content'] += line
                            elif 'Skill:' in line and current_doc is not None:
                                current_doc['skill'] = line.replace('Skill:', '').strip()
                            elif 'Content:' in line and current_doc is not None:
                                current_doc['content'] = line.replace('Content:', '').strip()
                            # ignore any 'Relevance:' lines - we no longer include relevance
                        if current_doc:
                            documents.append(current_doc)
                    except Exception as parse_error:
                        logger.warning(f"Could not parse context structure: {parse_error}")
                        documents = [{"content": context, "skill": "unknown"}]

            # Normalize documents: ensure each document at least has content and skill
            normalized_docs = []
            for d in documents:
                if isinstance(d, dict):
                    norm = {
                        'content': d.get('content', ''),
                        'skill': d.get('skill', 'unknown')
                    }
                    normalized_docs.append(norm)
                else:
                    normalized_docs.append({'content': str(d), 'skill': 'unknown'})

            documents = normalized_docs
        except Exception as e:
            logger.error(f"Error normalizing search result: {e}")
            documents = [{"content": str(result), "skill": "unknown"}]
        
        return {
            "success": True,
            "results": documents,
            "total_found": len(documents),
            "search_type": "vector_similarity",
            "request_charge": request_charge,
            "message": f"Found {len(documents)} relevant documents"
        }
        
    except Exception as e:
        logger.error(f"RAG search failed: {str(e)}")
        return {
            "success": False,
            "results": [],
            "total_found": 0,
            "error": "An internal error has occurred during the search."
        }


@app.post("/embeddings/generate")
async def generate_embedding(request: EmbeddingGenerationRequest) -> Dict[str, Any]:
    """
    Generate embedding for given text using Azure OpenAI.
    """
    try:
        logger.info(f"Generating embedding for text: {request.text[:100]}...")
        
        # Import embedding generation
        import openai
        
        # Get Azure OpenAI configuration
        openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        openai_key = os.getenv('AZURE_OPENAI_API_KEY')
        
        if not openai_endpoint or not openai_key:
            return {
                "success": False,
                "embedding": None,
                "error": "Azure OpenAI not configured"
            }
        
        # Create OpenAI client
        client = openai.AsyncAzureOpenAI(
            azure_endpoint=openai_endpoint,
            api_key=openai_key,
            api_version="2024-02-15-preview"
        )
        
        # Determine embedding model from env (canonical var) with fallback
        embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))

        # Generate embedding
        response = await client.embeddings.create(
            model=embed_model,
            input=request.text
        )

        embedding = response.data[0].embedding

        return {
            "success": True,
            "embedding": embedding,
            "dimensions": len(embedding),
            "model": embed_model
        }
        
    except Exception as e:
        logger.error(f"Embedding generation failed: {str(e)}")
        return {
            "success": False,
            "embedding": None,
            "error": "An internal error occurred while generating embeddings."
        }


@app.post("/screen/resume", response_model=ResumeScreenResponse)
async def screen_resume(req: ResumeScreenRequest):
    """LLM-agent endpoint to screen a resume text.
    The backend prepares the text (PDF extraction) and calls this JSON endpoint.
    """
    text = (req.resume_text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty resume_text")
    # Load base prompty
    from prompt_loader import load_prompty
    prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "resume_screen.yaml"))
    if not prompty:
        raise HTTPException(status_code=500, detail="resume_screen prompt missing")

    if req.mode.lower() == "customized":
        criteria = f"**Role:** `{req.role}`\n**Domain:** `{req.domain}`\n**Required Skills:** `{', '.join(req.skills or [])}`"
    else:
        criteria = "**EVALUATION CRITERIA:** Analyze the resume to identify the candidate's most likely role and strongest skills based on their experience."

    system_prompt = prompty.system.replace("{{CRITERIA_SECTION}}", f"**EVALUATION CRITERIA:**\n{criteria}\n")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"<RESUME_DATA>\n{text}\n</RESUME_DATA>"},
    ]

    try:
        # JSON mode expected; rely on response_format
        result = await call_llm(model_client, messages, temperature=0.0, max_tokens=600)
        # AutoGen client returns object with choices-like structure; attempt to extract content
        content = None
        try:
            # Newer autogen client might give .content in first candidate
            choices = getattr(result, "choices", None) or []
            if choices and hasattr(choices[0], "message"):
                content = choices[0].message.content  # type: ignore
        except Exception:
            pass
        if not content:
            # Fallback: direct attribute
            content = getattr(result, "content", None)
        if isinstance(content, list):
            # Some clients return list of segments
            content = "".join([c if isinstance(c, str) else getattr(c, "text", "") for c in content])
        import json as _json
        try:
            data = _json.loads(content)
            if not isinstance(data, dict) or "summary" not in data or "recommendation" not in data:
                raise ValueError("schema mismatch")
            # Ensure summary is list of strings
            summary = data.get("summary")
            if not isinstance(summary, list):
                summary = [str(summary)]
            summary = [str(s) for s in summary]
            return ResumeScreenResponse(summary=summary, recommendation=str(data.get("recommendation")))
        except Exception:
            # Fallback minimal structure
            return ResumeScreenResponse(summary=[content or "No structured response"], recommendation="Insufficient structured response. Please review output.")
    except HTTPException:
        raise
    except Exception as e:
        return ResumeScreenResponse(summary=[f"Model error: {e}"], recommendation="Insufficient structured response. Please review output.")
    

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
