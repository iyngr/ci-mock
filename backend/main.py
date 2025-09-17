from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from azure.cosmos import CosmosClient
from azure.cosmos.cosmos_client import ConnectionPolicy
from azure.identity import DefaultAzureCredential
import os
import logging
import time
from contextlib import asynccontextmanager
from routers import candidate, admin, utils, scoring, rag, interview, live_interview
from rag_database import get_rag_service  # new import for RAG vector account

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cosmos DB connection
cosmos_client = None
database_client = None


def create_optimized_cosmos_client(endpoint: str) -> CosmosClient:
    """Create Cosmos DB client with performance optimizations"""
    
    # Configure connection policy for optimal performance
    connection_policy = ConnectionPolicy()
    
    # Enable connection pooling and set connection limits
    connection_policy.connection_mode = "Gateway"  # or "Direct" for better performance in production
    connection_policy.request_timeout = 30  # 30 seconds timeout
    
    # Configure preferred locations for multi-region accounts
    preferred_locations = os.getenv("COSMOS_DB_PREFERRED_LOCATIONS", "").split(",")
    if preferred_locations and preferred_locations[0]:
        connection_policy.preferred_locations = [loc.strip() for loc in preferred_locations]
    
    # Retry options
    connection_policy.retry_options.max_retry_attempt_count = 3
    connection_policy.retry_options.fixed_retry_interval_in_milliseconds = 1000
    connection_policy.retry_options.max_wait_time_in_seconds = 10
    
    credential = DefaultAzureCredential()
    
    return CosmosClient(
        url=endpoint, 
        credential=credential,
        connection_policy=connection_policy,
        consistency_level=os.getenv("COSMOS_DB_CONSISTENCY_LEVEL", "Session")  # Session is optimal for most cases
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global cosmos_client, database_client
    
    # Get database configuration from environment variables
    cosmos_endpoint = os.getenv("COSMOS_DB_ENDPOINT")
    database_name = os.getenv("DATABASE_NAME", "assessment_platform")
    
    try:
        # Initialize Azure Cosmos DB client with optimizations
        if cosmos_endpoint:
            cosmos_client = create_optimized_cosmos_client(cosmos_endpoint)
            database_client = cosmos_client.get_database_client(database_name)
            
            # Initialize containers with proper partition keys and throughput
            from database import get_cosmosdb_service
            db_service = await get_cosmosdb_service(database_client)
            await db_service.ensure_containers_exist()
            
            print(f"✓ Connected to Cosmos DB: {database_name}")
            print(f"✓ Optimized connection policy applied")
        else:
            print("⚠️ COSMOS_DB_ENDPOINT not provided, running in development mode")
            cosmos_client = None
            database_client = None
        
    except Exception as e:
        print(f"⚠️ Cosmos DB connection failed: {e}")
        print("Running in development mode without database")
        cosmos_client = None
        database_client = None
    
    # Initialize RAG (vector) service separately if configured
    try:
        rag_service = await get_rag_service()
        if rag_service:
            app.state.rag_service = rag_service
            print("✓ RAG Cosmos (serverless/vector) service ready")
        else:
            app.state.rag_service = None
    except Exception as e:
        print(f"⚠️ Failed to initialize RAG service: {e}")
        app.state.rag_service = None

    yield
    
    # Shutdown
    if cosmos_client:
        # Cosmos DB client doesn't need explicit close
        print("✓ Cosmos DB connection closed")
        pass


app = FastAPI(
    title="Smart Mock",
    description="Backend API for the Smart Mock platform",
    version="1.0.0",
    lifespan=lifespan
)

# Database dependency
async def get_database():
    """Dependency to provide database access to routes"""
    if database_client is None:
        raise HTTPException(
            status_code=503, 
            detail="Database not available. Check connection configuration."
        )
    return database_client

# Container dependencies
def get_assessments_container():
    """Get assessments container client"""
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return database_client.get_container_client("assessments")

def get_candidates_container():
    """Get candidates container client"""
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return database_client.get_container_client("candidates")

def get_results_container():
    """Get results container client"""
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return database_client.get_container_client("results")

# Environment configuration  
def get_settings():
    """Get application settings from environment variables"""
    return {
        "cosmos_db_endpoint": os.getenv("COSMOS_DB_ENDPOINT"),
        "database_name": os.getenv("DATABASE_NAME", "assessment_platform"),
        "azure_openai_endpoint": os.getenv("AZURE_OPENAI_ENDPOINT"),
        "azure_openai_key": os.getenv("AZURE_OPENAI_API_KEY"),
        "judge0_api_url": os.getenv("JUDGE0_API_URL"),
        "judge0_api_key": os.getenv("JUDGE0_API_KEY"),
        "environment": os.getenv("ENVIRONMENT", "development")
    }

# Enhanced CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests for debugging"""
    start_time = time.time()
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(f"Response: {response.status_code} in {process_time:.4f}s")
    
    return response


@app.get("/")
async def root():
    return {"message": "AI Technical Assessment Platform API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected" if database_client else "disconnected"}


@app.get("/metrics")
async def get_metrics():
    """Get Cosmos DB performance metrics"""
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from database import get_cosmosdb_service, cosmos_metrics
        
        # Get service metrics
        service_metrics = {
            "total_request_charge": cosmos_metrics.total_request_charge,
            "operation_count": cosmos_metrics.operation_count,
            "average_ru_per_operation": cosmos_metrics.get_average_ru_per_operation(),
            "average_duration_ms": cosmos_metrics.get_average_duration()
        }
        
        # Get container statistics
        db_service = await get_cosmosdb_service(database_client)
        container_stats = {}
        
        for container_name in ["assessments", "submissions", "users", "questions", "code_executions", "evaluations"]:
            try:
                stats = await db_service.get_container_statistics(container_name)
                container_stats[container_name] = stats
            except Exception as e:
                container_stats[container_name] = {"error": str(e)}
        
        return {
            "service_metrics": service_metrics,
            "container_statistics": container_stats,
            "timestamp": __import__("datetime").datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get metrics: {str(e)}")


@app.get("/metrics/reset")
async def reset_metrics():
    """Reset performance metrics (for testing/monitoring)"""
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    
    try:
        from database import cosmos_metrics
        cosmos_metrics.total_request_charge = 0.0
        cosmos_metrics.operation_count = 0
        cosmos_metrics.operation_times = []
        
        return {"message": "Metrics reset successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset metrics: {str(e)}")


# Include routers
app.include_router(candidate.router, prefix="/api/candidate", tags=["candidate"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(utils.router, prefix="/api/utils", tags=["utils"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])
app.include_router(rag.router, prefix="/api", tags=["rag"])
app.include_router(interview.router, prefix="/api/interview", tags=["interview"])
app.include_router(live_interview.router)


def main():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
