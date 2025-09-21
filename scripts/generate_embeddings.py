#!/usr/bin/env python3
"""
Embedding Backfill Script for RAG System

This script reads all existing questions from the Assessments container,
generates vector embeddings using Azure OpenAI, and populates the 
KnowledgeBase container for RAG functionality.

Usage:
    python scripts/generate_embeddings.py

Environment Variables Required:
    - AZURE_OPENAI_ENDPOINT
    - AZURE_OPENAI_API_KEY
    - AZURE_COSMOS_CONNECTION_STRING
"""

import asyncio
import os
import sys
import logging
from typing import List, Dict, Any
from datetime import datetime

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

try:
    from azure.cosmos import CosmosClient
    from azure.core.credentials import AzureKeyCredential
    import openai
except ImportError as e:
    print(f"Missing required packages: {e}")
    print("Install with: pip install azure-cosmos openai")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmbeddingGenerator:
    """Handles embedding generation and Cosmos DB operations for RAG backfill"""
    
    def __init__(self):
        self.cosmos_client = None
        self.database = None
        self.assessments_container = None
        self.knowledge_base_container = None
        self.openai_client = None
        # Canonical embedding model env var with fallback
        self.embedding_model = os.getenv("AZURE_OPENAI_EMBED_DEPLOYMENT", os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"))
        
    async def initialize(self):
        """Initialize Azure services"""
        try:
            # Initialize Cosmos DB
            cosmos_connection = os.getenv('AZURE_COSMOS_CONNECTION_STRING')
            if not cosmos_connection:
                raise ValueError("AZURE_COSMOS_CONNECTION_STRING environment variable not set")
            
            self.cosmos_client = CosmosClient.from_connection_string(cosmos_connection)
            self.database = self.cosmos_client.get_database_client("assessment_db")
            self.assessments_container = self.database.get_container_client("assessments")
            self.knowledge_base_container = self.database.get_container_client("KnowledgeBase")
            
            # Initialize Azure OpenAI
            openai_endpoint = os.getenv('AZURE_OPENAI_ENDPOINT')
            openai_key = os.getenv('AZURE_OPENAI_API_KEY')
            
            if not openai_endpoint or not openai_key:
                raise ValueError("Azure OpenAI environment variables not set")
            
            self.openai_client = openai.AsyncAzureOpenAI(
                azure_endpoint=openai_endpoint,
                api_key=openai_key,
                api_version="2024-02-15-preview"
            )
            
            logger.info("✅ Successfully initialized Azure services")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize services: {e}")
            raise
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for given text using Azure OpenAI"""
        try:
            response = await self.openai_client.embeddings.create(
                model=self.embedding_model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Failed to generate embedding for text: {text[:50]}... Error: {e}")
            raise
    
    async def get_all_assessments(self) -> List[Dict[str, Any]]:
        """Retrieve all assessments from Cosmos DB"""
        try:
            query = "SELECT * FROM c"
            items = list(self.assessments_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            logger.info(f"📄 Found {len(items)} assessments to process")
            return items
        except Exception as e:
            logger.error(f"Failed to retrieve assessments: {e}")
            raise
    
    async def extract_questions_from_assessment(self, assessment: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract individual questions from an assessment"""
        questions = []
        assessment_questions = assessment.get('questions', [])
        
        for question in assessment_questions:
            if isinstance(question, dict) and question.get('text'):
                questions.append({
                    'id': question.get('id', f"q_{assessment.get('id', 'unknown')}_{len(questions)}"),
                    'text': question.get('text', ''),
                    'skill': question.get('skill', 'general'),
                    'type': question.get('type', 'unknown'),
                    'assessment_id': assessment.get('id', 'unknown')
                })
        
        return questions
    
    async def check_existing_entry(self, question_id: str) -> bool:
        """Check if a knowledge base entry already exists for this question"""
        try:
            query = f"SELECT c.id FROM c WHERE c.id = '{question_id}'"
            items = list(self.knowledge_base_container.query_items(
                query=query,
                enable_cross_partition_query=True
            ))
            return len(items) > 0
        except Exception:
            return False
    
    async def save_to_knowledge_base(self, question: Dict[str, Any], embedding: List[float]):
        """Save question and embedding to KnowledgeBase container"""
        try:
            # Check if entry already exists
            if await self.check_existing_entry(question['id']):
                logger.info(f"⏭️  Skipping existing entry: {question['id']}")
                return
            
            knowledge_entry = {
                "id": question['id'],
                "content": question['text'],
                "skill": question['skill'],
                "embedding": embedding,
                "sourceType": "question",
                "embeddingModel": self.embedding_model,
                "metadata": {
                    "type": question['type'],
                    "assessment_id": question['assessment_id']
                },
                "indexedAt": datetime.utcnow().isoformat(),
                "accessCount": 0
            }
            
            # Use skill as partition key (matching the model)
            partition_key = question['skill'].lower().replace(" ", "-")
            
            self.knowledge_base_container.create_item(
                body=knowledge_entry,
                partition_key=partition_key
            )
            
            logger.info(f"✅ Saved knowledge entry: {question['id']} (skill: {question['skill']})")
            
        except Exception as e:
            logger.error(f"❌ Failed to save knowledge entry for {question['id']}: {e}")
            raise
    
    async def process_batch(self, questions: List[Dict[str, Any]], batch_size: int = 10):
        """Process questions in batches to avoid rate limits"""
        total_questions = len(questions)
        processed = 0
        
        for i in range(0, total_questions, batch_size):
            batch = questions[i:i + batch_size]
            
            for question in batch:
                try:
                    # Generate embedding
                    embedding = await self.generate_embedding(question['text'])
                    
                    # Save to knowledge base
                    await self.save_to_knowledge_base(question, embedding)
                    
                    processed += 1
                    logger.info(f"📊 Progress: {processed}/{total_questions} questions processed")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to process question {question['id']}: {e}")
                    continue
            
            # Small delay between batches to respect rate limits
            if i + batch_size < total_questions:
                await asyncio.sleep(1)
    
    async def run_backfill(self):
        """Main backfill process"""
        logger.info("🚀 Starting RAG knowledge base backfill...")
        
        try:
            # Initialize services
            await self.initialize()
            
            # Get all assessments
            assessments = await self.get_all_assessments()
            
            # Extract all questions
            all_questions = []
            for assessment in assessments:
                questions = await self.extract_questions_from_assessment(assessment)
                all_questions.extend(questions)
            
            logger.info(f"📝 Extracted {len(all_questions)} questions from {len(assessments)} assessments")
            
            if not all_questions:
                logger.warning("⚠️  No questions found to process")
                return
            
            # Process questions in batches
            await self.process_batch(all_questions)
            
            logger.info("🎉 Backfill completed successfully!")
            
        except Exception as e:
            logger.error(f"💥 Backfill failed: {e}")
            raise

async def main():
    """Main entry point"""
    generator = EmbeddingGenerator()
    await generator.run_backfill()

if __name__ == "__main__":
    # Check environment variables
    required_vars = [
        'AZURE_OPENAI_ENDPOINT',
        'AZURE_OPENAI_API_KEY', 
        'AZURE_COSMOS_CONNECTION_STRING'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        print("❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nSet these variables and try again.")
        sys.exit(1)
    
    asyncio.run(main())
