r"""
Cosmos DB RU / Query Metrics test script

Usage (PowerShell):
$env:COSMOS_DB_ENDPOINT = "https://your-account.documents.azure.com:443/"
$env:COSMOS_DB_KEY = "<your-primary-key>"
python .\scripts\cosmos_query_ru_test.py --database mydb --container mycontainer --query "SELECT * FROM c WHERE c.category = 'Books'"

This script tries to read SDK response headers after executing the query and prints
- Request Charge (RUs)
- x-ms-documentdb-query-metrics (if available)

Notes:
- Requires `azure-cosmos` Python package. Install with `pip install azure-cosmos`.
- The header access method uses a few fallbacks because different azure-cosmos SDK versions expose
  the last response headers differently.
"""
from __future__ import annotations
import os
import argparse
import json
import sys
from pathlib import Path

try:
    from azure.cosmos import CosmosClient
except Exception as e:
    print("Missing dependency: azure-cosmos. Install with: pip install azure-cosmos")
    raise


# Load environment variables from backend/.env if present (use python-dotenv when available)
def _load_backend_dotenv():
    repo_root = Path(__file__).resolve().parents[1]
    backend_env = repo_root / 'backend' / '.env'
    if not backend_env.exists():
        return False
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=str(backend_env), override=False)
        print(f"Loaded environment from {backend_env}")
        return True
    except Exception:
        # Fallback: simple parser
        try:
            with open(backend_env, 'r', encoding='utf-8') as fh:
                for line in fh:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue
                    if '=' not in line:
                        continue
                    k, v = line.split('=', 1)
                    k = k.strip()
                    v = v.strip().strip('"').strip("'")
                    if k and os.getenv(k) is None:
                        os.environ[k] = v
            print(f"Loaded environment from {backend_env} (fallback parser)")
            return True
        except Exception:
            return False


# Try to load backend .env early
_load_backend_dotenv()


def get_last_response_headers(container, client):
    """Try a few fallbacks to obtain the last response headers from the SDK runtime."""
    # v3/v4 SDKs sometimes expose a client_connection with last_response_headers on container
    try:
        if hasattr(container, 'client_connection') and getattr(container.client_connection, 'last_response_headers', None):
            return container.client_connection.last_response_headers
    except Exception:
        pass

    # Try client (global) last_response_headers
    try:
        if hasattr(client, 'client_connection') and getattr(client.client_connection, 'last_response_headers', None):
            return client.client_connection.last_response_headers
    except Exception:
        pass

    # Newer SDKs may attach headers to the iterator items in a different way; we don't assume that here.
    return {}


def main():
    parser = argparse.ArgumentParser(description="Run a Cosmos DB query and print RU charge and query metrics.")
    parser.add_argument('--endpoint', default=os.getenv('COSMOS_DB_ENDPOINT'), help='Transactional Cosmos DB endpoint URL (falls back to COSMOS_DB_ENDPOINT env)')
    parser.add_argument('--key', default=os.getenv('COSMOS_DB_KEY'), help='Transactional Cosmos DB primary key (falls back to COSMOS_DB_KEY env)')
    # Database/container defaults will be resolved from multiple env vars below
    parser.add_argument('--database', required=False, default=None, help='Transactional database name (falls back to COSMOS_DB_DATABASE or DATABASE_NAME or "assessment")')
    parser.add_argument('--container', required=False, default=None, help='Transactional container name (falls back to COSMOS_DB_CONTAINER or "questions")')
    parser.add_argument('--query', default=os.getenv('COSMOS_DB_QUERY', "SELECT * FROM c"), help='SQL query to run against transactional DB')

    # RAG account options (optional)
    parser.add_argument('--rag-endpoint', default=os.getenv('RAG_COSMOS_DB_ENDPOINT'), help='RAG Cosmos DB endpoint URL (optional)')
    parser.add_argument('--rag-key', default=os.getenv('RAG_COSMOS_DB_KEY'), help='RAG Cosmos DB primary key (optional)')
    parser.add_argument('--rag-database', default=os.getenv('RAG_COSMOS_DB_DATABASE', 'ragdb'), help='RAG database name (default: ragdb)')
    parser.add_argument('--rag-container', default=os.getenv('RAG_COSMOS_DB_CONTAINER', 'KnowledgeBase'), help='RAG container name (default: KnowledgeBase)')
    parser.add_argument('--rag-query', default=os.getenv('RAG_COSMOS_DB_QUERY', "SELECT TOP 50 * FROM c"), help='SQL query to run against RAG DB (optional)')
    parser.add_argument('--max-items', type=int, default=1000, help='Max items to fetch (iteration stop)')

    args = parser.parse_args()

    if not args.endpoint or not args.key:
        print("Transactional COSMOS_DB_ENDPOINT and COSMOS_DB_KEY must be set in environment or passed as args.")
        sys.exit(2)

    # Resolve database/container with sensible fallbacks (respect backend/.env keys)
    resolved_db = args.database or os.getenv('COSMOS_DB_DATABASE') or os.getenv('COSMOS_DB_DATABASE_NAME') or os.getenv('DATABASE_NAME') or os.getenv('COSMOS_DB_NAME') or 'assessment'
    resolved_container = args.container or os.getenv('COSMOS_DB_CONTAINER') or os.getenv('COSMOS_DB_COLLECTION') or 'questions'

    print(f"Using transactional endpoint: {args.endpoint}")
    print(f"Using transactional database: {resolved_db}, container: {resolved_container}")

    client = CosmosClient(args.endpoint, args.key)
    db = client.get_database_client(resolved_db)
    container = db.get_container_client(resolved_container)

    print(f"Running query against {resolved_db}/{resolved_container}: {args.query}")

    try:
        items_iterable = container.query_items(
            query=args.query,
            enable_cross_partition_query=True,
            populate_query_metrics=True
        )

        results = []
        count = 0
        for item in items_iterable:
            results.append(item)
            count += 1
            if args.max_items and count >= args.max_items:
                break

        # Attempt to read headers
        headers = get_last_response_headers(container, client) or {}

        ru = headers.get('x-ms-request-charge') or headers.get('X-MS-REQUEST-CHARGE')
        qmetrics = headers.get('x-ms-documentdb-query-metrics') or headers.get('X-MS-DOCUMENTDB-QUERY-METRICS')

        print('\n===== Results =====')
        print(f"Items returned: {len(results)}")

        if ru:
            print(f"Request Charge (RUs): {ru}")
        else:
            print("Request Charge (RUs): <not available via headers fallback>")

        if qmetrics:
            print(f"Query Metrics: {qmetrics}")
        else:
            print("Query Metrics: <not available via headers fallback>")

        # Pretty print first few results
        print('\nSample Results:')
        for i, r in enumerate(results[:10]):
            try:
                print(json.dumps(r, indent=2, default=str))
            except Exception:
                print(r)

    except Exception as e:
        # Try to give a clearer message for missing DB/container
        from azure.cosmos.exceptions import CosmosResourceNotFoundError
        if isinstance(e, CosmosResourceNotFoundError):
            print("Query execution failed: Database or container not found. Please verify the database/container names and COSMOS keys in backend/.env or pass --database/--container explicitly.")
            print(f"Full SDK error: {e}")
            sys.exit(3)
        else:
            print(f"Query execution failed: {e}")
            raise

        # If RAG args provided, run an analogous query against the RAG account
        if args.rag_endpoint and args.rag_key:
            try:
                print('\n--- Running RAG DB query ---')
                rag_client = CosmosClient(args.rag_endpoint, args.rag_key)
                rag_db = rag_client.get_database_client(args.rag_database)
                rag_container = rag_db.get_container_client(args.rag_container)

                print(f"Running RAG query against {args.rag_database}/{args.rag_container}: {args.rag_query}")
                rag_iter = rag_container.query_items(
                    query=args.rag_query,
                    enable_cross_partition_query=True,
                    populate_query_metrics=True
                )

                rag_results = [r for r in rag_iter]
                rag_headers = get_last_response_headers(rag_container, rag_client) or {}
                rag_ru = rag_headers.get('x-ms-request-charge') or rag_headers.get('X-MS-REQUEST-CHARGE')
                rag_qmetrics = rag_headers.get('x-ms-documentdb-query-metrics') or rag_headers.get('X-MS-DOCUMENTDB-QUERY-METRICS')

                print('\n===== RAG Results =====')
                print(f"Items returned: {len(rag_results)}")
                print(f"Request Charge (RUs): {rag_ru if rag_ru else '<not available>'}")
                print(f"Query Metrics: {rag_qmetrics if rag_qmetrics else '<not available>'}")
                print('\nSample RAG Results:')
                for i, r in enumerate(rag_results[:10]):
                    try:
                        print(json.dumps(r, indent=2, default=str))
                    except Exception:
                        print(r)

            except Exception as e:
                print(f"RAG query execution failed: {e}")
                # continue gracefully


if __name__ == '__main__':
    main()
