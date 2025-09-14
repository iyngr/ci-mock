from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import httpx
import asyncio
import os
import uuid
from datetime import datetime
import json

from models import (
    RAGQueryRequest, 
    RAGQueryResponse, 
    KnowledgeBaseUpdateRequest, 
    KnowledgeBaseUpdateResponse,
    KnowledgeBaseEntry
)
from database import CosmosDBService, get_cosmosdb_service
from constants import normalize_skill, CONTAINER

router = APIRouter(prefix="/rag", tags=["RAG"])

# LLM Agent service configuration
LLM_AGENT_URL = os.getenv("LLM_AGENT_URL", "http://localhost:8001")
LLM_AGENT_TIMEOUT = 30


# Database dependency
async def get_rag_or_main_db() -> CosmosDBService:
    """Return RAG-dedicated Cosmos service if available, else primary service.

    This allows seamless fallback when the RAG serverless account is not configured.
    """
    from main import database_client, app
    # Prefer rag_service if initialized
    rag_service = getattr(app.state, "rag_service", None)
    if rag_service:
        return rag_service
    # Fallback to primary
    if database_client is None:
        raise HTTPException(status_code=503, detail="Database not available")
    return await get_cosmosdb_service(database_client)


@router.post("/ask", response_model=RAGQueryResponse)
async def ask_rag_question(
    request: RAGQueryRequest,
    db: CosmosDBService = Depends(get_rag_or_main_db)
):
    """
    RAG-powered question answering endpoint.
    Retrieves relevant context from knowledge base and generates informed answers.
    """
    try:
        # Call LLM agent service for RAG processing
        async with httpx.AsyncClient(timeout=LLM_AGENT_TIMEOUT) as client:
            payload = {
                "question": request.question,
                "context_limit": request.context_limit,
                "similarity_threshold": request.similarity_threshold
            }
            
            response = await client.post(
                f"{LLM_AGENT_URL}/rag/query",
                json=payload
            )
            
            if response.status_code != 200:
                error_detail = f"LLM Agent error: {response.status_code}"
                try:
                    error_data = response.json()
                    error_detail += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    error_detail += f" - {response.text[:200]}"
                
                raise HTTPException(
                    status_code=500,
                    detail=f"RAG processing failed: {error_detail}"
                )
            
            rag_result = response.json()
        
        # Extract information from LLM agent response
        answer = rag_result.get("answer", "")
        context_docs = rag_result.get("context_documents", [])
        confidence = rag_result.get("confidence_score")
        
        # Log the RAG query for analytics
        try:
            query_log = {
                "id": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat(),
                "question": request.question,
                "answer_length": len(answer),
                "context_count": len(context_docs),
                "confidence_score": confidence,
                "similarity_threshold": request.similarity_threshold,
                "success": True
            }
            await db.upsert_item(CONTAINER["RAG_QUERIES"], query_log)
            
        except Exception as log_error:
            print(f"Warning: Could not log RAG query: {log_error}")
        
        return RAGQueryResponse(
            success=True,
            answer=answer,
            context_documents=context_docs,
            source_count=len(context_docs),
            confidence_score=confidence,
            message="Question answered successfully using RAG"
        )
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"LLM Agent service unavailable: {str(e)}"
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="RAG processing timed out"
        )
    except Exception as e:
        print(f"Error in RAG query: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error during RAG processing: {str(e)}"
        )


@router.post("/knowledge-base/update", response_model=KnowledgeBaseUpdateResponse)
async def update_knowledge_base(
    request: KnowledgeBaseUpdateRequest,
    db: CosmosDBService = Depends(get_rag_or_main_db)
):
    """
    Update the knowledge base with new content.
    Automatically generates embeddings and stores in KnowledgeBase container.
    """
    try:
        # Generate embedding for the new content
        async with httpx.AsyncClient(timeout=LLM_AGENT_TIMEOUT) as client:
            embedding_payload = {
                "text": request.content
            }
            
            response = await client.post(
                f"{LLM_AGENT_URL}/embeddings/generate",
                json=embedding_payload
            )
            
            if response.status_code != 200:
                print(f"Warning: Could not generate embedding: {response.status_code}")
                embedding = None
            else:
                embedding_result = response.json()
                embedding = embedding_result.get("embedding")
        
        # Create knowledge base entry
        knowledge_entry = KnowledgeBaseEntry(
            id=str(uuid.uuid4()),
            content=request.content,
            skill=normalize_skill(request.skill),
            embedding=embedding,
            content_type=request.content_type,
            metadata=request.metadata or {},
            created_at=datetime.utcnow()
        )
        
        # Store in KnowledgeBase container
        await db.upsert_item(CONTAINER["KNOWLEDGE_BASE"], knowledge_entry.model_dump())
        
        return KnowledgeBaseUpdateResponse(
            success=True,
            knowledge_entry_id=knowledge_entry.id,
            embedding_generated=embedding is not None,
            message="Knowledge base updated successfully"
        )
        
    except httpx.RequestError as e:
        # Still create entry without embedding
        try:
            knowledge_entry = KnowledgeBaseEntry(
                id=str(uuid.uuid4()),
                content=request.content,
                skill=normalize_skill(request.skill),
                embedding=None,
                content_type=request.content_type,
                metadata=request.metadata or {},
                created_at=datetime.utcnow()
            )
            
            await db.upsert_item(CONTAINER["KNOWLEDGE_BASE"], knowledge_entry.model_dump())
            
            return KnowledgeBaseUpdateResponse(
                success=True,
                knowledge_entry_id=knowledge_entry.id,
                embedding_generated=False,
                message=f"Knowledge base updated (embedding generation failed: {str(e)})"
            )
            
        except Exception as fallback_error:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to update knowledge base: {str(fallback_error)}"
            )
            
    except Exception as e:
        print(f"Error updating knowledge base: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal error updating knowledge base: {str(e)}"
        )


@router.get("/knowledge-base/search")
async def search_knowledge_base(
    query: str,
    limit: int = 5,
    threshold: float = 0.7,
    skill: str = None,
    db: CosmosDBService = Depends(get_rag_or_main_db)
):
    """
    Search the knowledge base for relevant content.
    Supports both text-based and vector similarity search.
    """
    try:
        # First try vector search through LLM agent
        try:
            async with httpx.AsyncClient(timeout=LLM_AGENT_TIMEOUT) as client:
                search_payload = {
                    "query": query,
                    "limit": limit,
                    "threshold": threshold,
                    "skill_filter": skill
                }
                
                response = await client.post(
                    f"{LLM_AGENT_URL}/rag/search",
                    json=search_payload
                )
                
                if response.status_code == 200:
                    return response.json()
                    
        except Exception as vector_error:
            print(f"Vector search failed, falling back to text search: {vector_error}")
        
        # Fallback: text-based search
        # Access KnowledgeBase from whichever service is active (rag or primary)
        knowledge_container = db.get_container(CONTAINER["KNOWLEDGE_BASE"])  # unified access
        
        # Build query with optional skill filter
        if skill:
            search_query = """
            SELECT TOP @limit c.id, c.content, c.skill, c.content_type, c.metadata
            FROM c 
            WHERE CONTAINS(LOWER(c.content), LOWER(@query)) 
            AND c.skill = @skill
            ORDER BY c.created_at DESC
            """
            parameters = [
                {"name": "@query", "value": query},
                {"name": "@limit", "value": limit},
                {"name": "@skill", "value": skill}
            ]
        else:
            search_query = """
            SELECT TOP @limit c.id, c.content, c.skill, c.content_type, c.metadata
            FROM c 
            WHERE CONTAINS(LOWER(c.content), LOWER(@query))
            ORDER BY c.created_at DESC
            """
            parameters = [
                {"name": "@query", "value": query},
                {"name": "@limit", "value": limit}
            ]
        
        results = list(knowledge_container.query_items(
            query=search_query,
            parameters=parameters,
            enable_cross_partition_query=True
        ))
        
        return {
            "success": True,
            "results": results,
            "total_found": len(results),
            "search_type": "text_based",
            "message": f"Found {len(results)} results using text search"
        }
        
    except Exception as e:
        print(f"Error searching knowledge base: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge base search failed: {str(e)}"
        )


@router.get("/health")
async def rag_health_check():
    """Health check endpoint for RAG system"""
    try:
        # Check LLM agent connectivity
        llm_agent_status = "unknown"
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.get(f"{LLM_AGENT_URL}/health")
                llm_agent_status = "healthy" if response.status_code == 200 else "unhealthy"
        except:
            llm_agent_status = "unreachable"
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "rag_router": "healthy",
                "llm_agent": llm_agent_status
            },
            "endpoints": [
                "/rag/ask",
                "/rag/knowledge-base/update", 
                "/rag/knowledge-base/search"
            ]
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }
