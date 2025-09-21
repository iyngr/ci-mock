import hashlib
import json
from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
import os
import pathlib

# Load .env file if present so running uvicorn from the llm-agent folder picks up local env values
# Simple loader (no external dependency) - supports KEY=VALUE and commented lines.
try:
    env_path = pathlib.Path(__file__).parent / ".env"
    if env_path.exists():
        with env_path.open('r', encoding='utf-8') as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                k, v = line.split('=', 1)
                k = k.strip()
                v = v.strip().strip('"')
                # Only set if not already in environment
                if k and k not in os.environ:
                    os.environ[k] = v
except Exception:
    # Do not fail import if .env parsing has issues
    pass
from typing import Dict, Any

# Assume endpoint and database/container names are in environment variables
COSMOS_ENDPOINT = os.environ.get("COSMOS_DB_ENDPOINT", "")
# Prefer backend naming: DATABASE_NAME. Keep fallbacks for older names for compatibility.
DATABASE_NAME = os.environ.get("DATABASE_NAME") or os.environ.get("COSMOS_DB_NAME") or os.environ.get("COSMOS_DB_DATABASE") or "YourDatabaseName"
# Optional key fallback for transactional DB (kept for compatibility)
COSMOS_DB_KEY = os.environ.get("COSMOS_DB_KEY", "")
# Optional preferred locations (backend supports COSMOS_DB_PREFERRED_LOCATIONS)
COSMOS_DB_PREFERRED_LOCATIONS = os.environ.get("COSMOS_DB_PREFERRED_LOCATIONS", "")

# RAG (serverless/vector) Cosmos settings (optional)
RAG_COSMOS_ENDPOINT = os.environ.get("RAG_COSMOS_DB_ENDPOINT", "")
# Use backend's RAG_COSMOS_DB_DATABASE name if present; fallback to previous var name
RAG_COSMOS_DATABASE = os.environ.get("RAG_COSMOS_DB_DATABASE") or os.environ.get("RAG_COSMOS_DB_DATABASE_NAME") or "ragdb"
RAG_COSMOS_KEY = os.environ.get("RAG_COSMOS_DB_KEY", "")

# Setup transactional Cosmos DB client
client = None
database = None
submissions_container = None
assessments_container = None
generated_questions_container = None

try:
    if COSMOS_DB_KEY:
        # Key-based auth fallback
        client = CosmosClient(url=COSMOS_ENDPOINT, credential=COSMOS_DB_KEY)
        print("COSMOS: Using key-based authentication for transactional Cosmos client")
    else:
        credential = DefaultAzureCredential()
        client = CosmosClient(url=COSMOS_ENDPOINT, credential=credential)
        print("COSMOS: Using DefaultAzureCredential (AAD) for transactional Cosmos client")

    database = client.get_database_client(DATABASE_NAME)
    submissions_container = database.get_container_client("Submissions")
    assessments_container = database.get_container_client("Assessments")
    generated_questions_container = database.get_container_client("GeneratedQuestions")
    print(f"Initialized transactional Cosmos client for database: {DATABASE_NAME}")
except Exception as e:
    print(f"Warning: Could not initialize transactional Cosmos DB client: {e}")
    print("Using mock database client for development")
    # Mock containers for development
    class MockContainer:
        def read_item(self, item, partition_key): 
            return {"mock": "data", "id": item}

    submissions_container = MockContainer()
    assessments_container = MockContainer()
    generated_questions_container = MockContainer()

# Setup optional RAG client (serverless/vector account)
rag_client = None
rag_database = None
rag_knowledge_container = None
if RAG_COSMOS_ENDPOINT:
    try:
        if RAG_COSMOS_KEY:
            rag_client = CosmosClient(url=RAG_COSMOS_ENDPOINT, credential=RAG_COSMOS_KEY)
            print("COSMOS-RAG: Using key-based authentication for RAG Cosmos client")
        else:
            rag_cred = DefaultAzureCredential()
            rag_client = CosmosClient(url=RAG_COSMOS_ENDPOINT, credential=rag_cred)
            print("COSMOS-RAG: Using DefaultAzureCredential (AAD) for RAG Cosmos client")

        rag_database = rag_client.get_database_client(RAG_COSMOS_DATABASE)
        rag_knowledge_container = rag_database.get_container_client("KnowledgeBase")
        print(f"Initialized RAG Cosmos client for database: {RAG_COSMOS_DATABASE}")
    except Exception as e:
        print(f"Warning: Could not initialize RAG Cosmos DB client: {e}")
        rag_client = None
        rag_database = None
        rag_knowledge_container = None

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

async def query_cosmosdb_for_rag(query_text: str, skill: str | None = None, limit: int = 5, threshold: float = 0.7) -> str:
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
        
        # Validate and clamp parameters
        try:
            limit = int(limit)
        except Exception:
            limit = 5
        # enforce sane bounds
        if limit <= 0:
            limit = 5
        if limit > 50:
            limit = 50

        try:
            threshold = float(threshold)
        except Exception:
            threshold = 0.7
        # clamp threshold between 0.0 and 1.0
        threshold = max(0.0, min(1.0, threshold))

        # Generate embedding for the query (use canonical env var with fallback)
        print(f"Generating embedding for query (skill={skill}, limit={limit}, threshold={threshold})...")
        embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
        embedding_response = await openai_client.embeddings.create(
            model=embed_model,
            input=query_text
        )
        query_embedding = embedding_response.data[0].embedding
        
        # Get KnowledgeBase container: prefer RAG client if configured
        knowledge_base_container = None
        if rag_knowledge_container is not None:
            knowledge_base_container = rag_knowledge_container
        else:
            try:
                knowledge_base_container = database.get_container_client("KnowledgeBase")
            except Exception:
                print("Warning: KnowledgeBase container not accessible, using mock response")
                return f"Mock context: Based on similar questions about '{query_text}', here are relevant patterns..."
        
    # Perform vector similarity search using Cosmos DB vector search
        # Note: This requires Cosmos DB vector search capabilities
        try:
            # Vector search query - build parameterized, partition-aware query
            # If skill is provided, filter by skill (and use partition_key where possible) to reduce RU
            similarity_fn = "VectorDistance"

            # We'll iterate pages and capture request charge per page
            total_request_charge = 0.0
            items = []

            if skill:
                vector_search_query = f"""
                SELECT TOP {limit} c.content, c.skill
                FROM c
                WHERE c.skill = @skill AND {similarity_fn}(c.embedding, @queryEmbedding) > @threshold
                ORDER BY {similarity_fn}(c.embedding, @queryEmbedding)
                """
                parameters = [
                    {"name": "@queryEmbedding", "value": query_embedding},
                    {"name": "@skill", "value": skill},
                    {"name": "@threshold", "value": threshold}
                ]
                try:
                    iterator = knowledge_base_container.query_items(
                        query=vector_search_query,
                        parameters=parameters,
                        enable_cross_partition_query=False,
                        partition_key=skill
                    )
                except TypeError:
                    iterator = knowledge_base_container.query_items(
                        query=vector_search_query,
                        parameters=parameters,
                        enable_cross_partition_query=True
                    )
            else:
                vector_search_query = f"""
                SELECT TOP {limit} c.content, c.skill
                FROM c
                WHERE {similarity_fn}(c.embedding, @queryEmbedding) > @threshold
                ORDER BY {similarity_fn}(c.embedding, @queryEmbedding)
                """
                parameters = [
                    {"name": "@queryEmbedding", "value": query_embedding},
                    {"name": "@threshold", "value": threshold}
                ]
                iterator = knowledge_base_container.query_items(
                    query=vector_search_query,
                    parameters=parameters,
                    enable_cross_partition_query=True
                )

            # Try to iterate by pages to collect per-page RU charges
            try:
                pages = iterator.by_page()
            except Exception:
                pages = [iterator]

            for page_idx, page in enumerate(pages):
                try:
                    page_items = list(page)
                except TypeError:
                    page_items = list(page)
                items.extend(page_items)

                # Diagnostic: try to capture headers from different SDK representations
                headers = None
                header_sources = {}
                try:
                    if hasattr(page, 'headers'):
                        headers = getattr(page, 'headers')
                        header_sources['page.headers'] = headers
                    if hasattr(page, '_response') and getattr(page, '_response') is not None:
                        resp = getattr(page, '_response')
                        try:
                            header_sources['page._response.headers'] = resp.headers
                        except Exception:
                            header_sources['page._response.headers'] = None
                except Exception as e:
                    header_sources['headers_error'] = str(e)

                # Container-level last response headers (SDK exposes this in client_connection)
                try:
                    client_last_headers = getattr(knowledge_base_container, 'client_connection', None)
                    if client_last_headers is not None and hasattr(knowledge_base_container.client_connection, 'last_response_headers'):
                        header_sources['container.client_connection.last_response_headers'] = knowledge_base_container.client_connection.last_response_headers
                except Exception as e:
                    header_sources['client_connection_error'] = str(e)

                # Sum any request charge values we find
                found_charge = 0.0
                for k, h in header_sources.items():
                    try:
                        if h and 'x-ms-request-charge' in h:
                            found_charge = float(h['x-ms-request-charge'])
                            total_request_charge += found_charge
                            # keep scanning but log the first found value
                    except Exception:
                        pass

                # (diagnostic logging removed)

            results = items

        except Exception as e:
            print(f"Vector search not available, using fallback: {e}")
            # Fallback: regular text-based search, capture RU similarly
            total_request_charge = 0.0
            fallback_query = f"SELECT TOP 5 c.content, c.skill FROM c WHERE CONTAINS(LOWER(c.content), LOWER(@query))"
            parameters = [{"name": "@query", "value": query_text}]
            iterator = knowledge_base_container.query_items(
                query=fallback_query,
                parameters=parameters,
                enable_cross_partition_query=True
            )

            try:
                pages = iterator.by_page()
            except Exception:
                pages = [iterator]

            items = []
            for page in pages:
                try:
                    page_items = list(page)
                except TypeError:
                    page_items = list(page)
                items.extend(page_items)

                headers = None
                if hasattr(page, 'headers'):
                    headers = getattr(page, 'headers')
                elif hasattr(page, '_response') and getattr(page, '_response') is not None:
                    headers = getattr(page, '_response').headers if getattr(page, '_response', None) else None

                if headers and 'x-ms-request-charge' in headers:
                    try:
                        total_request_charge += float(headers['x-ms-request-charge'])
                    except Exception:
                        pass

            results = items
        
        # Format results into a structured document list (preferred) and also
        # keep a human-readable context string for backward compatibility.
        # If per-page aggregation produced zero, fall back to the container-level
        # last_response_headers x-ms-request-charge value when available.
        try:
            container_charge_fallback = None
            if hasattr(knowledge_base_container, 'client_connection') and hasattr(knowledge_base_container.client_connection, 'last_response_headers'):
                container_charge_fallback = knowledge_base_container.client_connection.last_response_headers.get('x-ms-request-charge')
                if container_charge_fallback is not None and float(total_request_charge) == 0.0:
                    try:
                        total_request_charge = float(container_charge_fallback)
                    except Exception:
                        # leave total_request_charge as-is if parse fails
                        pass
        except Exception:
            pass

        request_charge_value = float(total_request_charge) if 'total_request_charge' in locals() else 0.0

        documents = []
        # capture the last header_sources seen so we can return a minimal diagnostic sample
        last_header_sources = {}

        if results:
            for result in results[:limit]:
                content = result.get('content', '')
                skill = result.get('skill', 'unknown')

                documents.append({
                    "content": content,
                    "skill": skill
                })

            # Also produce a fallback human-readable context for older callers
            context_parts = []
            for i, doc in enumerate(documents, 1):
                context_parts.append(f"""
{i}. Skill: {doc['skill']}
   Content: {doc['content']}""")

            context = f"""
Based on the knowledge base search for '{query_text}', here are the most relevant documents:

{''.join(context_parts)}

Use this context to provide a comprehensive answer to the user's question.
"""
            return {"documents": documents, "context": context, "request_charge": request_charge_value}

        else:
            print("No relevant documents found in knowledge base")
            return {"documents": [], "context": f"No specific context found for '{query_text}'. Please provide a general response based on your knowledge.", "request_charge": request_charge_value}
            
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
                
                embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                response = await client.embeddings.create(
                    model=embed_model,
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
