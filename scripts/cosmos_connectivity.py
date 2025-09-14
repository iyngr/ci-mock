"""Connectivity check for primary and RAG Cosmos DB accounts.

Usage:
  python scripts/cosmos_connectivity.py

It will attempt to:
 - Connect to primary Cosmos DB using COSMOS_DB_ENDPOINT + COSMOS_DB_KEY
 - List containers in the primary DB
 - If RAG_COSMOS_DB_ENDPOINT present, connect and list containers in the RAG DB

This reuses `database.CosmosDBService` if available, otherwise does a minimal CosmosClient probe.
"""
import os
import sys
import asyncio

from azure.cosmos import CosmosClient

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

try:
    # prefer internal helper if present
    from backend.database import CosmosDBService
    from backend.constants import CONTAINER
    HAVE_INTERNAL = True
except Exception:
    HAVE_INTERNAL = False


def probe_account(endpoint, key, database_name):
    print(f"Probing {endpoint} (db={database_name})")
    client = CosmosClient(url=endpoint, credential=key)
    db = client.get_database_client(database_name)
    containers = list(db.list_containers())
    print(f"Found {len(containers)} containers:")
    for c in containers:
        print(f" - {c.get('id')}")


async def main():
    primary_ep = os.getenv('COSMOS_DB_ENDPOINT')
    primary_key = os.getenv('COSMOS_DB_KEY')
    primary_db = os.getenv('COSMOS_DB_DATABASE', 'assessment')

    if not primary_ep or not primary_key:
        print("Primary Cosmos DB endpoint or key not set. Edit .env or set env vars.")
    else:
        if HAVE_INTERNAL:
            print("Using internal CosmosDBService from backend.database to list containers (primary)")
            # minimal use of internals: create a service directly via CosmosClient
            from azure.cosmos import CosmosClient as _CosmosClient
            client = _CosmosClient(url=primary_ep, credential=primary_key)
            db_client = client.get_database_client(primary_db)
            service = CosmosDBService(db_client)
            print("Containers (primary):")
            for name in service.list_containers():
                print(f" - {name}")
        else:
            probe_account(primary_ep, primary_key, primary_db)

    # RAG account (optional)
    rag_ep = os.getenv('RAG_COSMOS_DB_ENDPOINT')
    rag_key = os.getenv('RAG_COSMOS_DB_KEY')
    rag_db = os.getenv('RAG_COSMOS_DB_DATABASE', 'ragdb')
    if rag_ep and rag_key:
        print('\nRAG account present:')
        probe_account(rag_ep, rag_key, rag_db)
    else:
        print('\nRAG account env not fully set (RAG_COSMOS_DB_ENDPOINT/RAG_COSMOS_DB_KEY). Skipping RAG probe.')


if __name__ == '__main__':
    asyncio.run(main())
