from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
from contextlib import asynccontextmanager

# Database
database = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global database
    # For development, we'll use a mock connection
    # In production, this would connect to Azure Cosmos DB
    database = None  # Will be replaced with actual connection
    yield
    # Shutdown
    if database:
        pass  # Close database connection


app = FastAPI(
    title="AI Technical Assessment Platform API",
    description="Backend API for the AI-powered technical assessment platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "AI Technical Assessment Platform API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "database": "connected" if database else "disconnected"}


# Import routers
from routers import candidate, admin, utils

app.include_router(candidate.router, prefix="/api/candidate", tags=["candidate"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(utils.router, prefix="/api/utils", tags=["utils"])


def main():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
