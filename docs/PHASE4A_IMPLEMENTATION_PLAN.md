# Phase 4a Implementation Plan

**Status**: ⏳ **Pending E2E Testing of Phases 1-3**  
**Estimated Implementation Time**: 2-3 hours  
**Cost**: ~$0.05/month (Azure Service Bus Basic tier)

---

## Prerequisites

### Must Complete Before Phase 4a

- [ ] **Phase 1 Working**: Background task queuing with instant response
- [ ] **Phase 2 Working**: Autogen scoring via llm-agent service
- [ ] **Phase 3 Working**: Autogen report generation and storage
- [ ] **E2E Test Passed**: Submit assessment → Scoring → Report generation → Admin retrieval
- [ ] **Azure Resources Created**: Service Bus namespace + 2 queues (see `PHASE4_AZURE_SERVICE_BUS_SETUP.md`)

---

## What Phase 4a Adds

### Hybrid Queue System

**Primary**: Azure Service Bus (Production)
- ✅ Persistent job storage (survives server restarts)
- ✅ Automatic retry with exponential backoff
- ✅ Dead-letter queue for failed jobs
- ✅ Better monitoring via Azure Portal

**Fallback**: FastAPI BackgroundTasks (Development)
- ✅ No Azure dependencies for local dev
- ✅ Fast iteration during development
- ✅ Emergency fallback if Service Bus unavailable

**Feature Flag**: `USE_SERVICE_BUS` environment variable
- `true` → Use Service Bus (production)
- `false` → Use BackgroundTasks (local dev)

---

## Implementation Steps

### Step 1: Install Dependencies

**backend/pyproject.toml**:
```toml
[project]
dependencies = [
    # Existing dependencies...
    "azure-servicebus>=7.12.0",  # NEW: Azure Service Bus SDK
]
```

**Install**:
```bash
cd backend
uv add azure-servicebus
```

---

### Step 2: Create Service Bus Client

**backend/service_bus.py** (NEW FILE):
```python
"""
Azure Service Bus client for reliable job queuing.
Provides persistent job storage with automatic retry and dead-letter queue.
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from azure.servicebus.exceptions import ServiceBusError

logger = logging.getLogger(__name__)

class ServiceBusQueue:
    """Service Bus queue wrapper with error handling"""
    
    def __init__(self):
        self.connection_string = os.getenv("AZURE_SERVICE_BUS_CONNECTION_STRING")
        self.scoring_queue = os.getenv("AZURE_SERVICE_BUS_SCORING_QUEUE", "scoring-jobs")
        self.report_queue = os.getenv("AZURE_SERVICE_BUS_REPORT_QUEUE", "report-jobs")
        self.enabled = os.getenv("USE_SERVICE_BUS", "false").lower() == "true"
        
        self._client: Optional[ServiceBusClient] = None
        
        if self.enabled:
            if not self.connection_string:
                logger.warning("USE_SERVICE_BUS=true but AZURE_SERVICE_BUS_CONNECTION_STRING not set")
                self.enabled = False
            else:
                try:
                    self._client = ServiceBusClient.from_connection_string(self.connection_string)
                    logger.info("Service Bus client initialized successfully")
                except Exception as e:
                    logger.error(f"Failed to initialize Service Bus client: {e}")
                    self.enabled = False
    
    async def send_scoring_job(self, submission_id: str, metadata: Dict[str, Any] = None) -> bool:
        """Send scoring job to queue"""
        return await self._send_message(
            queue_name=self.scoring_queue,
            message_data={
                "job_type": "scoring",
                "submission_id": submission_id,
                "metadata": metadata or {}
            }
        )
    
    async def send_report_job(self, submission_id: str, metadata: Dict[str, Any] = None) -> bool:
        """Send report generation job to queue"""
        return await self._send_message(
            queue_name=self.report_queue,
            message_data={
                "job_type": "report",
                "submission_id": submission_id,
                "metadata": metadata or {}
            }
        )
    
    async def _send_message(self, queue_name: str, message_data: Dict[str, Any]) -> bool:
        """Send message to Service Bus queue"""
        if not self.enabled or not self._client:
            return False
        
        try:
            sender = self._client.get_queue_sender(queue_name=queue_name)
            message = ServiceBusMessage(
                body=json.dumps(message_data),
                content_type="application/json",
                message_id=message_data.get("submission_id")  # Idempotency
            )
            
            async with sender:
                await sender.send_messages(message)
            
            logger.info(f"Message sent to {queue_name}: {message_data.get('submission_id')}")
            return True
            
        except ServiceBusError as e:
            logger.error(f"Service Bus error sending to {queue_name}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending to {queue_name}: {e}")
            return False
    
    async def get_queue_stats(self, queue_name: str) -> Dict[str, int]:
        """Get queue statistics (active, dead-letter, scheduled message counts)"""
        if not self.enabled or not self._client:
            return {"error": "Service Bus not enabled"}
        
        try:
            # Note: Requires management operations (future enhancement)
            return {
                "active_messages": 0,
                "dead_letter_messages": 0,
                "scheduled_messages": 0
            }
        except Exception as e:
            logger.error(f"Error getting queue stats: {e}")
            return {"error": str(e)}
    
    def close(self):
        """Close Service Bus client"""
        if self._client:
            self._client.close()
            logger.info("Service Bus client closed")

# Global instance
service_bus = ServiceBusQueue()
```

---

### Step 3: Update Submission Endpoint with Hybrid Queue Logic

**backend/routers/candidate.py** (MODIFY):

Add at top of file:
```python
from service_bus import service_bus
```

Replace submission endpoint:
```python
@router.post("/assessment/{test_id}/submit")
async def submit_assessment(
    test_id: str,
    submission: SubmissionData,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user_optional),
    db: CosmosDBService = Depends(get_cosmos_db),
):
    """Submit assessment with hybrid queue (Service Bus + BackgroundTasks fallback)"""
    
    # ... existing validation code ...
    
    # Save submission to database
    submission_doc = await create_submission_document(test_id, submission, db)
    submission_id = submission_doc["id"]
    
    # Phase 4a: Hybrid queue routing
    if service_bus.enabled:
        # Try Service Bus first
        success = await service_bus.send_scoring_job(
            submission_id=submission_id,
            metadata={"assessment_id": test_id}
        )
        
        if success:
            logger.info(f"✓ Scoring job queued to Service Bus: {submission_id}")
        else:
            # Automatic fallback to BackgroundTasks
            logger.warning(f"Service Bus failed, falling back to BackgroundTasks: {submission_id}")
            background_tasks.add_task(trigger_scoring_workflow, submission_id, db)
    else:
        # Direct BackgroundTasks (local dev, or USE_SERVICE_BUS=false)
        logger.info(f"Using BackgroundTasks for scoring: {submission_id}")
        background_tasks.add_task(trigger_scoring_workflow, submission_id, db)
    
    return {
        "success": True,
        "submission_id": submission_id,
        "message": "Assessment submitted successfully",
        "queue_mode": "service_bus" if service_bus.enabled else "background_tasks"
    }
```

Modify report generation trigger:
```python
async def trigger_report_generation(submission_id: str, db: CosmosDBService):
    """Phase 3: Generate comprehensive report using Autogen"""
    
    # ... existing code ...
    
    # After successful scoring, queue report generation
    if service_bus.enabled:
        success = await service_bus.send_report_job(
            submission_id=submission_id,
            metadata={"evaluation_id": evaluation_id}
        )
        
        if not success:
            logger.warning(f"Service Bus unavailable, report will be generated inline")
            # Continue with inline report generation (existing code)
    else:
        # Inline report generation (existing behavior)
        logger.info(f"Generating report inline (BackgroundTasks mode)")
```

---

### Step 4: Create Background Worker

**backend/worker.py** (NEW FILE):
```python
"""
Background worker for processing Service Bus queue messages.
Run as separate process: python -m worker
"""
import asyncio
import json
import logging
import os
import signal
from azure.servicebus.aio import ServiceBusClient
from database import CosmosDBService
from routers.candidate import trigger_scoring_workflow, trigger_report_generation

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QueueWorker:
    """Process jobs from Service Bus queues"""
    
    def __init__(self):
        self.connection_string = os.getenv("AZURE_SERVICE_BUS_CONNECTION_STRING")
        self.scoring_queue = os.getenv("AZURE_SERVICE_BUS_SCORING_QUEUE", "scoring-jobs")
        self.report_queue = os.getenv("AZURE_SERVICE_BUS_REPORT_QUEUE", "report-jobs")
        self.running = True
        self.db = None
    
    async def start(self):
        """Start processing both queues"""
        logger.info("Starting Service Bus worker...")
        
        # Initialize database connection
        self.db = CosmosDBService()
        
        # Create Service Bus client
        async with ServiceBusClient.from_connection_string(self.connection_string) as client:
            # Process both queues concurrently
            await asyncio.gather(
                self._process_queue(client, self.scoring_queue, self._process_scoring_job),
                self._process_queue(client, self.report_queue, self._process_report_job)
            )
    
    async def _process_queue(self, client, queue_name, handler):
        """Process messages from a queue"""
        receiver = client.get_queue_receiver(queue_name=queue_name)
        
        logger.info(f"Listening to queue: {queue_name}")
        
        async with receiver:
            while self.running:
                try:
                    # Receive messages (max 10, wait 5 seconds)
                    received_msgs = await receiver.receive_messages(max_message_count=10, max_wait_time=5)
                    
                    for message in received_msgs:
                        try:
                            # Parse message
                            body = json.loads(str(message))
                            submission_id = body.get("submission_id")
                            
                            logger.info(f"Processing {queue_name}: {submission_id}")
                            
                            # Process job
                            await handler(submission_id)
                            
                            # Mark message complete
                            await receiver.complete_message(message)
                            logger.info(f"✓ Completed {queue_name}: {submission_id}")
                            
                        except Exception as e:
                            logger.error(f"Error processing message: {e}")
                            # Message will return to queue for retry
                            await receiver.abandon_message(message)
                
                except Exception as e:
                    if self.running:
                        logger.error(f"Queue receiver error: {e}")
                        await asyncio.sleep(5)  # Wait before retry
    
    async def _process_scoring_job(self, submission_id: str):
        """Process scoring job"""
        await trigger_scoring_workflow(submission_id, self.db)
    
    async def _process_report_job(self, submission_id: str):
        """Process report generation job"""
        await trigger_report_generation(submission_id, self.db)
    
    def stop(self):
        """Graceful shutdown"""
        logger.info("Stopping worker...")
        self.running = False

# Main entry point
async def main():
    worker = QueueWorker()
    
    # Handle shutdown signals
    def signal_handler(signum, frame):
        worker.stop()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    await worker.start()

if __name__ == "__main__":
    asyncio.run(main())
```

**Run worker**:
```bash
cd backend
uv run python -m worker
```

---

### Step 5: Add Admin Monitoring Endpoint

**backend/routers/admin.py** (ADD):
```python
from service_bus import service_bus

@router.get("/queue/status")
async def get_queue_status():
    """Get Service Bus queue status and metrics"""
    
    if not service_bus.enabled:
        return {
            "service_bus_enabled": False,
            "mode": "background_tasks",
            "message": "Using FastAPI BackgroundTasks (local development mode)"
        }
    
    scoring_stats = await service_bus.get_queue_stats(service_bus.scoring_queue)
    report_stats = await service_bus.get_queue_stats(service_bus.report_queue)
    
    return {
        "service_bus_enabled": True,
        "mode": "service_bus",
        "queues": {
            "scoring-jobs": scoring_stats,
            "report-jobs": report_stats
        }
    }
```

---

## Testing Plan

### Test 1: BackgroundTasks Mode (Local Dev)

```bash
# .env
USE_SERVICE_BUS=false

# Start backend
cd backend
uv run uvicorn main:app --port 8000 --reload

# Submit assessment
# Verify: Uses BackgroundTasks (logs show "Using BackgroundTasks")
```

### Test 2: Service Bus Mode (Production)

```bash
# .env
USE_SERVICE_BUS=true
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://...

# Start backend
uv run uvicorn main:app --port 8000 --reload

# Start worker (separate terminal)
uv run python -m worker

# Submit assessment
# Verify: 
# - Backend logs: "Scoring job queued to Service Bus"
# - Worker logs: "Processing scoring-jobs: sub_123"
# - Worker logs: "✓ Completed scoring-jobs: sub_123"
```

### Test 3: Fallback Behavior

```bash
# Stop worker
# Submit assessment
# Verify: Backend automatically falls back to BackgroundTasks
```

---

## Files to Create/Modify

### New Files
- [ ] `backend/service_bus.py` - Service Bus client wrapper
- [ ] `backend/worker.py` - Background queue processor
- [ ] `docs/PHASE4_AZURE_SERVICE_BUS_SETUP.md` - Azure setup guide ✅
- [ ] `docs/PHASE4A_IMPLEMENTATION_PLAN.md` - This file ✅

### Modified Files
- [ ] `backend/pyproject.toml` - Add azure-servicebus dependency
- [ ] `backend/routers/candidate.py` - Add hybrid queue logic
- [ ] `backend/routers/admin.py` - Add queue status endpoint
- [ ] `backend/.env.example` - Add Service Bus config ✅

---

## Success Criteria

- [ ] `USE_SERVICE_BUS=false` → Uses BackgroundTasks (local dev)
- [ ] `USE_SERVICE_BUS=true` → Uses Service Bus (production)
- [ ] Worker processes jobs from both queues
- [ ] Failed jobs automatically retry (3 times)
- [ ] Failed jobs move to dead-letter queue after max retries
- [ ] Admin endpoint shows queue status
- [ ] Automatic fallback to BackgroundTasks if Service Bus unavailable
- [ ] Zero breaking changes to existing functionality

---

## Deployment

### Development
```bash
# backend/.env.local
USE_SERVICE_BUS=false
```

### Production
```bash
# backend/.env
USE_SERVICE_BUS=true
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://ci-mock-servicebus.servicebus.windows.net/;...
```

**Container Deployment** (Azure Container Apps):
```bash
# Set environment variables in Azure Portal
USE_SERVICE_BUS=true
AZURE_SERVICE_BUS_CONNECTION_STRING=<from-key-vault>

# Run two containers:
# 1. FastAPI backend (web server)
# 2. Worker (queue processor)
```

---

## Monitoring

### Azure Portal
1. Navigate to Service Bus → Queues
2. Check "Active Messages" count (should be low)
3. Check "Dead-lettered Messages" (should be 0)
4. Review metrics for throughput

### Admin API
```bash
# Check queue status
curl http://localhost:8000/api/admin/queue/status

# Response:
{
  "service_bus_enabled": true,
  "mode": "service_bus",
  "queues": {
    "scoring-jobs": {
      "active_messages": 2,
      "dead_letter_messages": 0
    },
    "report-jobs": {
      "active_messages": 1,
      "dead_letter_messages": 0
    }
  }
}
```

---

## Rollback Plan

If Phase 4a causes issues:

1. **Immediate**: Set `USE_SERVICE_BUS=false` (automatic fallback)
2. **Backend**: Restart without Service Bus
3. **No Data Loss**: All existing submissions work with BackgroundTasks
4. **No Code Removal**: Keep Service Bus code for future retry

---

## Next Phase: Phase 4b (Future)

After Phase 4a is stable:
- PDF report generation
- Email delivery to candidates
- Frontend dashboard for reports
- Advanced analytics and trends

---

**Status**: ⏳ **Waiting for E2E Testing + Azure Setup**  
**Documentation**: ✅ Complete  
**Implementation**: Ready to start after prerequisites met
