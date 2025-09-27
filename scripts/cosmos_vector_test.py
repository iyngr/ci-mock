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
import uuid
from urllib.parse import urlparse
import socket
import ipaddress

try:
    import requests
except Exception:
    requests = None

try:
    import openai
except Exception:
    openai = None

from azure.cosmos import CosmosClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

# Try to import app helpers
try:
    HAVE_APP_RAG = True
except Exception:
    HAVE_APP_RAG = False


async def embed_text(text: str):
    # Prefer llm-agent if configured, but only if in allowed list
    agent = os.getenv('LLM_AGENT_URL')
    # Whitelist of allowed agent endpoints for SSRF protection.
    # You may adjust these to match your deployment!
    ALLOWED_AGENT_HOSTNAMES = [
        # e.g. allow only these endpoints:
        # 'llm-agent.yourcompany.com',
        # 'trusted-agent.example.com',
    ]
    # Alternatively: allow only HTTPS on specific domains
    if agent:
        parsed = urlparse(agent)
        # Only allow agent endpoints explicitly whitelisted
        if not parsed.hostname or parsed.hostname not in ALLOWED_AGENT_HOSTNAMES:
            print(f"Refusing to call agent at unapproved endpoint: {parsed.hostname!r}")
        elif parsed.scheme not in ("http", "https"):
            print(f"Refusing to use agent with unsupported scheme: {parsed.scheme}")
        else:
            url = agent.rstrip('/') + '/embed'
            try:
                hostname = parsed.hostname
                try:
                    infos = socket.getaddrinfo(hostname, None)
                    ips = {info[4][0] for info in infos}
                except Exception:
                    ips = set()

                blocked = False
                for ip in ips:
                    try:
                        addr = ipaddress.ip_address(ip)
                        if addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_link_local:
                            blocked = True
                            break
                    except Exception:
                        blocked = True
                        break

                allow_local = os.getenv('ALLOW_LOCAL_AGENT', 'false').lower() in ('1', 'true', 'yes')
                if blocked and not allow_local:
                    print(f"Refusing to call agent at {hostname} ({', '.join(ips)}) - private/reserved address")
                else:
                    if requests is None:
                        print("requests package not available; cannot call LLM agent")
                    else:
                        # disable redirects to avoid following attacker-controlled redirects
                        r = requests.post(url, json={'text': text}, timeout=15, allow_redirects=False)
                        r.raise_for_status()
                        return r.json().get('embedding')
            except Exception as e:
                print(f"llm-agent embedding failed: {e}")
    # Fallback to Azure OpenAI via openai package
    try:
        if openai is None:
            raise RuntimeError('openai package not available')
        openai.api_type = 'azure'
        openai.api_base = os.getenv('AZURE_OPENAI_ENDPOINT')
        openai.api_key = os.getenv('AZURE_OPENAI_API_KEY')
        # Warn if legacy AZURE_OPENAI_MODEL is present (do not use it at runtime)
        if os.getenv('AZURE_OPENAI_MODEL'):
            print("Warning: AZURE_OPENAI_MODEL is set but ignored. Use AZURE_OPENAI_DEPLOYMENT_NAME or AZURE_OPENAI_EMBED_DEPLOYMENT for embeddings.")

        model = os.getenv('AZURE_OPENAI_EMBED_DEPLOYMENT', os.getenv('EMBEDDING_MODEL', 'text-embedding-3-small'))
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
