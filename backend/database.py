"""
Azure Cosmos DB database service layer

This module provides abstraction for Azure Cosmos DB operations,
compatible with the existing API patterns from Motor/MongoDB.
Includes performance optimizations and RU monitoring.
"""

import asyncio
import time
from typing import Any, Dict, List, Optional, Union
from azure.cosmos import ContainerProxy, DatabaseProxy, PartitionKey
from azure.cosmos.exceptions import (
    CosmosResourceNotFoundError, 
    CosmosHttpResponseError,
    CosmosResourceExistsError,
    CosmosAccessConditionFailedError
)
import logging
from constants import CONTAINER, COLLECTIONS, EMBEDDING_DIM  # updated import

logger = logging.getLogger(__name__)


class CosmosDBMetrics:
    """Class to track Cosmos DB metrics and performance"""
    
    def __init__(self):
        self.total_request_charge = 0.0
        self.operation_count = 0
        self.operation_times = []
        
    def record_operation(self, request_charge: float, duration_ms: float, operation_type: str):
        """Record an operation's metrics"""
        self.total_request_charge += request_charge
        self.operation_count += 1
        self.operation_times.append(duration_ms)
        
        logger.info(f"Cosmos DB {operation_type}: {request_charge} RU, {duration_ms:.2f}ms")
    
    def get_average_ru_per_operation(self) -> float:
        """Get average RU consumption per operation"""
        return self.total_request_charge / self.operation_count if self.operation_count > 0 else 0.0
    
    def get_average_duration(self) -> float:
        """Get average operation duration in milliseconds"""
        return sum(self.operation_times) / len(self.operation_times) if self.operation_times else 0.0


# Global metrics instance for monitoring
cosmos_metrics = CosmosDBMetrics()


class CosmosRetryConfig:
    """Configuration for Cosmos DB retry logic"""
    MAX_RETRIES = 3
    INITIAL_DELAY = 1.0  # seconds
    MAX_DELAY = 10.0     # seconds
    BACKOFF_MULTIPLIER = 2.0
    
    # HTTP status codes that should trigger a retry
    RETRYABLE_STATUS_CODES = {429, 503, 408, 500, 502, 504}


async def cosmos_retry_wrapper(operation, *args, operation_type: str = "unknown", **kwargs):
    """
    Wrapper for Cosmos DB operations with exponential backoff retry logic
    Handles transient errors, throttling scenarios, and performance monitoring
    """
    config = CosmosRetryConfig()
    last_exception = None
    start_time = time.time()
    
    for attempt in range(config.MAX_RETRIES + 1):
        try:
            result = await operation(*args, **kwargs) if asyncio.iscoroutinefunction(operation) else operation(*args, **kwargs)
            
            # Record performance metrics
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            # Extract request charge from response
            request_charge = 0.0
            if hasattr(result, 'headers') and 'x-ms-request-charge' in result.headers:
                request_charge = float(result.headers['x-ms-request-charge'])
            elif hasattr(result, 'request_charge'):
                request_charge = float(result.request_charge)
            
            # Record metrics
            cosmos_metrics.record_operation(request_charge, duration_ms, operation_type)
            
            # Warn if operation is expensive
            if request_charge > 50.0:
                logger.warning(f"High RU operation: {operation_type} consumed {request_charge} RU")
            
            return result
            
        except CosmosHttpResponseError as e:
            last_exception = e
            status_code = e.status_code
            
            # Check if this is a retryable error
            if status_code not in config.RETRYABLE_STATUS_CODES or attempt == config.MAX_RETRIES:
                # Log the final failure
                logger.error(f"Cosmos DB operation failed after {attempt + 1} attempts: {e}")
                raise
            
            # Calculate delay with exponential backoff
            delay = min(
                config.INITIAL_DELAY * (config.BACKOFF_MULTIPLIER ** attempt),
                config.MAX_DELAY
            )
            
            # For throttling (429), respect the retry-after header if present
            if status_code == 429:
                retry_after = e.headers.get('x-ms-retry-after-ms')
                if retry_after:
                    delay = max(delay, float(retry_after) / 1000.0)
            
            logger.warning(f"Cosmos DB operation failed (attempt {attempt + 1}/{config.MAX_RETRIES + 1}): {e}. Retrying in {delay}s")
            await asyncio.sleep(delay)
            
        except Exception as e:
            # Non-retryable exceptions
            logger.error(f"Non-retryable Cosmos DB error: {e}")
            raise
    
    # This should never be reached, but just in case
    raise last_exception


class CosmosDBService:
    """Service layer for Azure Cosmos DB operations"""
    
    def __init__(self, database_client: DatabaseProxy):
        self.database_client = database_client
        self._containers = {}
    
    def get_container(self, container_name: str) -> ContainerProxy:
        """Get or create container client"""
        if container_name not in self._containers:
            self._containers[container_name] = self.database_client.get_container_client(container_name)
        return self._containers[container_name]
    
    async def ensure_containers_exist(self):
        """Ensure required containers exist with proper partition keys, TTL, and indexing."""
        containers_config = {
            CONTAINER["ASSESSMENTS"]: {"pk": "/id"},
            CONTAINER["SUBMISSIONS"]: {"pk": "/assessment_id", "index_policy": {
                "indexingMode": "consistent",
                "automatic": True,
                "includedPaths": [{"path": "/*"}],
                "excludedPaths": [
                    {"path": "/answers/*"},
                    {"path": "/proctoring_events/*"},
                    {"path": "/detailed_evaluation/*"}
                ]
            }},
            CONTAINER["USERS"]: {"pk": "/id"},
            CONTAINER["QUESTIONS"]: {"pk": "/skill"},
            CONTAINER["GENERATED_QUESTIONS"]: {"pk": "/skill"},
            # KnowledgeBase: include vector policy + vector index definitions.
            # NOTE: Per current Cosmos DB limitations, vector feature must be enabled at account level first.
            CONTAINER["KNOWLEDGE_BASE"]: {"pk": "/skill", "index_policy": {
                "indexingMode": "consistent",
                "automatic": True,
                "includedPaths": [
                    {"path": "/*"}
                ],
                # Exclude the raw embedding array from the traditional property index to optimize ingestion RUs
                "excludedPaths": [
                    {"path": "/_etag/?"},
                    {"path": "/embedding/*"}
                ],
                # Vector index definitions (one path). Keep minimal; dimension & similarity defined in vector policy separately in future SDKs.
                # Current docs show vector policy (vectorEmbeddings) specified at container creation; azure-cosmos Python may evolve.
                # Here we supply vectorIndexes consistent with GA examples for indexing policy.
                "vectorIndexes": [
                    {"path": "/embedding", "type": "quantizedFlat"}
                ]
            }},
            CONTAINER["CODE_EXECUTIONS"]: {"pk": "/submission_id", "ttl": 60*60*24*30},  # 30d
            CONTAINER["EVALUATIONS"]: {"pk": "/submission_id"},
            CONTAINER["RAG_QUERIES"]: {"pk": "/assessment_id", "ttl": 60*60*24*30},  # 30d
            # New S2S containers
            CONTAINER["INTERVIEWS"]: {"pk": "/assessment_id"},
            # 6 months TTL (~ 15552000 seconds) with indexes for auto-submit queries
            CONTAINER["INTERVIEW_TRANSCRIPTS"]: {
                "pk": "/assessment_id", 
                "ttl": 60*60*24*30*6,
                "index_policy": {
                    "indexingMode": "consistent",
                    "automatic": True,
                    "includedPaths": [
                        {"path": "/finalized_at/?"},
                        {"path": "/scored_at/?"},
                        {"path": "/session_id/?"},
                        {"path": "/assessment_id/?"},
                        {"path": "/*"}  # Include all paths for flexible querying
                    ],
                    "excludedPaths": [
                        {"path": "/turns/*/text/?"},  # Exclude large text fields from indexing
                        {"path": "/assessment_feedback/?"}  # Exclude large feedback text
                    ]
                }
            },
        }
        for container_name, cfg in containers_config.items():
            try:
                container = self.database_client.get_container_client(container_name)
                container.read()
                logger.info(f"Container '{container_name}' already exists")
                # Apply TTL or indexing updates only if needed (skip heavy diff logic for now)
            except CosmosResourceNotFoundError:
                create_kwargs = {
                    "id": container_name,
                    "partition_key": PartitionKey(path=cfg["pk"]),
                }
                if "ttl" in cfg:
                    create_kwargs["default_ttl"] = cfg["ttl"]
                if "index_policy" in cfg:
                    create_kwargs["indexing_policy"] = cfg["index_policy"]
                try:
                    self.database_client.create_container(**create_kwargs)
                    logger.info(f"Created container '{container_name}' with pk '{cfg['pk']}'")
                except CosmosHttpResponseError as e:
                    logger.error(f"Failed to create container '{container_name}': {e}")
                    raise

    # Helper to infer partition key value based on container logical mapping
    def infer_partition_key(self, container_name: str, item: Dict[str, Any]) -> Optional[str]:
        """Infer partition key value from item using COLLECTIONS metadata.
        Returns None if not inferable (caller will fall back to id).
        """
        for meta in COLLECTIONS.values():
            if meta["name"] == container_name:
                field = meta.get("pk_field")
                if field and field in item:
                    return item[field]
        return None

    async def auto_create_item(self, container_name: str, item: Dict[str, Any]) -> Dict[str, Any]:
        pk_val = self.infer_partition_key(container_name, item) or item.get("id") or item.get("_id")
        return await self.create_item(container_name, item, partition_key=pk_val)
    
    # CRUD Operations - Compatible with existing API patterns
    
    async def create_item(self, container_name: str, item: Dict[str, Any], partition_key: Optional[str] = None) -> Dict[str, Any]:
        """Create a new item in the container"""
        container = self.get_container(container_name)
        
        # If no partition key provided, use the id field
        if partition_key is None:
            partition_key = item.get("id", item.get("_id"))
        
        async def _create_operation():
            return container.create_item(body=item)
        
        try:
            response = await cosmos_retry_wrapper(_create_operation)
            logger.info(f"Created item in '{container_name}': {response.get('id')}")
            return response
        except CosmosResourceExistsError:
            logger.warning(f"Item already exists in '{container_name}': {item.get('id')}")
            raise
        except CosmosHttpResponseError as e:
            logger.error(f"Failed to create item in '{container_name}': {e}")
            raise
    
    async def read_item(self, container_name: str, item_id: str, partition_key: str) -> Optional[Dict[str, Any]]:
        """Read a specific item by ID and partition key"""
        container = self.get_container(container_name)
        
        async def _read_operation():
            return container.read_item(item=item_id, partition_key=partition_key)
        
        try:
            response = await cosmos_retry_wrapper(_read_operation)
            return response
        except CosmosResourceNotFoundError:
            return None
        except CosmosHttpResponseError as e:
            logger.error(f"Failed to read item '{item_id}' from '{container_name}': {e}")
            raise
    
    async def upsert_item(self, container_name: str, item: Dict[str, Any], partition_key: Optional[str] = None) -> Dict[str, Any]:
        """Insert or update an item"""
        container = self.get_container(container_name)
        try:
            if partition_key is None:
                partition_key = item.get("id", item.get("_id"))
                
            response = container.upsert_item(body=item)
            logger.info(f"Upserted item in '{container_name}': {response.get('id')}")
            return response
        except CosmosHttpResponseError as e:
            logger.error(f"Failed to upsert item in '{container_name}': {e}")
            raise
    
    async def delete_item(self, container_name: str, item_id: str, partition_key: str) -> bool:
        """Delete an item by ID and partition key"""
        container = self.get_container(container_name)
        try:
            container.delete_item(item=item_id, partition_key=partition_key)
            logger.info(f"Deleted item '{item_id}' from '{container_name}'")
            return True
        except CosmosResourceNotFoundError:
            return False
        except CosmosHttpResponseError as e:
            logger.error(f"Failed to delete item '{item_id}' from '{container_name}': {e}")
            raise
    
    async def query_items(self, container_name: str, query: str, parameters: Optional[List[Dict[str, Any]]] = None, 
                         cross_partition: bool = True) -> List[Dict[str, Any]]:
        """Query items using SQL syntax"""
        container = self.get_container(container_name)
        try:
            query_results = container.query_items(
                query=query,
                parameters=parameters or [],
                enable_cross_partition_query=cross_partition
            )
            return list(query_results)
        except CosmosHttpResponseError as e:
            logger.error(f"Query failed in '{container_name}': {e}")
            raise
    
    async def find_one(self, container_name: str, filter_dict: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find one item matching the filter (MongoDB-style compatibility)"""
        # Convert MongoDB-style filter to SQL query
        conditions = []
        parameters = []
        
        for key, value in filter_dict.items():
            if key == "_id":
                key = "id"  # Map MongoDB _id to Cosmos DB id
            
            param_name = f"@{key}"
            conditions.append(f"c.{key} = {param_name}")
            parameters.append({"name": param_name, "value": value})
        
        if not conditions:
            return None
            
        query = f"SELECT * FROM c WHERE {' AND '.join(conditions)}"
        results = await self.query_items(container_name, query, parameters)
        
        return results[0] if results else None
    
    async def find_many(self, container_name: str, filter_dict: Dict[str, Any], limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Find multiple items matching the filter (MongoDB-style compatibility)"""
        # Convert MongoDB-style filter to SQL query
        conditions = []
        parameters = []
        
        for key, value in filter_dict.items():
            if key == "_id":
                key = "id"
                
            param_name = f"@{key}"
            conditions.append(f"c.{key} = {param_name}")
            parameters.append({"name": param_name, "value": value})
        
        query = "SELECT * FROM c"
        if conditions:
            query += f" WHERE {' AND '.join(conditions)}"
        if limit:
            query += f" OFFSET 0 LIMIT {limit}"
        
        return await self.query_items(container_name, query, parameters)
    
    async def update_item(self, container_name: str, item_id: str, update_data: Dict[str, Any], 
                         partition_key: str) -> Optional[Dict[str, Any]]:
        """Update an existing item"""
        # First read the existing item
        existing_item = await self.read_item(container_name, item_id, partition_key)
        if not existing_item:
            return None
        
        # Merge the updates
        existing_item.update(update_data)
        
        # Upsert the modified item
        return await self.upsert_item(container_name, existing_item, partition_key)
    
    async def count_items(self, container_name: str, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        """Count items in container with optional filter"""
        conditions = []
        parameters = []
        
        if filter_dict:
            for key, value in filter_dict.items():
                if key == "_id":
                    key = "id"
                    
                param_name = f"@{key}"
                conditions.append(f"c.{key} = {param_name}")
                parameters.append({"name": param_name, "value": value})
        
        query = "SELECT VALUE COUNT(1) FROM c"
        if conditions:
            query += f" WHERE {' AND '.join(conditions)}"
        
        results = await self.query_items(container_name, query, parameters)
        return results[0] if results else 0

    # Performance Optimization Methods
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return {
            "total_request_charge": cosmos_metrics.total_request_charge,
            "operation_count": cosmos_metrics.operation_count,
            "average_ru_per_operation": cosmos_metrics.get_average_ru_per_operation(),
            "average_duration_ms": cosmos_metrics.get_average_duration()
        }
    
    async def optimize_query(self, container_name: str, query: str, parameters: List[Dict[str, Any]] = None) -> str:
        """
        Analyze and suggest optimizations for a query
        Returns optimized query with performance tips
        """
        # Basic query optimization suggestions
        optimized_query = query
        suggestions = []
        
        # Check for SELECT *
        if "SELECT *" in query.upper():
            suggestions.append("Consider selecting only required fields instead of SELECT *")
        
        # Check for missing WHERE clause with partition key
        if "WHERE" not in query.upper():
            suggestions.append("Add WHERE clause with partition key for better performance")
        
        # Check for ORDER BY without OFFSET LIMIT
        if "ORDER BY" in query.upper() and "OFFSET" not in query.upper():
            suggestions.append("Consider adding OFFSET/LIMIT for pagination with ORDER BY")
        
        # Log optimization suggestions
        if suggestions:
            logger.info(f"Query optimization suggestions for container '{container_name}': {suggestions}")
        
        return optimized_query
    
    async def bulk_create_items(self, container_name: str, items: List[Dict[str, Any]], 
                               batch_size: int = 100) -> List[Dict[str, Any]]:
        """
        Bulk create items with batching for better performance
        """
        container = self.get_container(container_name)
        results = []
        
        # Process items in batches
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_results = []
            
            # Create items in parallel within batch
            async def create_single_item(item):
                return await self.create_item(container_name, item)
            
            # Use asyncio.gather for parallel execution
            try:
                batch_results = await asyncio.gather(
                    *[create_single_item(item) for item in batch],
                    return_exceptions=True
                )
                
                # Filter out exceptions and collect successful results
                for result in batch_results:
                    if not isinstance(result, Exception):
                        results.append(result)
                    else:
                        logger.error(f"Failed to create item in bulk operation: {result}")
                        
            except Exception as e:
                logger.error(f"Bulk create batch failed: {e}")
                
        logger.info(f"Bulk created {len(results)}/{len(items)} items in container '{container_name}'")
        return results
    
    async def get_container_statistics(self, container_name: str) -> Dict[str, Any]:
        """Get container statistics and performance information"""
        container = self.get_container(container_name)
        
        try:
            # Get container properties
            properties = container.read()
            
            # Get document count (approximate)
            count_query = "SELECT VALUE COUNT(1) FROM c"
            count_result = await self.query_items(container_name, count_query)
            document_count = count_result[0] if count_result else 0
            
            return {
                "container_name": container_name,
                "document_count": document_count,
                "partition_key": properties.get("partitionKey", {}).get("paths", []),
                "indexing_policy": properties.get("indexingPolicy", {}),
                "throughput_type": properties.get("offer", {}).get("offerType", "Unknown")
            }
            
        except Exception as e:
            logger.error(f"Failed to get statistics for container '{container_name}': {e}")
            return {"error": str(e)}


# Utility functions for compatibility

async def get_cosmosdb_service(database_client: DatabaseProxy) -> CosmosDBService:
    """Get initialized CosmosDB service with containers"""
    service = CosmosDBService(database_client)
    await service.ensure_containers_exist()
    return service
