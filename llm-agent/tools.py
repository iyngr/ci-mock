import hashlib
import json
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
import os
from typing import Dict, Any

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

def validate_question_exact_match(question_text: str) -> Dict[str, Any]:
    """
    Phase 1 validation: Check for exact duplicate using SHA256 hash.
    Returns status and matching question if found.
    """
    print(f"TOOL: Checking exact match for question: {question_text[:50]}...")
    
    # Generate SHA256 hash of the question text
    question_hash = hashlib.sha256(question_text.strip().lower().encode()).hexdigest()
    print(f"Question hash: {question_hash[:8]}...")
    
    try:
        # Query assessments container for exact hash match
        # In production, this would query the actual database
        # For development, we simulate the check
        
        # Mock check - in real implementation, query Cosmos DB
        # query = f"SELECT * FROM c WHERE c.question_hash = '{question_hash}'"
        # existing_questions = list(assessments_container.query_items(query=query))
        
        # For demo purposes, simulate occasional duplicates
        mock_existing_questions = []
        if "duplicate" in question_text.lower():
            mock_existing_questions = [{"id": "existing_q1", "text": question_text}]
        
        if mock_existing_questions:
            print("Exact duplicate found!")
            return {
                "status": "exact_duplicate",
                "existing_question": mock_existing_questions[0],
                "question_hash": question_hash
            }
        else:
            print("No exact duplicate found")
            return {
                "status": "unique_hash",
                "question_hash": question_hash
            }
            
    except Exception as e:
        print(f"Error in exact match validation: {e}")
        return {
            "status": "validation_error",
            "error": str(e),
            "question_hash": question_hash
        }

def validate_question_similarity(question_text: str) -> Dict[str, Any]:
    """
    Phase 2 validation: Check for semantic similarity using vector embeddings.
    Returns status and similar questions if found above threshold.
    """
    print(f"TOOL: Checking semantic similarity for question: {question_text[:50]}...")
    
    try:
        # In production, this would:
        # 1. Generate vector embedding for the question text using Azure OpenAI
        # 2. Perform vector similarity search against KnowledgeBase container
        # 3. Return results above similarity threshold (e.g., 0.95)
        
        # Mock similarity check - simulate finding similar questions
        mock_similar_questions = []
        
        # Simulate similarity detection based on keywords
        similarity_keywords = ["algorithm", "complexity", "sorting", "search", "array"]
        question_lower = question_text.lower()
        
        for keyword in similarity_keywords:
            if keyword in question_lower:
                # Simulate finding 1-2 similar questions
                mock_similar_questions.append({
                    "id": f"similar_{keyword}_q1",
                    "text": f"Related question about {keyword} algorithms",
                    "similarity_score": 0.87
                })
                break
        
        if mock_similar_questions:
            print(f"Found {len(mock_similar_questions)} similar questions")
            return {
                "status": "similar_duplicate",
                "similar_questions": mock_similar_questions,
                "similarity_threshold": 0.85
            }
        else:
            print("No similar questions found")
            return {
                "status": "unique"
            }
            
    except Exception as e:
        print(f"Error in similarity validation: {e}")
        return {
            "status": "validation_error", 
            "error": str(e)
        }

# ===========================
# RAG SYSTEM FUNCTIONS
# ===========================

async def query_cosmosdb_for_rag(query_text: str) -> str:
    """
    RAG retrieval function: generates embedding for query and performs 
    vector similarity search against KnowledgeBase container.
    
    Args:
        query_text: The user's question or query
        
    Returns:
        Formatted context string from top relevant documents
    """
    print(f"RAG TOOL: Searching knowledge base for: {query_text[:50]}...")
    
    try:
        # Import Azure OpenAI for embedding generation
        try:
            import openai
            from azure.core.credentials import AzureKeyCredential
        except ImportError:
            print("Warning: Azure OpenAI not available, using mock RAG response")
            return f"Mock context for query: {query_text}"
        
        # Initialize Azure OpenAI client
        openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        openai_key = os.getenv('AZURE_OPENAI_API_KEY')
        
        if not openai_endpoint or not openai_key:
            print("Warning: Azure OpenAI not configured, using mock RAG response")
            return f"Mock context for query: {query_text}"
        
        # Create OpenAI client
        openai_client = openai.AsyncAzureOpenAI(
            azure_endpoint=openai_endpoint,
            api_key=openai_key,
            api_version="2024-02-15-preview"
        )
        
        # Generate embedding for the query
        print("Generating embedding for query...")
        embedding_response = await openai_client.embeddings.create(
            model="text-embedding-ada-002",
            input=query_text
        )
        query_embedding = embedding_response.data[0].embedding
        
        # Get KnowledgeBase container
        try:
            knowledge_base_container = database.get_container_client("KnowledgeBase")
        except:
            print("Warning: KnowledgeBase container not accessible, using mock response")
            return f"Mock context: Based on similar questions about '{query_text}', here are relevant patterns..."
        
        # Perform vector similarity search using Cosmos DB vector search
        # Note: This requires Cosmos DB vector search capabilities
        try:
            # Vector search query - syntax may vary based on Cosmos DB vector search implementation
            vector_search_query = """
            SELECT TOP 5 c.content, c.skill, VectorDistance(c.embedding, @queryEmbedding) AS similarity_score
            FROM c 
            WHERE VectorDistance(c.embedding, @queryEmbedding) > 0.7
            ORDER BY VectorDistance(c.embedding, @queryEmbedding) DESC
            """
            
            parameters = [
                {"name": "@queryEmbedding", "value": query_embedding}
            ]
            
            results = list(knowledge_base_container.query_items(
                query=vector_search_query,
                parameters=parameters,
                enable_cross_partition_query=True
            ))
            
        except Exception as e:
            print(f"Vector search not available, using fallback: {e}")
            # Fallback: regular text-based search
            fallback_query = f"SELECT TOP 5 c.content, c.skill FROM c WHERE CONTAINS(LOWER(c.content), LOWER('{query_text}'))"
            results = list(knowledge_base_container.query_items(
                query=fallback_query,
                enable_cross_partition_query=True
            ))
        
        # Format results into context string
        if results:
            context_parts = []
            for i, result in enumerate(results[:5], 1):
                content = result.get('content', '')
                skill = result.get('skill', 'unknown')
                similarity = result.get('similarity_score', 'N/A')
                
                context_parts.append(f"""
{i}. Skill: {skill}
   Content: {content}
   Relevance: {similarity}""")
            
            context = f"""
Based on the knowledge base search for '{query_text}', here are the most relevant documents:

{''.join(context_parts)}

Use this context to provide a comprehensive answer to the user's question.
"""
            print(f"Found {len(results)} relevant documents")
            return context
            
        else:
            print("No relevant documents found in knowledge base")
            return f"No specific context found for '{query_text}'. Please provide a general response based on your knowledge."
            
    except Exception as e:
        print(f"Error in RAG retrieval: {e}")
        return f"Error retrieving context for '{query_text}'. Please provide a response based on general knowledge."


def validate_question(question_text: str) -> dict:
    """
    Enhanced validation function that performs both exact hash matching 
    and vector similarity detection.
    
    Args:
        question_text: The question text to validate
        
    Returns:
        Dict with validation status and details
    """
    print(f"VALIDATION TOOL: Validating question: {question_text[:50]}...")
    
    try:
        # Phase 1: Exact hash matching
        exact_result = validate_question_exact_match(question_text)
        
        if exact_result["status"] == "exact_duplicate":
            print("Exact duplicate found in Phase 1")
            return {
                "status": "exact_duplicate",
                "existing_question": exact_result.get("existing_question"),
                "question_hash": exact_result.get("question_hash")
            }
        
        # Phase 2: Vector similarity check (only if no exact match)
        if exact_result["status"] == "unique_hash":
            print("No exact match, checking for similarity...")
            similarity_result = validate_question_similarity(question_text)
            
            if similarity_result["status"] == "similar_duplicate":
                print("Similar questions found in Phase 2")
                return {
                    "status": "similar_duplicate",
                    "similar_questions": similarity_result.get("similar_questions", []),
                    "similarity_threshold": similarity_result.get("similarity_threshold", 0.85),
                    "question_hash": exact_result.get("question_hash")
                }
        
        # Phase 3: Generate embedding for unique questions (for later use)
        print("Question appears to be unique, generating embedding...")
        try:
            import asyncio
            import openai
            
            # Get embedding for the unique question
            async def get_embedding():
                openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
                openai_key = os.getenv('AZURE_OPENAI_API_KEY')
                
                if not openai_endpoint or not openai_key:
                    return None
                
                client = openai.AsyncAzureOpenAI(
                    azure_endpoint=openai_endpoint,
                    api_key=openai_key,
                    api_version="2024-02-15-preview"
                )
                
                response = await client.embeddings.create(
                    model="text-embedding-ada-002",
                    input=question_text
                )
                return response.data[0].embedding
            
            # Run async function
            embedding = asyncio.run(get_embedding()) if asyncio.get_event_loop().is_running() == False else None
            
            return {
                "status": "unique",
                "question_hash": exact_result.get("question_hash"),
                "embedding": embedding,
                "message": "Question is unique and ready to be added"
            }
            
        except Exception as e:
            print(f"Warning: Could not generate embedding: {e}")
            return {
                "status": "unique",
                "question_hash": exact_result.get("question_hash"),
                "embedding": None,
                "message": "Question is unique (embedding generation failed)"
            }
    
    except Exception as e:
        print(f"Error in question validation: {e}")
        return {
            "status": "validation_error",
            "error": str(e),
            "message": "Validation failed due to system error"
        }
