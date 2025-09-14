"""Insert one KnowledgeBase item with an embedding and run a VectorDistance query.

Requirements:
 - RAG_COSMOS_DB_ENDPOINT + RAG_COSMOS_DB_KEY set (or RAG account reachable via DefaultAzureCredential if env keys not used)
 - AZURE_OPENAI_API_KEY (or set LLM_AGENT_URL to a running agent that returns an embedding)

This script attempts to use the repo's `backend.rag_database` and embedding helpers; if absent, it calls Azure OpenAI directly via `openai`.

Usage:
  python scripts/cosmos_vector_test.py

"""
import os
import sys
import asyncio
import json
import uuid

from azure.cosmos import CosmosClient, PartitionKey

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

# Try to import app helpers
try:
    from backend.rag_database import get_rag_service
    from backend.constants import CONTAINER
    HAVE_APP_RAG = True
except Exception:
    HAVE_APP_RAG = False


async def embed_text(text: str):
    # Prefer llm-agent if configured
    agent = os.getenv('LLM_AGENT_URL')
    if agent:
        url = agent.rstrip('/') + '/embed'
        try:
            import requests
            r = requests.post(url, json={'text': text}, timeout=15)
            r.raise_for_status()
            return r.json().get('embedding')
        except Exception as e:
            print(f"llm-agent embedding failed: {e}")
    # Fallback to Azure OpenAI via openai package
    try:
        import openai
        openai.api_type = 'azure'
        openai.api_base = os.getenv('AZURE_OPENAI_ENDPOINT')
        openai.api_key = os.getenv('AZURE_OPENAI_API_KEY')
        model = os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small')
        resp = openai.Embeddings.create(model=model, input=text)
        return resp['data'][0]['embedding']
    except Exception as e:
        print(f"OpenAI embedding failed: {e}")
        return None


async def run_test():
    rag_ep = os.getenv('RAG_COSMOS_DB_ENDPOINT')
    rag_key = os.getenv('RAG_COSMOS_DB_KEY')
    rag_db = os.getenv('RAG_COSMOS_DB_DATABASE', 'ragdb')

    if not rag_ep or not rag_key:
        print('RAG endpoint/key not set. Set RAG_COSMOS_DB_ENDPOINT and RAG_COSMOS_DB_KEY for this test (or run rag service locally).')
        return

    client = CosmosClient(url=rag_ep, credential=rag_key)
    db = client.get_database_client(rag_db)

    kb_name = os.getenv('KNOWLEDGE_BASE_CONTAINER', 'KnowledgeBase')

    try:
        container = db.get_container_client(kb_name)
        # Create a sample doc with an embedding
        text = 'Sample question: What is the time complexity of quicksort?'
        emb = await embed_text(text)
        if not emb:
            print('Embedding failed; aborting')
            return
        item = {
            'id': str(uuid.uuid4()),
            'skill': 'algorithms',
            'title': 'Quicksort complexity',
            'content': text,
            'embedding': emb
        }
        print('Upserting sample knowledge item...')
        container.upsert_item(item)
        print('Inserted item id=', item['id'])

        # Query using VectorDistance - requires parameterized query
        print('Running VectorDistance search...')
        query = 'SELECT TOP 5 c.id, c.title, VectorDistance(c.embedding, @q) AS score FROM c WHERE c.skill = @skill ORDER BY VectorDistance(c.embedding, @q)'
        params = [
            {'name': '@q', 'value': emb},
            {'name': '@skill', 'value': 'algorithms'}
        ]
        for r in container.query_items(query=query, parameters=params, enable_cross_partition_query=True):
            print('Result:', r)
    except Exception as e:
        print('Error during RAG test:', e)


if __name__ == '__main__':
    asyncio.run(run_test())
