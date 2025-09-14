"""RAG-specific Cosmos DB connection (serverless vector-enabled account).

This module intentionally isolates the vector-enabled KnowledgeBase (and optional
RAGQueries) container from the primary transactional database to:
- Avoid coupling provisioning/throughput characteristics
- Allow independent lifecycle and scaling
- Keep vector experimentation low-risk & cost-efficient (serverless)

Environment Variables:
  RAG_COSMOS_DB_ENDPOINT   (required)  - Endpoint URL of the RAG Cosmos DB account
  RAG_COSMOS_DB_DATABASE   (optional)  - Database name (default: ragdb)
  RAG_COSMOS_DB_PREFERRED_LOCATIONS (optional CSV)

Usage:
  from rag_database import get_rag_service
  service = await get_rag_service()
  await service.upsert_item(CONTAINER["KNOWLEDGE_BASE"], {...})

This reuses the CosmosDBService from database.py but limits container provisioning
only to KnowledgeBase (and RAGQueries if desired) under the assumption that the
serverless account is dedicated to RAG.
"""
from __future__ import annotations
import os
import logging
from typing import Optional
from azure.cosmos import CosmosClient, PartitionKey
from azure.cosmos.cosmos_client import ConnectionPolicy
from azure.cosmos.exceptions import CosmosResourceNotFoundError, CosmosHttpResponseError
from azure.identity import DefaultAzureCredential

from constants import CONTAINER
from database import CosmosDBService  # reuse service class

logger = logging.getLogger(__name__)

_rag_cosmos_client: Optional[CosmosClient] = None
_rag_database_client = None
_rag_service: Optional[CosmosDBService] = None


def _create_client(endpoint: str) -> CosmosClient:
    policy = ConnectionPolicy()
    policy.connection_mode = "Gateway"  # safe default; Direct may be enabled later
    policy.request_timeout = 30
    preferred = os.getenv("RAG_COSMOS_DB_PREFERRED_LOCATIONS", "").split(",")
    if preferred and preferred[0]:
        policy.preferred_locations = [p.strip() for p in preferred]
    policy.retry_options.max_retry_attempt_count = 3
    policy.retry_options.fixed_retry_interval_in_milliseconds = 1000
    policy.retry_options.max_wait_time_in_seconds = 10
    credential = DefaultAzureCredential()
    return CosmosClient(url=endpoint, credential=credential, connection_policy=policy)


async def _ensure_rag_containers(service: CosmosDBService):
    """Provision only RAG-related containers if absent.

    We expect the KnowledgeBase container already created manually with vector index.
    Here we simply verify existence and optionally create RAGQueries (non-vector) if missing.
    """
    # Verify KnowledgeBase exists; do not attempt to (re)create with vector policy here.
    kb_name = CONTAINER["KNOWLEDGE_BASE"]
    try:
        service.get_container(kb_name).read()
        logger.info("RAG: KnowledgeBase container present")
    except CosmosResourceNotFoundError:
        logger.warning("KnowledgeBase container not found in RAG account. It must be created manually with vector settings.")
    except CosmosHttpResponseError as e:
        logger.error(f"Error reading KnowledgeBase container: {e}")

    # Optionally ensure RAGQueries (if you want logging in same account)
    rq_name = CONTAINER["RAG_QUERIES"]
    try:
        service.get_container(rq_name).read()
    except CosmosResourceNotFoundError:
        try:
            service.database_client.create_container(
                id=rq_name,
                partition_key=PartitionKey(path="/assessment_id"),
                default_ttl=60*60*24*30  # 30 days
            )
            logger.info("Created RAGQueries container in RAG account")
        except CosmosHttpResponseError as e:
            logger.error(f"Failed to create RAGQueries container in RAG account: {e}")


async def get_rag_service() -> Optional[CosmosDBService]:
    """Get or initialize the RAG CosmosDBService.

    Returns None if RAG_COSMOS_DB_ENDPOINT is not set (feature disabled).
    """
    global _rag_cosmos_client, _rag_database_client, _rag_service
    if _rag_service:
        return _rag_service

    endpoint = os.getenv("RAG_COSMOS_DB_ENDPOINT")
    if not endpoint:
        logger.info("RAG service disabled: RAG_COSMOS_DB_ENDPOINT not set")
        return None

    db_name = os.getenv("RAG_COSMOS_DB_DATABASE", "ragdb")
    try:
        _rag_cosmos_client = _create_client(endpoint)
        _rag_database_client = _rag_cosmos_client.get_database_client(db_name)
        _rag_service = CosmosDBService(_rag_database_client)
        await _ensure_rag_containers(_rag_service)
        logger.info(f"Initialized RAG Cosmos service (db={db_name})")
        return _rag_service
    except Exception as e:
        logger.error(f"Failed to initialize RAG Cosmos service: {e}")
        return None
