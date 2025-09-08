import asyncio
import os
from typing import List, Sequence
from autogen_agentchat.agents import AssistantAgent, UserProxyAgent
from autogen_agentchat.conditions import MaxMessageTermination, TextMentionTermination
from autogen_agentchat.messages import BaseAgentEvent, BaseChatMessage
from autogen_agentchat.teams import SelectorGroupChat
from autogen_ext.models.openai import AzureOpenAIChatCompletionClient
from azure.identity import DefaultAzureCredential
from autogen_ext.auth.azure import AzureTokenProvider
from tools import fetch_submission_data, score_mcqs, generate_question_from_ai, query_cosmosdb_for_rag, validate_question

# RAG imports
try:
    from autogen_agentchat.agents import RetrieveUserProxyAgent
    RAG_AVAILABLE = True
except ImportError:
    print("Warning: RetrieveUserProxyAgent not available in this AutoGen version")
    RAG_AVAILABLE = False

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
    
    # Option 1: Using API Key authentication
    if api_key:
        return AzureOpenAIChatCompletionClient(
            azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"),
            model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
            azure_endpoint=azure_endpoint,
            api_key=api_key,
        )
    
    # Option 2: Using Azure AD authentication (recommended for production)
    else:
        try:
            token_provider = AzureTokenProvider(
                DefaultAzureCredential(),
                "https://cognitiveservices.azure.com/.default",
            )
            
            return AzureOpenAIChatCompletionClient(
                azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"),
                model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
                azure_endpoint=azure_endpoint,
                azure_ad_token_provider=token_provider,
            )
        except Exception as e:
            print(f"Warning: Could not create Azure AD token provider: {e}")
            print("Using API key authentication with mock credentials")
            return AzureOpenAIChatCompletionClient(
                azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o"),
                model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-09-01-preview"),
                azure_endpoint=azure_endpoint,
                api_key="mock-api-key",
            )

# Initialize model client
model_client = create_model_client()

# --- AGENT DEFINITIONS ---

# 1. Orchestrator Agent - Plans and coordinates the assessment workflow
orchestrator_agent = AssistantAgent(
    name="Orchestrator_Agent",
    description="A project manager agent that orchestrates the entire scoring and report generation process.",
    model_client=model_client,
    tools=[fetch_submission_data, score_mcqs],  # Add tools for data fetching and MCQ scoring
    system_message="""You are the project manager for an AI assessment platform. Your role is to orchestrate the entire scoring and report generation process.

Your workflow:
1. Start by instructing the team to fetch the submission data using the provided submission_id
2. Once data is retrieved, instruct them to score the MCQs automatically
3. Then, delegate the analysis of descriptive and coding questions to the respective analysts
4. Finally, instruct the Report_Synthesizer to compile the final report using all the gathered results

You do not write code or analyze data yourself. You manage the workflow and ensure all steps are completed.
End the conversation with "TERMINATE" once the final report is ready."""
)

# 2. Code Analysis Agent - Evaluates coding submissions
code_analyst_agent = AssistantAgent(
    name="Code_Analyst_Agent", 
    description="A senior software engineer specialized in analyzing coding submissions.",
    model_client=model_client,
    system_message="""You are a senior software engineer with expertise in code evaluation. Your task is to analyze a candidate's coding submission.

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

# 3. Text Analysis Agent - Evaluates descriptive answers  
text_analyst_agent = AssistantAgent(
    name="Text_Analyst_Agent",
    description="An expert in technical communication and descriptive answer evaluation.",
    model_client=model_client, 
    system_message="""You are an expert in technical communication and knowledge assessment. Your task is to evaluate a candidate's descriptive answer.

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

# 4. Report Synthesizer Agent - Compiles final assessment reports
report_synthesizer_agent = AssistantAgent(
    name="Report_Synthesizer_Agent",
    description="A report writer that synthesizes all scoring data into comprehensive assessment reports.",
    model_client=model_client,
    system_message="""You are a professional report writer specialized in technical assessment reports. Your task is to synthesize all the provided scoring data into a single, comprehensive, human-readable report.

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

# 5. User Proxy Agent - Handles tool execution and user interactions
user_proxy_agent = UserProxyAgent(
    name="Admin_User_Proxy",
    description="A proxy agent that executes tools and handles administrative tasks.",
)

# 6. RAG-Enabled Agent - Handles knowledge base queries and context retrieval
def create_rag_agent():
    """
    Creates a RAG-enabled agent for knowledge base queries.
    Falls back to regular AssistantAgent if RetrieveUserProxyAgent is not available.
    """
    if RAG_AVAILABLE:
        try:
            # Configure RetrieveUserProxyAgent with Azure Cosmos DB backend
            rag_agent = RetrieveUserProxyAgent(
                name="RAG_Knowledge_Agent",
                description="A RAG-enabled agent that retrieves context from the knowledge base to answer questions.",
                retrieve_config={
                    "task": "qa",  # Question-answering task
                    "chunk_token_size": 1000,
                    "model": model_client,
                    "client": None,  # Will use our custom query function
                    "embedding_model": "text-embedding-ada-002",
                    "get_or_create": False,  # Don't create new collections
                    "custom_function": query_cosmosdb_for_rag,  # Our RAG retrieval function
                },
                code_execution_config=False,  # Disable code execution for security
                human_input_mode="NEVER",  # Fully automated
                max_consecutive_auto_reply=3,
            )
            return rag_agent
        except Exception as e:
            print(f"Warning: Could not create RetrieveUserProxyAgent: {e}")
            print("Falling back to regular AssistantAgent with RAG tools")
    
    # Fallback: Regular AssistantAgent with RAG tools
    rag_fallback_agent = AssistantAgent(
        name="RAG_Knowledge_Agent",
        description="A knowledge agent that uses RAG tools to answer questions based on the knowledge base.",
        model_client=model_client,
        tools=[query_cosmosdb_for_rag],  # Add RAG tool
        system_message="""You are a knowledge assistant powered by a RAG (Retrieval-Augmented Generation) system. 

Your capabilities:
1. Answer questions about technical assessment topics
2. Retrieve relevant context from the knowledge base using vector similarity search
3. Provide informed responses based on existing questions and solutions

When a user asks a question:
1. Use the query_cosmosdb_for_rag tool to retrieve relevant context
2. Analyze the retrieved information carefully
3. Provide a comprehensive answer that combines the retrieved context with your knowledge
4. If no relevant context is found, provide a general response based on your training

Always be helpful, accurate, and acknowledge when information comes from the knowledge base vs. general knowledge."""
    )
    return rag_fallback_agent

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
def create_question_rewriting_team() -> SelectorGroupChat:
    """
    Create a specialized team for question rewriting and enhancement.
    Uses a single expert agent focused on grammar, clarity, and tagging.
    """
    
    # Question Enhancement Agent - specialized in improving question quality
    question_enhancer = AssistantAgent(
        name="Question_Enhancer",
        description="An expert technical writer specializing in question enhancement and skill tagging.",
        model_client=model_client,
        system_message="""You are an expert technical writer and assessment specialist. Your task is to enhance technical assessment questions.

When given a question, you must:
1. Correct any grammatical errors and improve clarity to avoid ambiguity
2. Determine the most appropriate job role (e.g., 'Frontend Developer', 'Backend Developer', 'Data Scientist', 'Full Stack Developer', 'DevOps Engineer', 'Mobile Developer')
3. Suggest up to three specific skill tags (e.g., 'React Hooks', 'Python Asyncio', 'SQL Joins', 'Docker', 'REST APIs')

CRITICAL: Your response MUST be a single, minified JSON object with this exact schema:
{"rewritten_text": "The improved question text.", "suggested_role": "The single most relevant job role.", "suggested_tags": ["tag1", "tag2", "tag3"]}

Do not include any other text, explanation, or formatting. Only return the JSON object."""
    )
    
    # User proxy for managing the conversation
    user_proxy = UserProxyAgent(
        name="Question_Rewrite_Coordinator",
        description="Coordinates the question rewriting process."
    )
    
    # Create the rewriting team
    participants = [question_enhancer, user_proxy]
    
    return SelectorGroupChat(
        participants=participants,
        model_client=model_client,
        selector_prompt="Select the Question_Enhancer to improve the question quality and provide skill tags.",
        termination_condition=MaxMessageTermination(max_messages=3)
    )


def create_question_generation_team() -> SelectorGroupChat:
    """
    Creates a simplified team for question generation tasks.
    """
    
    question_generator_agent = AssistantAgent(
        name="Question_Generator_Agent",
        description="An expert in creating technical assessment questions.",
        model_client=model_client,
        system_message="""You are an expert in creating technical assessment questions. 

When asked to generate a question, you should:
1. Create questions appropriate for the specified skill level and difficulty
2. Ensure questions are clear, unambiguous, and test the intended competency
3. For coding questions, provide clear problem statements and expected outcomes
4. For MCQs, ensure options are plausible and one clearly correct answer exists
5. For descriptive questions, frame them to elicit comprehensive technical responses

Always format your output as valid JSON with the question structure expected by the platform."""
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
    rag_validator_agent = AssistantAgent(
        name="RAG_Question_Validator",
        description="An expert question validator powered by RAG knowledge retrieval.",
        model_client=model_client,
        tools=[validate_question, query_cosmosdb_for_rag],
        system_message="""You are an expert question validator with access to a comprehensive knowledge base.

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
    
    # Question Answering Agent with RAG
    rag_qa_agent = AssistantAgent(
        name="RAG_QA_Agent", 
        description="A question-answering agent powered by RAG knowledge retrieval.",
        model_client=model_client,
        tools=[query_cosmosdb_for_rag],
        system_message="""You are a technical question-answering assistant with access to a comprehensive knowledge base.

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
    result = await team.run_stream_async(
        task=initial_message,
        termination_condition=MaxMessageTermination(max_messages=10)
    )
    
    # Collect messages from the conversation
    messages: List[BaseChatMessage] = []
    async for message in result:
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
    result = await team.run_stream_async(
        task=task_message,
        termination_condition=TextMentionTermination("COMPLETE")
    )
    
    # Collect generated questions as messages
    messages: List[BaseChatMessage] = []
    async for message in result:
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
    result = await team.run_stream_async(
        task=task_message,
        termination_condition=MaxMessageTermination(max_messages=10)
    )
    
    # Collect messages from the RAG conversation
    messages: List[BaseChatMessage] = []
    async for message in result:
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
    result = await team.run_stream_async(
        task=task_message,
        termination_condition=MaxMessageTermination(max_messages=8)
    )
    
    # Collect validation messages
    messages: List[BaseChatMessage] = []
    async for message in result:
        if isinstance(message, BaseChatMessage):
            messages.append(message)
    
    return messages