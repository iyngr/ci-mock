import asyncio
import os
from typing import List, Sequence
from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.conditions import MaxMessageTermination, TextMentionTermination
from autogen_agentchat.messages import BaseAgentEvent, BaseChatMessage
from autogen_agentchat.teams import SelectorGroupChat
from autogen_ext.models.openai import AzureOpenAIChatCompletionClient
from autogen_core.models import ModelFamily
from azure.identity import DefaultAzureCredential
from autogen_ext.auth.azure import AzureTokenProvider
from tools import fetch_submission_data, score_mcqs, generate_question_from_ai, query_cosmosdb_for_rag, validate_question
from prompt_loader import load_prompty
from tracing import traced_run
# structured parsing helpers are imported where/when needed to avoid unused-import lints


def _infer_family_from_deployment(deployment_name: str | None) -> None:
    """No-op: model family inference is disabled in source.

    Deployment names must be respected verbatim. This helper returns None
    to ensure callers do not embed inferred family labels into runtime
    model_info values.
    """
    return None

# --- Optional LangChain adapter support (guarded imports) ---
_langchain_adapter_available = False
_langchain_adapter_builder = None
try:
    # LangChain & LangChain vectorstore imports (guarded)
    from langchain_core.tools.retriever import create_retriever_tool
    try:
        # Prefer the new package
        from langchain_azure_ai.vectorstores import AzureCosmosDBNoSqlVectorSearch as CosmosNoSqlVS
    except Exception:
        try:
            from langchain_community.vectorstores.azure_cosmos_db_no_sql import AzureCosmosDBNoSqlVectorSearch as CosmosNoSqlVS
        except Exception:
            CosmosNoSqlVS = None

    from autogen_ext.tools.langchain import LangChainToolAdapter

    def _build_langchain_adapter_from_env() -> object | None:
        """Build a LangChainToolAdapter for Cosmos DB vector store using env vars.

        Returns the adapter (AutoGen tool) or None if prerequisites are missing.
        """
        try:
            EMBED_DEPLOYMENT = os.environ.get("AZURE_OPENAI_EMBED_DEPLOYMENT")
            COSMOS_URI = os.environ.get("RAG_COSMOS_DB_ENDPOINT") or os.environ.get("COSMOS_DB_ENDPOINT")
            COSMOS_KEY = os.environ.get("RAG_COSMOS_DB_KEY") or os.environ.get("COSMOS_DB_KEY")
            DB_NAME = os.environ.get("RAG_COSMOS_DB_DATABASE") or os.environ.get("DATABASE_NAME")
            CONT_NAME = os.environ.get("RAG_COSMOS_CONTAINER") or os.environ.get("RAG_COSMOS_CONTAINER") or "KnowledgeBase"

            if not (EMBED_DEPLOYMENT and COSMOS_URI and COSMOS_KEY and DB_NAME and CONT_NAME and CosmosNoSqlVS):
                return None

            # Lazy imports for embeddings
            try:
                from langchain_openai import OpenAIEmbeddings
            except Exception:
                return None

            embeddings = OpenAIEmbeddings(deployment=EMBED_DEPLOYMENT)

            # Build Cosmos client for LangChain vector store
            from azure.cosmos import CosmosClient as AzureCosmosClient
            cosmos_client = AzureCosmosClient(COSMOS_URI, COSMOS_KEY)

            vs = CosmosNoSqlVS(
                cosmos_client=cosmos_client,
                database_name=DB_NAME,
                container_name=CONT_NAME,
                embedding=embeddings,
                create_container=False,
            )

            retriever = vs.as_retriever(search_kwargs={"k": 5})
            lc_tool = create_retriever_tool(retriever=retriever, name="cosmos_nosql_retriever", description="Cosmos DB NoSQL retriever")
            ag_tool = LangChainToolAdapter(lc_tool)
            return ag_tool
        except Exception as e:
            print(f"LangChain adapter not available: {e}")
            return None

    _langchain_adapter_available = True
    _langchain_adapter_builder = _build_langchain_adapter_from_env
except Exception:
    _langchain_adapter_available = False
    _langchain_adapter_builder = None


# Lightweight in-memory cache for recent RAG queries (acts as a simple Memory)
_rag_query_cache: dict = {}


async def rag_tool_cached(query_text: str) -> str:
    """
    Async tool wrapper around `query_cosmosdb_for_rag` that provides a small
    in-memory cache. This acts as a simple short-term memory for RAG queries
    and avoids calling the vector DB repeatedly for identical queries.
    """
    key = (query_text or "").strip().lower()
    if not key:
        return ""
    # Return cached value when available
    if key in _rag_query_cache:
        # cache hit
        return _rag_query_cache[key]
    # Cache miss: delegate to actual RAG retrieval function
    try:
        result = await query_cosmosdb_for_rag(query_text)
        # Store a short-lived cache entry
        try:
            _rag_query_cache[key] = result
        except Exception:
            # If cache store fails for any reason, ignore silently
            pass
        return result
    except Exception as e:
        print(f"RAG TOOL ERROR: {e}")
        # Fall back to raw call (let caller decide how to handle failure)
        return await query_cosmosdb_for_rag(query_text)

# Configure Azure OpenAI client
def create_model_client():
    """Create Azure OpenAI model client with proper configuration"""
    
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    
    # Check if we have the minimum required configuration
    if not azure_endpoint:
        print("Warning: AZURE_OPENAI_ENDPOINT not set. Using mock configuration for development.")
        # Return a mock configuration for development - this will fail gracefully in actual usage
        # but allows the module to import without errors
        azure_endpoint = "https://mock-openai.openai.azure.com/"
        api_key = "mock-api-key"
    
    # Build a minimal model_info for autogen_ext when using Azure OpenAI.
    # autogen_ext expects model_info for non-standard OpenAI model names.
    # NOTE: We intentionally DO NOT infer a model family from deployment names here.

    # Option 1: Using API Key authentication
    if api_key:
        deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
        # Strict startup enforcement: if Azure endpoint + API key are configured,
        # require the explicit Azure deployment name (deployment resource) to be set.
        if azure_endpoint and api_key and not deployment_name:
            raise RuntimeError(
                "AZURE_OPENAI_DEPLOYMENT_NAME is required when AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are set. "
                "Please set AZURE_OPENAI_DEPLOYMENT_NAME to your Azure deployment (e.g. 'gpt-5-mini')."
            )

        if deployment_name:
            print(f"Using Azure OpenAI API key auth; deployment={deployment_name}")

        return AzureOpenAIChatCompletionClient(
            azure_deployment=deployment_name,
            model=deployment_name,
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                "family": ModelFamily.UNKNOWN,
                "structured_output": True,
                "multiple_system_messages": True,
            },
        )
    
    # Option 2: Using Azure AD authentication (recommended for production)
    else:
        try:
            token_provider = AzureTokenProvider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )

            deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
            if azure_endpoint and not deployment_name:
                # If Azure endpoint is present but deployment is missing, fail fast.
                raise RuntimeError(
                    "AZURE_OPENAI_DEPLOYMENT_NAME is required when AZURE_OPENAI_ENDPOINT is set. "
                    "Please set AZURE_OPENAI_DEPLOYMENT_NAME to your Azure deployment (e.g. 'gpt-5-mini')."
                )
            else:
                print(f"Using Azure AD auth for Azure OpenAI; deployment={deployment_name}")

            return AzureOpenAIChatCompletionClient(
                azure_deployment=deployment_name,
                model=deployment_name,
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
                azure_endpoint=azure_endpoint,
                azure_ad_token_provider=token_provider,
                model_info={
                    "vision": False,
                    "function_calling": True,
                    "json_output": True,
                    "family": ModelFamily.UNKNOWN,
                    "structured_output": True,
                    "multiple_system_messages": True,
                },
            )
        except Exception as e:
            print(f"Warning: Could not create Azure AD token provider: {e}")
            print("Using API key authentication with mock credentials")
            return AzureOpenAIChatCompletionClient(
                azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
                azure_endpoint=azure_endpoint,
                api_key="mock-api-key",
            )

# Initialize model client
model_client = create_model_client()

def _agent_kwargs_from_prompty(prompty):
    """Extract optional kwargs from prompty model.parameters to pass to agents.
    We keep this minimal to avoid changing runtime behavior; only include safe fields
    that autogen agents may accept (e.g., temperature, top_p, max_output_tokens),
    and ignore silently if the underlying client doesn't use them.
    """
    if not prompty or not getattr(prompty, "model", None):
        return {}
    params = (prompty.model or {}).get("parameters") or {}
    allowed = {}
    for key in ("temperature", "top_p", "max_output_tokens"):
        if key in params:
            allowed[key] = params[key]
    # Pass through response_format if provided in prompty (supports JSON mode/schemas)
    if "response_format" in params:
        allowed["response_format"] = params["response_format"]
    return {"generation_config": allowed} if allowed else {}


def _client_from_prompty(prompty):
    """Create a model client override if prompty specifies provider/deployment/model.
    Falls back to None (caller will use global model_client).
    """
    if not prompty or not getattr(prompty, "model", None):
        return None
    provider = (prompty.model or {}).get("provider")
    if provider != "azure-openai":
        return None

    # Prefer explicit deployment set in prompty; fall back to env deployment if provided
    deployment = prompty.model.get("deployment") or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT") or "https://mock-openai.openai.azure.com/"
    api_key = os.getenv("AZURE_OPENAI_API_KEY")

    # API key auth preferred if present; otherwise try AAD
    if api_key:
        # If global Azure endpoint+key are set and this client creation didn't provide
        # a deployment name, enforce that a deployment be specified to avoid silent fallbacks.
        if os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_API_KEY") and not deployment:
            raise RuntimeError(
                "AZURE_OPENAI_DEPLOYMENT_NAME is required when AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are set. "
                "Please provide a deployment in prompty.model.deployment or set AZURE_OPENAI_DEPLOYMENT_NAME."
            )

        return AzureOpenAIChatCompletionClient(
            azure_deployment=deployment,
            model=deployment,
            api_version=api_version,
            azure_endpoint=azure_endpoint,
            api_key=api_key,
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                    "family": ModelFamily.UNKNOWN,
                "structured_output": True,
            },
        )
    else:
        try:
            token_provider = AzureTokenProvider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )
            return AzureOpenAIChatCompletionClient(
                azure_deployment=deployment,
                model=deployment,
                api_version=api_version,
                azure_endpoint=azure_endpoint,
                azure_ad_token_provider=token_provider,
                model_info={
                    "vision": False,
                    "function_calling": True,
                    "json_output": True,
                    "family": ModelFamily.UNKNOWN,
                    "structured_output": True,
                },
            )
        except Exception:
            # Fallback to mock key if AAD fails in dev contexts
            return AzureOpenAIChatCompletionClient(
                azure_deployment=deployment,
                model=deployment,
                api_version=api_version,
                azure_endpoint=azure_endpoint,
                api_key="mock-api-key",
            )

# --- AGENT DEFINITIONS ---

# 1. Orchestrator Agent - Plans and coordinates the assessment workflow
_orch_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "orchestrator.yaml"))
orchestrator_agent = AssistantAgent(
    name="Orchestrator_Agent",
    description="A project manager agent that orchestrates the entire scoring and report generation process.",
    model_client=_client_from_prompty(_orch_prompty) or model_client,
    tools=[fetch_submission_data, score_mcqs],  # Add tools for data fetching and MCQ scoring
    system_message=(
        _orch_prompty.system
        if _orch_prompty and _orch_prompty.system
        else """You are the project manager for an AI assessment platform. Your role is to orchestrate the entire scoring and report generation process.

Your workflow:
1. Start by instructing the team to fetch the submission data using the provided submission_id
2. Once data is retrieved, instruct them to score the MCQs automatically
3. Then, delegate the analysis of descriptive and coding questions to the respective analysts
4. Finally, instruct the Report_Synthesizer to compile the final report using all the gathered results

You do not write code or analyze data yourself. You manage the workflow and ensure all steps are completed.
End the conversation with "TERMINATE" once the final report is ready."""
    )
)

# 2. Code Analysis Agent - Evaluates coding submissions
_code_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "code_analyst.yaml"))
code_analyst_agent = AssistantAgent(
    name="Code_Analyst_Agent", 
    description="A senior software engineer specialized in analyzing coding submissions.",
    model_client=_client_from_prompty(_code_prompty) or model_client,
    system_message=(
        _code_prompty.system
        if _code_prompty and _code_prompty.system
        else """You are a senior software engineer with expertise in code evaluation. Your task is to analyze a candidate's coding submission.

You will be given:
- The code submission
- The problem statement  
- Results from Judge0 execution (if available)

Evaluate the code for:
- Correctness and functionality
- Code quality and best practices
- Efficiency and optimization
- Error handling and edge cases

Provide your analysis in a structured JSON format with:
- Overall score (0-100)
- Detailed feedback on each aspect
- Specific recommendations for improvement
- Strengths identified in the code"""
    )
)

# 3. Text Analysis Agent - Evaluates descriptive answers  
_text_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "text_analyst.yaml"))
text_analyst_agent = AssistantAgent(
    name="Text_Analyst_Agent",
    description="An expert in technical communication and descriptive answer evaluation.",
    model_client=_client_from_prompty(_text_prompty) or model_client, 
    system_message=(
        _text_prompty.system
        if _text_prompty and _text_prompty.system
        else """You are an expert in technical communication and knowledge assessment. Your task is to evaluate a candidate's descriptive answer.

You will be given:
- The question asked
- The candidate's written response

Evaluate the answer for:
- Technical accuracy and correctness
- Clarity and communication skills
- Depth of understanding
- Completeness of the response
- Use of relevant examples or explanations

Provide your analysis in a structured JSON format with:
- Overall score (0-100)
- Detailed feedback on each evaluation criteria
- Specific areas for improvement
- Strengths in the response"""
    )
)

# 4. Report Synthesizer Agent - Compiles final assessment reports
_report_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "report_synthesizer.yaml"))
report_synthesizer_agent = AssistantAgent(
    name="Report_Synthesizer_Agent",
    description="A report writer that synthesizes all scoring data into comprehensive assessment reports.",
    model_client=_client_from_prompty(_report_prompty) or model_client,
    system_message=(
        _report_prompty.system
        if _report_prompty and _report_prompty.system
        else """You are a professional report writer specialized in technical assessment reports. Your task is to synthesize all the provided scoring data into a single, comprehensive, human-readable report.

You will receive:
- MCQ scoring results
- Code analysis from the Code Analyst
- Text analysis from the Text Analyst  
- Raw submission data

Create a report that includes:
- Executive summary with overall score
- Detailed breakdown by question type
- Strengths and areas for improvement
- Specific recommendations for the candidate
- Technical competency assessment

Present the final output clearly, starting with the phrase 'FINAL REPORT:' and format it in a professional, easy-to-read structure."""
    )
)

# 5. User Proxy Agent - Handles tool execution and user interactions
# Use a simple AssistantAgent as the proxy/tool-executor to avoid relying on
# UserProxyAgent which may change between AutoGen releases. This AssistantAgent
# will act as the participant that executes tool-backed tasks when selected.
user_proxy_agent = AssistantAgent(
    name="Admin_User_Proxy",
    description="A proxy agent that executes tools and handles administrative tasks.",
    model_client=model_client,
    system_message=(
        "You are an administrative proxy agent. When instructed by the orchestrator,"
        " call the requested tools or perform administrative tasks. If a tool is not"
        " available, respond with a clear error message."
    ),
    tools=[fetch_submission_data, score_mcqs, generate_question_from_ai, validate_question]
)

# 6. RAG-Enabled Agent - Handles knowledge base queries and context retrieval
def create_rag_agent():
    """
    Creates a RAG-enabled agent for knowledge base queries.
    Builds an AssistantAgent that uses a tool-backed retrieval function.
    This approach works across AutoGen versions and avoids dependency on
    RetrieveUserProxyAgent which is not present in older releases.
    """
    # Build an AssistantAgent that uses our async cached rag tool. This is
    # compatible with AutoGen versions that don't include RetrieveUserProxyAgent.
    rag_agent = AssistantAgent(
        name="RAG_Knowledge_Agent",
        description="A knowledge assistant that uses RAG tools to answer questions based on the knowledge base.",
        model_client=model_client,
        tools=[rag_tool_cached],  # Use the async cached wrapper tool
        system_message="""You are a knowledge assistant powered by a RAG (Retrieval-Augmented Generation) system.

Your capabilities:
1. Answer questions about technical assessment topics
2. Retrieve relevant context from the knowledge base using vector similarity search via the provided RAG tool
3. Provide informed responses that combine retrieved context with model knowledge

When a user asks a question:
1. Call the provided RAG tool to fetch context from the knowledge base
2. Use the retrieved context to craft accurate, cited answers
3. If the RAG tool returns no results, respond based on general knowledge and note the lack of KB context

Be concise, cite KB snippets when used, and clearly mark when information is drawn from the KB.""",
    )

    return rag_agent

# Initialize RAG agent
rag_agent = create_rag_agent()

# Note: In AutoGen v0.4, tools are registered with AssistantAgents, not UserProxyAgent

# --- TERMINATION CONDITIONS ---
text_mention_termination = TextMentionTermination("TERMINATE")
max_messages_termination = MaxMessageTermination(max_messages=25)
termination_condition = text_mention_termination | max_messages_termination

# --- SELECTOR FUNCTION FOR WORKFLOW MANAGEMENT ---
def assessment_selector_func(messages: Sequence[BaseAgentEvent | BaseChatMessage]) -> str | None:
    """
    Custom selector function to manage the assessment workflow.
    Ensures proper sequence: Orchestrator -> Data Fetch -> MCQ Scoring -> Analysis -> Report
    """
    if not messages:
        return orchestrator_agent.name
    
    last_message = messages[-1]
    
    # Always start with orchestrator for new tasks
    if last_message.source == "user":
        return orchestrator_agent.name
    
    # If orchestrator requests data fetch, use user proxy
    if (last_message.source == orchestrator_agent.name and 
        "fetch" in last_message.content.lower() and 
        "submission" in last_message.content.lower()):
        return user_proxy_agent.name
    
    # If orchestrator requests MCQ scoring, use user proxy  
    if (last_message.source == orchestrator_agent.name and
        "score" in last_message.content.lower() and
        "mcq" in last_message.content.lower()):
        return user_proxy_agent.name
    
    # If orchestrator delegates to code analyst
    if (last_message.source == orchestrator_agent.name and
        "code" in last_message.content.lower()):
        return code_analyst_agent.name
    
    # If orchestrator delegates to text analyst
    if (last_message.source == orchestrator_agent.name and
        ("text" in last_message.content.lower() or 
         "descriptive" in last_message.content.lower())):
        return text_analyst_agent.name
    
    # If orchestrator delegates to report synthesizer
    if (last_message.source == orchestrator_agent.name and
        "report" in last_message.content.lower()):
        return report_synthesizer_agent.name
    
    # After any specialist agent completes work, return to orchestrator
    if last_message.source in [code_analyst_agent.name, text_analyst_agent.name, 
                              report_synthesizer_agent.name, user_proxy_agent.name]:
        return orchestrator_agent.name
    
    # Default to orchestrator
    return orchestrator_agent.name

# --- ASSESSMENT TEAM CREATION ---
def create_assessment_team() -> SelectorGroupChat:
    """
    Creates the multi-agent assessment team using SelectorGroupChat.
    Returns configured team ready for assessment tasks.
    """
    
    # Define custom selector prompt for the assessment domain
    selector_prompt = """You are managing an AI-powered technical assessment system. 

Available agents and their roles:
{roles}

Current conversation context:
{history}

Based on the conversation above, select the next agent from {participants} to continue the assessment workflow.

Workflow sequence:
1. Orchestrator plans the assessment
2. User_Proxy fetches data and scores MCQs  
3. Code_Analyst evaluates coding submissions
4. Text_Analyst evaluates descriptive answers
5. Report_Synthesizer compiles the final report
6. Orchestrator coordinates and terminates when complete

Select the most appropriate agent to continue this workflow."""

    # Create the assessment team
    assessment_team = SelectorGroupChat(
        participants=[
            orchestrator_agent,
            code_analyst_agent, 
            text_analyst_agent,
            report_synthesizer_agent,
            user_proxy_agent
        ],
        model_client=model_client,
        termination_condition=termination_condition,
        selector_prompt=selector_prompt,
        selector_func=assessment_selector_func,
        allow_repeated_speaker=True,  # Allow agents to speak multiple times if needed
    )
    
    return assessment_team

# --- QUESTION GENERATION TEAM ---
def create_question_rewriting_team() -> AssistantAgent:  # Return the single enhancer agent
    """
    Returns the specialized Question_Enhancer agent for question rewriting and enhancement.
    Single-agent approach: Relies on the agent's system message (from YAML) for all instructions.
    Input the original question directly as a message; outputs structured JSON.
    """
    
    _qe_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "question_enhancer.yaml"))
    
    # Validate load succeeded (fail fast if YAML missing)
    if not _qe_prompty or not hasattr(_qe_prompty, 'system') or not _qe_prompty.system:
        raise RuntimeError("Failed to load question_enhancer.yaml - check file path and format.")
    
    question_enhancer = AssistantAgent(
        name="Question_Enhancer",
        description="An expert technical writer specializing in question enhancement and skill tagging.",
        model_client=_client_from_prompty(_qe_prompty) or model_client,
        system_message=_qe_prompty.system  # Pure YAML load; no fallback
    )
    
    return question_enhancer  # Single agent; system prompt handles everything
    

def create_question_generation_team() -> SelectorGroupChat:
    """
    Creates a simplified team for question generation tasks.
    """
    
    _qgen_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "question_generator.yaml"))
    question_generator_agent = AssistantAgent(
        name="Question_Generator_Agent",
        description="An expert in creating technical assessment questions.",
        model_client=_client_from_prompty(_qgen_prompty) or model_client,
        system_message=(
            _qgen_prompty.system
            if _qgen_prompty and _qgen_prompty.system
            else """You are an expert in creating technical assessment questions. 

When asked to generate a question, you should:
1. Create questions appropriate for the specified skill level and difficulty
2. Ensure questions are clear, unambiguous, and test the intended competency
3. For coding questions, provide clear problem statements and expected outcomes
4. For MCQs, ensure options are plausible and one clearly correct answer exists
5. For descriptive questions, frame them to elicit comprehensive technical responses

Always format your output as valid JSON with the question structure expected by the platform."""
        )
    )
    
    question_team = SelectorGroupChat(
        participants=[question_generator_agent, user_proxy_agent],
        model_client=model_client,
        termination_condition=TextMentionTermination("COMPLETE"),
        allow_repeated_speaker=False,
    )
    
    return question_team


def create_rag_question_team() -> SelectorGroupChat:
    """
    Creates a RAG-powered team for intelligent question answering and validation.
    Combines question generation with knowledge base retrieval.
    """
    
    # Enhanced Question Validator with RAG capabilities
    _rag_val_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "rag_validator.yaml"))
    rag_validator_agent = AssistantAgent(
        name="RAG_Question_Validator",
        description="An expert question validator powered by RAG knowledge retrieval.",
        model_client=_client_from_prompty(_rag_val_prompty) or model_client,
        tools=[validate_question, query_cosmosdb_for_rag],
        system_message=(
            _rag_val_prompty.system
            if _rag_val_prompty and _rag_val_prompty.system
            else """You are an expert question validator with access to a comprehensive knowledge base.

Your capabilities:
1. Validate new questions for duplicates using both exact matching and semantic similarity
2. Query the knowledge base to provide context-aware recommendations
3. Suggest improvements based on existing high-quality questions
4. Ensure questions meet quality standards and avoid redundancy

When validating a question:
1. First use validate_question to check for exact or similar duplicates
2. If similar questions exist, use query_cosmosdb_for_rag to get additional context
3. Provide detailed feedback on uniqueness, quality, and improvement suggestions
4. Recommend whether the question should be added, modified, or rejected

Always provide clear, actionable feedback with specific examples from the knowledge base when relevant."""
        )
    )
    
    # Question Answering Agent with RAG
    _rag_qa_prompty = load_prompty(os.path.join(os.path.dirname(__file__), "prompts", "rag_qa.yaml"))
    rag_qa_agent = AssistantAgent(
        name="RAG_QA_Agent", 
        description="A question-answering agent powered by RAG knowledge retrieval.",
        model_client=_client_from_prompty(_rag_qa_prompty) or model_client,
        tools=[query_cosmosdb_for_rag],
        system_message=(
            _rag_qa_prompty.system
            if _rag_qa_prompty and _rag_qa_prompty.system
            else """You are a technical question-answering assistant with access to a comprehensive knowledge base.

Your role:
1. Answer technical questions using retrieved context from the knowledge base
2. Provide accurate, detailed explanations based on existing assessment content
3. Cite relevant examples and similar questions when helpful
4. Acknowledge when information is not available in the knowledge base

Process for answering questions:
1. Use query_cosmosdb_for_rag to retrieve relevant context
2. Analyze the retrieved information and identify key points
3. Formulate a comprehensive answer that combines retrieved context with general knowledge
4. Provide examples or references to similar content when available
5. Be transparent about the source of information (knowledge base vs. general knowledge)

Always strive to be helpful, accurate, and comprehensive in your responses."""
        )
    )
    
    # Create RAG team with specialized agents
    rag_team = SelectorGroupChat(
        participants=[
            rag_validator_agent,
            rag_qa_agent, 
            rag_agent,  # The main RAG agent
            user_proxy_agent
        ],
        model_client=model_client,
        termination_condition=MaxMessageTermination(max_messages=15),
        selector_prompt="""You are managing a RAG-powered question management system.

Available agents:
{roles}

Current conversation:
{history}

Select the most appropriate agent from {participants} based on the task:

- RAG_Question_Validator: For validating new questions and checking duplicates
- RAG_QA_Agent: For answering technical questions using knowledge base context
- RAG_Knowledge_Agent: For general knowledge base queries and context retrieval
- Admin_User_Proxy: For tool execution and administrative tasks

Choose the agent best suited to handle the current request.""",
        allow_repeated_speaker=True,
    )
    
    return rag_team


# --- ASYNC TEAM OPERATIONS (AutoGen v0.4 patterns) ---

async def create_assessment_team_async() -> SelectorGroupChat:
    """
    Async version of team creation following AutoGen v0.4 patterns.
    Creates the multi-agent assessment team with async initialization.
    """
    # Initialize team asynchronously (if agents need async setup)
    await asyncio.sleep(0)  # Placeholder for async agent initialization
    
    # Use the existing sync creation but with async wrapper
    team = create_assessment_team()
    return team


async def run_assessment_async(submission_id: str) -> List[BaseChatMessage]:
    """
    Run assessment team operations asynchronously.
    Returns list of messages from the conversation.
    """
    team = await create_assessment_team_async()
    
    # Create initial message for the assessment
    initial_message = f"Please process assessment for submission_id: {submission_id}"
    
    # Run the team conversation asynchronously
    with traced_run("assessment_team.run", {"submission_id": submission_id}):
        result_stream = team.run_stream(
            task=initial_message,
            termination_condition=MaxMessageTermination(max_messages=10)
        )

    # Collect messages from the conversation (async iterator)
    messages: List[BaseChatMessage] = []
    async for message in result_stream:
        if isinstance(message, BaseChatMessage):
            messages.append(message)

    return messages


async def generate_questions_async(skill: str, question_type: str, difficulty: str) -> List[BaseChatMessage]:
    """
    Generate questions asynchronously using the question generation team.
    Uses the generate_question_from_ai tool for enhanced question creation.
    """
    # Create question generation team
    team = create_question_generation_team()
    
    # Generate question using the AI tool first
    ai_question = generate_question_from_ai(skill, question_type, difficulty)
    
    # Create task message for the team
    task_message = f"""
    Generate a {difficulty} {question_type} question about {skill}.
    
    AI-generated baseline: {ai_question}
    
    Please review, enhance, and provide a final polished question.
    End with COMPLETE when done.
    """
    
    # Run team conversation asynchronously  
    with traced_run("question_team.run", {"skill": skill, "type": question_type, "difficulty": difficulty}):
        result_stream = team.run_stream(
            task=task_message,
            termination_condition=TextMentionTermination("COMPLETE")
        )

    messages: List[BaseChatMessage] = []
    async for message in result_stream:
        if isinstance(message, BaseChatMessage):
            messages.append(message)

    return messages


async def rag_query_async(user_question: str) -> List[BaseChatMessage]:
    """
    Process user questions using the RAG-powered team.
    Retrieves context from knowledge base and provides informed answers.
    """
    team = create_rag_question_team()
    
    # Create task message for RAG processing
    task_message = f"""
    User Question: {user_question}
    
    Please use the knowledge base to provide a comprehensive answer to this question.
    Retrieve relevant context and provide an informed response.
    """
    
    # Run RAG team conversation asynchronously
    with traced_run("rag_team.run", {"question_len": len(user_question)}):
        result_stream = team.run_stream(
            task=task_message,
            termination_condition=MaxMessageTermination(max_messages=10)
        )

    messages: List[BaseChatMessage] = []
    async for message in result_stream:
        if isinstance(message, BaseChatMessage):
            messages.append(message)

    return messages


async def validate_question_async(question_text: str) -> List[BaseChatMessage]:
    """
    Validate questions using the RAG-powered validation team.
    Checks for duplicates and provides quality feedback.
    """
    team = create_rag_question_team()
    
    # Create validation task message
    task_message = f"""
    Question to Validate: {question_text}
    
    Please validate this question for:
    1. Exact duplicates in the database
    2. Similar questions using semantic search
    3. Quality and clarity assessment
    4. Recommendations for improvement or approval
    
    Provide detailed validation results and recommendations.
    """
    
    # Run validation team conversation asynchronously
    with traced_run("rag_validate.run", {"text_len": len(question_text)}):
        result_stream = team.run_stream(
            task=task_message,
            termination_condition=MaxMessageTermination(max_messages=8)
        )

    messages: List[BaseChatMessage] = []
    async for message in result_stream:
        if isinstance(message, BaseChatMessage):
            messages.append(message)

    return messages