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
from tools import fetch_submission_data, score_mcqs, generate_question_from_ai

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
