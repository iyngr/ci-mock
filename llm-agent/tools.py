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
    generated_questions_container = database.get_container_client("generated_questions")
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
    
    # This is where you would call the Question_Generator_Agent. For now we
    # generate the question structure and attempt to persist it to generated_questions
    ai_question = {
        "text": f"This is a newly generated {difficulty} {question_type} question about {skill}.",
        "prompt_hash": prompt_hash,
        "skill": skill,
        "question_type": question_type,
        "difficulty": difficulty,
        # Placeholders for richer fields
        "options": [],
        "correct_answer": None,
    }

    # Transform to Cosmos/Pydantic alias names expected by GeneratedQuestion model
    cosmos_doc = {
        # id: prefer any provided id, else build from hash (DB layer will also generate if missing)
        "id": ai_question.get("id") or f"gq_{prompt_hash[:12]}",
        "promptHash": ai_question["prompt_hash"],
        "skill": ai_question["skill"],
        "questionType": ai_question["question_type"],
        "difficulty": ai_question["difficulty"],
        "generatedText": ai_question["text"],
        "originalPrompt": ai_question.get("original_prompt", ai_question["text"]),
        "generatedBy": os.getenv("AI_GENERATOR_NAME", "gpt-5-mini"),
        # Type specific optional fields
        "generatedOptions": ai_question.get("options") or None,
        "generatedCorrectAnswer": ai_question.get("correct_answer")
    }

    # Attempt to persist to generated_questions_container when available
    saved = None
    try:
        if hasattr(generated_questions_container, "upsert_item"):
            # Use the mapped cosmos_doc with aliases and explicit id
            saved = generated_questions_container.upsert_item(cosmos_doc)
            print(f"TOOL: Saved generated question to generated_questions (id={saved.get('id')})")
        elif hasattr(generated_questions_container, "create_item"):
            saved = generated_questions_container.create_item(cosmos_doc)
            print(f"TOOL: Created generated question in generated_questions (id={saved.get('id')})")
    except Exception as e:
        print(f"Warning: could not persist generated question: {e}")

    # If we successfully persisted, attempt to generate and store an embedding
    if saved is not None:
        try:
            # Attempt to import the OpenAI SDK and create an embedding
            try:
                import openai
            except Exception:
                openai = None

            query_embedding = None
            if openai is not None:
                openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
                openai_key = os.getenv('AZURE_OPENAI_API_KEY')
                if openai_endpoint and openai_key:
                    try:
                        # Prefer synchronous client if available
                        if hasattr(openai, 'AzureOpenAI'):
                            client = openai.AzureOpenAI(
                                azure_endpoint=openai_endpoint,
                                api_key=openai_key,
                                api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
                            )
                            embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                            resp = client.embeddings.create(model=embed_model, input=ai_question['text'])
                            query_embedding = resp.data[0].embedding
                        elif hasattr(openai, 'AsyncAzureOpenAI'):
                            import asyncio

                            async def _embed_async(text: str):
                                client = openai.AsyncAzureOpenAI(
                                    azure_endpoint=openai_endpoint,
                                    api_key=openai_key,
                                    api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
                                )
                                embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                                resp = await client.embeddings.create(model=embed_model, input=text)
                                return resp.data[0].embedding

                            try:
                                import asyncio as _asyncio
                                if not _asyncio.get_event_loop().is_running():
                                    query_embedding = _asyncio.run(_embed_async(ai_question['text']))
                            except Exception:
                                query_embedding = None
                    except Exception as e:
                        print(f"Warning: embedding generation failed for generated question: {e}")

            # Persist embedding into the KnowledgeBase container if available
            if query_embedding is not None:
                try:
                    kb = rag_knowledge_container if rag_knowledge_container is not None else None
                    if kb is None and database is not None:
                        try:
                            kb = database.get_container_client("KnowledgeBase")
                        except Exception:
                            kb = None

                    if kb is not None:
                        kb_doc = {
                            "id": saved.get('id') or hashlib.sha256(ai_question['text'].encode()).hexdigest(),
                            "content": ai_question['text'],
                            "skill": ai_question.get('skill'),
                            "embedding": query_embedding,
                        }
                        try:
                            if hasattr(kb, 'upsert_item'):
                                kb.upsert_item(kb_doc)
                            else:
                                kb.create_item(kb_doc)
                            print(f"TOOL: Stored embedding in KnowledgeBase for generated question id={kb_doc['id']}")
                        except Exception as e:
                            print(f"Warning: Could not persist KB embedding: {e}")
                except Exception as e:
                    print(f"Warning: embedding storage skipped: {e}")

        except Exception as e:
            print(f"Warning: embedding generation encountered an error: {e}")

        try:
            return json.dumps(saved)
        except Exception:
            pass

    # If persistence is not available, fall back to returning the in-memory object
    print("TOOL: Returning generated question without persistence")
    return json.dumps(ai_question)


# Per-phase validator fragments removed. A single `validate_question` implementation
# is defined below (after the RAG retrieval function) and performs:
# 1) exact content match against KnowledgeBase/generated_questions
# 2) semantic similarity via embeddings (when available)
# 3) token-overlap heuristic fallback

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
        # Import Azure OpenAI if available; we'll only use embeddings when the SDK
        # and configuration are present. Otherwise we'll fall back to text search
        # against the KnowledgeBase container below.
        openai = None
        try:
            import openai as _openai
            openai = _openai
        except Exception:
            print("Warning: Azure OpenAI SDK not available; will use text-based fallback for RAG")

        # Initialize Azure OpenAI client only when endpoint+key and SDK are present
        openai_client = None
        openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
        openai_key = os.getenv('AZURE_OPENAI_API_KEY')
        if openai is not None and openai_endpoint and openai_key:
            # Warn if legacy AZURE_OPENAI_MODEL is present (do not use it at runtime)
            if os.getenv("AZURE_OPENAI_MODEL"):
                print("Warning: AZURE_OPENAI_MODEL is set but is ignored at runtime. Use AZURE_OPENAI_DEPLOYMENT_NAME or AZURE_OPENAI_EMBED_DEPLOYMENT instead.")
            try:
                openai_client = openai.AsyncAzureOpenAI(
                    azure_endpoint=openai_endpoint,
                    api_key=openai_key,
                    api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
                )
            except Exception as e:
                print(f"Warning: could not initialize AsyncAzureOpenAI client: {e}; falling back to text search")
        
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

        # Generate embedding for the query only if we have a working client.
        print(f"Generating embedding for query (skill={skill}, limit={limit}, threshold={threshold})...")
        query_embedding = None
        if openai_client is not None:
            try:
                embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                embedding_response = await openai_client.embeddings.create(
                    model=embed_model,
                    input=query_text
                )
                query_embedding = embedding_response.data[0].embedding
            except Exception as e:
                print(f"Warning: embedding generation failed: {e}; will fall back to text search")
        
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

            # Only attempt vector search when we have a query_embedding
            if query_embedding is not None:
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
            else:
                # No embedding available; raise to trigger the fallback text search
                raise RuntimeError("No query embedding available; skipping vector search")

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
                    import logging
                    logging.getLogger(__name__).exception('Failed to read page headers')
                    header_sources['headers_error'] = None

                # Container-level last response headers (SDK exposes this in client_connection)
                try:
                    client_last_headers = getattr(knowledge_base_container, 'client_connection', None)
                    if client_last_headers is not None and hasattr(knowledge_base_container.client_connection, 'last_response_headers'):
                        header_sources['container.client_connection.last_response_headers'] = knowledge_base_container.client_connection.last_response_headers
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).exception('Failed to read container client_connection headers')
                    header_sources['client_connection_error'] = None

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
            import logging
            logging.getLogger(__name__).exception('Vector search not available, using fallback')
            # Fallback: regular text-based search, capture RU similarly
            total_request_charge = 0.0
            fallback_query = "SELECT TOP 5 c.content, c.skill FROM c WHERE CONTAINS(LOWER(c.content), LOWER(@query))"
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
    """Enhanced validation function that performs both exact hash matching
    and vector similarity detection.

    Steps:
      1) Exact content match against KnowledgeBase and generated_questions
      2) Semantic similarity check using embeddings (when available)
      3) Token-overlap heuristic fallback

    Returns a dict with one of the statuses:
      - exact_duplicate: includes existing_question and question_hash
      - similar_duplicate: includes similar_questions and similarity_threshold
      - unique: includes question_hash
      - validation_error: includes error details
    """
    try:
        # Compute a stable hash for the question for deduplication and telemetry
        question_hash = hashlib.sha256((question_text or "").encode()).hexdigest()

        # 1) Exact match: check KnowledgeBase first, then generated_questions
        existing_questions = []

        kb = rag_knowledge_container if rag_knowledge_container is not None else None
        if kb is None and database is not None:
            try:
                kb = database.get_container_client("KnowledgeBase")
            except Exception:
                kb = None

        if kb is not None and hasattr(kb, "query_items"):
            try:
                safe_text = (question_text or "").replace("'", "''")
                q = f"SELECT TOP 1 c.id, c.content FROM c WHERE c.content = '{safe_text}'"
                kb_items = list(kb.query_items(query=q, enable_cross_partition_query=True))
                for it in kb_items:
                    existing_questions.append({"id": it.get("id"), "text": it.get("content")})
            except Exception:
                # Ignore KB exact-match errors and continue to other checks
                pass

        # Also check generated_questions container as a fallback exact-match
        if not existing_questions and generated_questions_container is not None and hasattr(generated_questions_container, "query_items"):
            try:
                safe_text = (question_text or "").replace("'", "''")
                q2 = f"SELECT TOP 1 c.id, c.text FROM c WHERE c.text = '{safe_text}'"
                gen_items = list(generated_questions_container.query_items(query=q2, enable_cross_partition_query=True))
                for it in gen_items:
                    existing_questions.append({"id": it.get("id"), "text": it.get("text")})
            except Exception:
                pass

        if existing_questions:
            first = existing_questions[0]
            print("Exact duplicate found in DB")
            return {
                "status": "exact_duplicate",
                "existing_question": {"id": first.get("id"), "text": first.get("text")},
                "question_hash": question_hash,
            }

        # 2) Semantic similarity: attempt to generate embedding for the query
        query_embedding = None
        try:
            try:
                import openai
            except Exception:
                openai = None

            if openai is not None:
                openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
                openai_key = os.getenv('AZURE_OPENAI_API_KEY')
                if openai_endpoint and openai_key:
                    try:
                        # Prefer synchronous client if available; fall back to async via asyncio.run
                        if hasattr(openai, 'AzureOpenAI'):
                            client = openai.AzureOpenAI(
                                azure_endpoint=openai_endpoint,
                                api_key=openai_key,
                                api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
                            )
                            embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                            resp = client.embeddings.create(model=embed_model, input=question_text)
                            query_embedding = resp.data[0].embedding
                        elif hasattr(openai, 'AsyncAzureOpenAI'):
                            import asyncio

                            async def _embed_async(text: str):
                                client = openai.AsyncAzureOpenAI(
                                    azure_endpoint=openai_endpoint,
                                    api_key=openai_key,
                                    api_version=os.getenv('AZURE_OPENAI_API_VERSION', '2024-02-15-preview')
                                )
                                embed_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
                                resp = await client.embeddings.create(model=embed_model, input=text)
                                return resp.data[0].embedding

                            try:
                                # Only use asyncio.run when there is no running loop
                                import asyncio as _asyncio
                                if not _asyncio.get_event_loop().is_running():
                                    query_embedding = _asyncio.run(_embed_async(question_text))
                            except Exception:
                                query_embedding = None
                    except Exception:
                        query_embedding = None
        except Exception:
            query_embedding = None

        # Gather candidates from KnowledgeBase (and fall back to generated_questions)
        candidates = []
        if kb is not None and hasattr(kb, "query_items"):
            try:
                items = list(kb.query_items(query="SELECT TOP 500 c.id, c.content, c.embedding FROM c", enable_cross_partition_query=True))
                for it in items:
                    candidates.append({"id": it.get("id"), "text": it.get("content"), "embedding": it.get("embedding")})
            except Exception:
                pass

        # 2a) If we have embeddings, prefer server-side vector search (VectorDistance)
        # This is more efficient at scale. If vector search is unavailable or fails,
        # fall back to local cosine similarity computation over candidates.
        if query_embedding:
            threshold = float(os.getenv('SIMILARITY_THRESHOLD', '0.75'))
            try:
                # Attempt Cosmos VectorDistance query (TOP K) scoped to candidates/skill when possible
                kb = kb if 'kb' in locals() and kb is not None else None
                if kb is None and database is not None:
                    try:
                        kb = database.get_container_client("KnowledgeBase")
                    except Exception:
                        kb = None

                if kb is not None:
                    # Use TOP K vector search to get closest documents (reduce RU cost)
                    K = int(os.getenv('DEDUP_VECTOR_TOP_K', '50'))
                    similarity_fn = 'VectorDistance'
                    # NOTE: validate_question does not know the 'skill' partition key.
                    # Run an unpartitioned TOP-K vector search as a conservative dedupe step.
                    vector_search_query = f"""
                    SELECT TOP {K} c.id, c.content, c.embedding, {similarity_fn}(c.embedding, @queryEmbedding) AS score
                    FROM c
                    ORDER BY {similarity_fn}(c.embedding, @queryEmbedding)
                    """
                    parameters = [{"name": "@queryEmbedding", "value": query_embedding}]
                    iterator = kb.query_items(query=vector_search_query, parameters=parameters, enable_cross_partition_query=True)

                    items = list(iterator)
                    # Cosmos 'VectorDistance' may be a distance (smaller=closer) depending on deployment.
                    # We'll interpret scores conservatively: treat higher absolute closeness as relevant.
                    similar_found = []
                    for it in items:
                        score = it.get('score')
                        # If VectorDistance is a distance metric (smaller is closer), invert to similarity
                        if score is None:
                            # fallback: compute local cosine if embedding exists
                            emb = it.get('embedding')
                            if emb:
                                from embeddings import cosine_similarity
                                s = cosine_similarity(query_embedding, emb)
                                if s >= threshold:
                                    similar_found.append({"id": it.get('id'), "text": it.get('content'), "similarity_score": s})
                            continue

                        # Heuristic: if score is in [0,1] assume similarity; if >1 or very small assume distance
                        try:
                            s = float(score)
                        except Exception:
                            continue

                        # If the metric looks like a distance (small numbers close to 0), convert
                        if s <= 1.0 and s >= -1.0:
                            # treat as similarity-like (higher is better)
                            if s >= threshold:
                                similar_found.append({"id": it.get('id'), "text": it.get('content'), "similarity_score": s})
                        else:
                            # treat as distance (smaller is better) -> convert to similarity heuristic
                            # this maps distance in [0, +inf) to similarity in (1, -inf) loosely; we only use threshold check
                            # smaller distances are more similar; accept if distance <= (1 - threshold) heuristic
                            distance = s
                            if distance <= (1.0 - threshold):
                                # approximate a similarity score for reporting
                                approx_sim = max(0.0, 1.0 - distance)
                                similar_found.append({"id": it.get('id'), "text": it.get('content'), "similarity_score": approx_sim})

                    if similar_found:
                        similar_found.sort(key=lambda x: x["similarity_score"], reverse=True)
                        print(f"Found {len(similar_found)} similar questions (vector search)")
                        return {"status": "similar_duplicate", "similar_questions": similar_found, "similarity_threshold": threshold}

            except Exception:
                # Fall back to local cosine path below
                pass

            # Local fallback: compute cosine similarity over fetched candidates
                # Local fallback: use the embeddings helper's batch similarity function.
                # This helper uses NumPy when available (fast path) and falls back to
                # a pure-Python implementation otherwise.
                try:
                    from embeddings import cosine_similarities_batch
                except Exception:
                    cosine_similarities_batch = None

                threshold = float(os.getenv('SIMILARITY_THRESHOLD', '0.75'))
                similar_found = []

                # Collect candidates that have embeddings
                emb_candidates = []
                emb_candidate_map = []  # map index -> candidate
                for cand in candidates:
                    emb = cand.get('embedding')
                    if emb and isinstance(emb, (list, tuple)) and len(emb) > 0:
                        emb_candidates.append(emb)
                        emb_candidate_map.append(cand)

                if emb_candidates and cosine_similarities_batch is not None:
                    try:
                        scores = cosine_similarities_batch(emb_candidates, query_embedding)
                        for cand, score in zip(emb_candidate_map, scores):
                            try:
                                s = float(score)
                            except Exception:
                                continue
                            if s >= threshold:
                                similar_found.append({"id": cand.get('id'), "text": cand.get('text'), "similarity_score": s})
                    except Exception:
                        # If batch computation fails, fall back to per-item computation below
                        pass

                # If NumPy helper wasn't available or produced no results, fall back to per-item safe computation
                if not similar_found and emb_candidates:
                    # safe per-item fallback (pure-Python)
                    import math
                    for cand in emb_candidate_map:
                        emb = cand.get('embedding')
                        try:
                            dot = sum(x * y for x, y in zip(query_embedding, emb))
                            na = math.sqrt(sum(x * x for x in query_embedding))
                            nb = math.sqrt(sum(x * x for x in emb))
                            if na == 0.0 or nb == 0.0:
                                continue
                            s = dot / (na * nb)
                        except Exception:
                            continue
                        if s >= threshold:
                            similar_found.append({"id": cand.get('id'), "text": cand.get('text'), "similarity_score": s})

                if similar_found:
                    similar_found.sort(key=lambda x: x['similarity_score'], reverse=True)
                    print(f"Found {len(similar_found)} similar questions (embeddings - local)")
                    return {"status": "similar_duplicate", "similar_questions": similar_found, "similarity_threshold": threshold}

        # 3) Fallback: token overlap heuristic
        import re

        def tokenize_local(text: str):
            toks = re.findall(r"[a-zA-Z0-9]+", (text or "").lower())
            stop = {"the", "is", "in", "at", "of", "a", "an", "how", "what", "why", "to", "for"}
            return set([t for t in toks if t and t not in stop])

        q_tokens = tokenize_local(question_text)
        token_candidates = [c for c in candidates if c.get("text")]

        if not token_candidates and generated_questions_container is not None and hasattr(generated_questions_container, "query_items"):
            try:
                items = list(generated_questions_container.query_items(query="SELECT TOP 200 c.id, c.text FROM c", enable_cross_partition_query=True))
                for it in items:
                    token_candidates.append({"id": it.get("id"), "text": it.get("text")})
            except Exception:
                pass

        def jaccard_local(a: set, b: set) -> float:
            if not a or not b:
                return 0.0
            inter = len(a & b)
            uni = len(a | b)
            return inter / uni if uni > 0 else 0.0

        threshold_tokens = float(os.getenv('TOKEN_SIMILARITY_THRESHOLD', '0.60'))
        similar_token_matches = []
        for cand in token_candidates:
            cand_tokens = tokenize_local(cand.get("text") or "")
            score = jaccard_local(q_tokens, cand_tokens)
            if score >= threshold_tokens:
                similar_token_matches.append({"id": cand.get("id"), "text": cand.get("text"), "similarity_score": score})

        if similar_token_matches:
            similar_token_matches.sort(key=lambda x: x["similarity_score"], reverse=True)
            print(f"Found {len(similar_token_matches)} similar questions (tokens)")
            return {"status": "similar_duplicate", "similar_questions": similar_token_matches, "similarity_threshold": threshold_tokens}

        # No duplicates found
        print("No similar questions found")
        return {"status": "unique", "question_hash": question_hash}

    except Exception as e:
        # Log the detailed error for server-side debugging
        try:
            from logging_config import get_logger
            logger = get_logger("tools.validate_question")
            logger.error(f"Error in validation: {e}", exc_info=True)
        except Exception:
            print(f"Error in validation: {e}")
        # Do not expose internal error details to the client
        return {"status": "validation_error", "error": "A validation error occurred during question processing."}
