import hashlib
import json
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
import os

# Assume endpoint and database/container names are in environment variables
COSMOS_ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT", "https://mock-cosmos.documents.azure.com:443/")
DATABASE_NAME = os.environ.get("COSMOS_DB_DATABASE", "YourDatabaseName")

# Setup Cosmos DB client using Entra ID Managed Identity
try:
    credential = DefaultAzureCredential()
    client = CosmosClient(url=COSMOS_ENDPOINT, credential=credential)
    database = client.get_database_client(DATABASE_NAME)
    submissions_container = database.get_container_client("Submissions")
    assessments_container = database.get_container_client("Assessments")
    generated_questions_container = database.get_container_client("GeneratedQuestions")
except Exception as e:
    print(f"Warning: Could not initialize Cosmos DB client: {e}")
    print("Using mock database client for development")
    # Mock containers for development
    class MockContainer:
        def read_item(self, item, partition_key): 
            return {"mock": "data", "id": item}
    
    submissions_container = MockContainer()
    assessments_container = MockContainer()
    generated_questions_container = MockContainer()

def fetch_submission_data(submission_id: str) -> str:
    """
    Fetches the full submission and its corresponding assessment data from Cosmos DB.
    Returns a JSON string containing both documents.
    """
    print(f"TOOL: Fetching data for submission_id: {submission_id}")
    submission = submissions_container.read_item(item=submission_id, partition_key=submission_id)
    assessment = assessments_container.read_item(item=submission['assessmentId'], partition_key=submission['assessmentId'])
    
    combined_data = {
        "submission": submission,
        "assessment": assessment
    }
    return json.dumps(combined_data)

def score_mcqs(submission_data_json: str) -> str:
    """
    Scores only the Multiple Choice Questions from the submission data deterministically.
    Returns a JSON string with a list of MCQ results.
    """
    print("TOOL: Scoring MCQs deterministically.")
    data = json.loads(submission_data_json)
    submission = data["submission"]
    assessment = data["assessment"]
    
    mcq_results = []
    
    questions_map = {q['id']: q for q in assessment['questions']}
    
    for answer in submission['answers']:
        question = questions_map.get(answer['questionId'])
        if question and question['type'] == 'mcq':
            is_correct = (answer['submittedAnswer'] == question['correctAnswer'])
            mcq_results.append({
                "questionId": answer['questionId'],
                "is_correct": is_correct
            })
            
    return json.dumps(mcq_results)

def generate_question_from_ai(skill: str, question_type: str, difficulty: str) -> str:
    """
    A placeholder for the hybrid question generation logic.
    Checks cache first, then calls OpenAI if needed.
    For this example, we'll simulate a cache miss.
    """
    print(f"TOOL: Generating new AI question for skill: {skill}")
    prompt = f"Generate a {difficulty} {question_type} question about {skill}."
    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
    
    # Use the prompt hash for caching and identification
    print(f"Question prompt hash: {prompt_hash[:8]}... (for caching)")

    # In a real implementation, you would query generated_questions_container here.
    # For now, we simulate calling OpenAI and returning a new question.
    
    # This is where you would call the Question_Generator_Agent
    # For simplicity in this tool definition, we are returning a mock response.
    mock_ai_question = {
        "text": f"This is a newly generated {difficulty} {question_type} question about {skill}.",
        "prompt_hash": prompt_hash,  # Include hash for question tracking
        # ... other fields like options, correct answer etc.
    }
    
    # You would then save this to your `GeneratedQuestions` container.
    print("TOOL: Caching new question.")
    
    return json.dumps(mock_ai_question)
