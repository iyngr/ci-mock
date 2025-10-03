# Phase 4a: Azure Service Bus Setup Guide

⚠️ **IMPORTANT**: Complete E2E testing of Phases 1-3 before implementing Phase 4a!

**Current Status**: ✅ Phases 1-3 Complete → ⏳ E2E Testing → Phase 4a Implementation

---

## Overview

Phase 4a adds **Azure Service Bus** as a reliable job queue alongside existing FastAPI BackgroundTasks. This provides:

- ✅ **Persistent job storage** (survives server restarts)
- ✅ **Automatic retry** with exponential backoff
- ✅ **Dead-letter queue** for failed jobs
- ✅ **Better monitoring** via Azure Portal
- ✅ **Fallback to BackgroundTasks** for local development

**Cost**: ~$0.05/month for 50-100 interviews/day (Basic tier)

---

## Azure Resources to Create

### Step 1: Create Service Bus Namespace (5 minutes)

#### Option A: Azure Portal

1. **Navigate to Azure Portal** → [portal.azure.com](https://portal.azure.com)

2. **Create Resource**:
   - Search for "Service Bus"
   - Click "Create"

3. **Configure Namespace**:
   ```
   Subscription: <your-subscription>
   Resource Group: <same as Cosmos DB>
   Namespace name: ci-mock-servicebus (or assessment-queue)
   Location: <same region as Cosmos DB>
   Pricing tier: Basic (~$0.05/month)
   ```

4. **Review + Create** → Wait for deployment (~2 minutes)

#### Option B: Azure CLI

```bash
# Set variables
RESOURCE_GROUP="your-resource-group"
LOCATION="eastus"  # Same as your Cosmos DB
NAMESPACE_NAME="ci-mock-servicebus"

# Create Service Bus namespace (Basic tier)
az servicebus namespace create \
  --resource-group $RESOURCE_GROUP \
  --name $NAMESPACE_NAME \
  --location $LOCATION \
  --sku Basic

# Wait for deployment
az servicebus namespace show \
  --resource-group $RESOURCE_GROUP \
  --name $NAMESPACE_NAME \
  --query "provisioningState"
```

**Expected Output**: `"Succeeded"`

---

### Step 2: Create Queues (2 minutes)

You need **two queues** for the assessment workflow:
1. `scoring-jobs` - For assessment scoring tasks
2. `report-jobs` - For report generation tasks

#### Option A: Azure Portal

1. **Navigate to Service Bus Namespace** → Your namespace (e.g., `ci-mock-servicebus`)

2. **Create Scoring Queue**:
   - Click "+ Queue" (in left sidebar under Entities)
   - Name: `scoring-jobs`
   - Max delivery count: 3 (retries before dead-letter)
   - Lock duration: 5 minutes
   - Default message TTL: 1 hour
   - Leave other settings as default
   - Click "Create"

3. **Create Report Queue**:
   - Click "+ Queue"
   - Name: `report-jobs`
   - Same settings as above
   - Click "Create"

#### Option B: Azure CLI

```bash
# Create scoring-jobs queue
az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE_NAME \
  --name scoring-jobs \
  --max-delivery-count 3 \
  --lock-duration PT5M \
  --default-message-time-to-live PT1H

# Create report-jobs queue
az servicebus queue create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE_NAME \
  --name report-jobs \
  --max-delivery-count 3 \
  --lock-duration PT5M \
  --default-message-time-to-live PT1H
```

---

### Step 3: Get Connection String (2 minutes)

#### Option A: Azure Portal

1. **Navigate to Service Bus Namespace** → Your namespace

2. **Shared access policies** (left sidebar under Settings)

3. **Click "RootManageSharedAccessKey"**

4. **Copy "Primary Connection String"**:
   ```
   Endpoint=sb://ci-mock-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=ABC123...
   ```

5. **Save this for .env configuration**

#### Option B: Azure CLI

```bash
# Get connection string
az servicebus namespace authorization-rule keys list \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE_NAME \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString \
  --output tsv
```

**Copy the output** - this is your connection string.

---

## Environment Configuration

### backend/.env

Add these settings to your `backend/.env`:

```bash
# ===== Phase 4a: Azure Service Bus =====
# Enable Service Bus (set to false for local dev with BackgroundTasks)
USE_SERVICE_BUS=true

# Connection String (from Step 3 above)
AZURE_SERVICE_BUS_CONNECTION_STRING=Endpoint=sb://ci-mock-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=your-key-here

# Queue Names (must match queues created in Step 2)
AZURE_SERVICE_BUS_SCORING_QUEUE=scoring-jobs
AZURE_SERVICE_BUS_REPORT_QUEUE=report-jobs

# Optional Advanced Settings (defaults shown)
AZURE_SERVICE_BUS_MAX_RETRIES=3
AZURE_SERVICE_BUS_RETRY_DELAY=60
AZURE_SERVICE_BUS_MESSAGE_TTL=3600
```

### For Local Development

Keep Service Bus disabled during local development:

```bash
# backend/.env.local (git-ignored)
USE_SERVICE_BUS=false

# Everything else remains the same
# BackgroundTasks will be used automatically
```

---

## Verification Checklist

Before implementing Phase 4a code, verify:

### Azure Portal Checks
- [ ] Service Bus namespace created (Basic tier)
- [ ] Namespace shows "Active" status
- [ ] Queue `scoring-jobs` exists
- [ ] Queue `report-jobs` exists
- [ ] Connection string copied to .env

### Cost Verification
- [ ] Pricing tier shows "Basic"
- [ ] Expected cost: ~$0.05/month for your volume
- [ ] No unexpected features enabled (Topics, Sessions, etc.)

### Configuration Checks
- [ ] `USE_SERVICE_BUS` set correctly (true for prod, false for dev)
- [ ] `AZURE_SERVICE_BUS_CONNECTION_STRING` matches Azure Portal
- [ ] Queue names match exactly: `scoring-jobs` and `report-jobs`

---

## Queue Configuration Details

### Recommended Settings for 50-100 Interviews/Day

| Setting                   | Value           | Reason                                           |
| ------------------------- | --------------- | ------------------------------------------------ |
| **Max Delivery Count**    | 3               | Retry failed jobs 3 times before dead-letter     |
| **Lock Duration**         | 5 minutes       | Enough time for scoring/report (typical: 10-45s) |
| **Message TTL**           | 1 hour          | Jobs older than 1 hour are likely stale          |
| **Max Queue Size**        | 1 GB (default)  | More than enough for 50-100 jobs/day             |
| **Enable Partitioning**   | No              | Not needed for Basic tier                        |
| **Enable Dead Lettering** | Yes (automatic) | Capture failed jobs for debugging                |

### Queue Behavior

**Normal Flow**:
```
Assessment Submitted
  ↓
Message sent to scoring-jobs queue
  ↓
Worker picks up message (locks for 5 min)
  ↓
Scoring completes successfully (10-30s)
  ↓
Message marked complete and deleted
  ↓
Message sent to report-jobs queue
  ↓
Worker picks up message
  ↓
Report generated successfully (5-15s)
  ↓
Message marked complete and deleted
```

**Failure Flow**:
```
Message picked up by worker
  ↓
Processing fails (exception thrown)
  ↓
Message lock expires (returns to queue)
  ↓
Retry #1 (after 60s delay)
  ↓
Still fails
  ↓
Retry #2 (after 60s delay)
  ↓
Still fails
  ↓
Retry #3 (after 60s delay)
  ↓
Max delivery count reached (3)
  ↓
Message moved to Dead-Letter Queue
  ↓
Admin reviews dead-letter queue for errors
```

---

## Monitoring After Setup

### Azure Portal Monitoring

1. **Queue Depth**:
   - Navigate to Queue → Overview
   - Check "Active Messages" count
   - Should be 0-5 under normal load

2. **Dead-Letter Queue**:
   - Navigate to Queue → Overview
   - Check "Dead-lettered Messages" count
   - Should be 0 (any messages here indicate failures)

3. **Metrics**:
   - Navigate to Namespace → Metrics
   - Add chart: "Incoming Messages" and "Outgoing Messages"
   - Monitor throughput over time

### Admin Endpoint (Phase 4a Implementation)

After Phase 4a is implemented, you'll have:

```bash
# Check queue status
GET /api/admin/queue/status

# Response:
{
  "service_bus_enabled": true,
  "queues": {
    "scoring-jobs": {
      "active_messages": 2,
      "dead_letter_messages": 0,
      "scheduled_messages": 0
    },
    "report-jobs": {
      "active_messages": 1,
      "dead_letter_messages": 0,
      "scheduled_messages": 0
    }
  },
  "fallback_mode": false
}
```

---

## Cost Breakdown

### Basic Tier Pricing (2025 Rates)

| Component      | Allowance   | Cost                             |
| -------------- | ----------- | -------------------------------- |
| **Base Price** | Included    | $0.05/month                      |
| **Operations** | 100M/month  | Free (well above your ~6K/month) |
| **Namespace**  | 1 namespace | Included                         |
| **Queues**     | Unlimited   | Free                             |
| **Storage**    | First 10 GB | Free                             |

**Your Expected Cost**: **~$0.05/month** (essentially free!)

### Comparison to Standard Tier

| Feature                | Basic (Your Choice) | Standard    | Premium     |
| ---------------------- | ------------------- | ----------- | ----------- |
| **Price**              | ~$0.05/month        | ~$10/month  | ~$650/month |
| **Queues**             | ✅ Unlimited         | ✅ Unlimited | ✅ Unlimited |
| **Dead-letter**        | ✅ Yes               | ✅ Yes       | ✅ Yes       |
| **Scheduled Delivery** | ✅ Yes               | ✅ Yes       | ✅ Yes       |
| **Topics**             | ❌ No                | ✅ Yes       | ✅ Yes       |
| **De-duplication**     | ❌ No                | ✅ Yes       | ✅ Yes       |
| **Sessions**           | ❌ No                | ✅ Yes       | ✅ Yes       |
| **Geo-DR**             | ❌ No                | ❌ No        | ✅ Yes       |

**You don't need** Topics, De-duplication, or Sessions for your workflow!

---

## Security Best Practices

### Connection String Security

⚠️ **NEVER commit connection strings to git!**

1. **Add to .gitignore**:
   ```bash
   # .gitignore
   .env
   .env.local
   .env.*.local
   ```

2. **Use Azure Key Vault** (Production):
   ```python
   # Instead of environment variables, fetch from Key Vault
   from azure.keyvault.secrets import SecretClient
   
   connection_string = secret_client.get_secret("ServiceBusConnectionString").value
   ```

3. **Rotate Keys Periodically**:
   - Azure Portal → Service Bus → Shared access policies
   - Regenerate keys every 90 days
   - Update .env and restart services

### Least Privilege Access

For production, create a **custom SAS policy** instead of using RootManageSharedAccessKey:

```bash
# Create send-only policy for backend
az servicebus queue authorization-rule create \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE_NAME \
  --queue-name scoring-jobs \
  --name BackendSendPolicy \
  --rights Send

# Get connection string for send-only policy
az servicebus queue authorization-rule keys list \
  --resource-group $RESOURCE_GROUP \
  --namespace-name $NAMESPACE_NAME \
  --queue-name scoring-jobs \
  --name BackendSendPolicy \
  --query primaryConnectionString
```

---

## Troubleshooting

### Issue: "Namespace not found"

**Symptom**: Connection fails with "The messaging entity could not be found"

**Solution**:
1. Verify namespace name in connection string matches Azure Portal
2. Check namespace is in "Active" state
3. Ensure connection string hasn't expired

### Issue: "Queue not found"

**Symptom**: "The messaging entity 'scoring-jobs' could not be found"

**Solution**:
1. Verify queue exists in Azure Portal
2. Check queue name spelling matches exactly
3. Ensure queue is in same namespace as connection string

### Issue: "Unauthorized access"

**Symptom**: "UnauthorizedAccessException: Manage,EntityRead or Send claims are required"

**Solution**:
1. Use RootManageSharedAccessKey for full access
2. Or create custom SAS policy with required permissions
3. Verify connection string includes `SharedAccessKey` parameter

### Issue: High costs

**Symptom**: Bill shows >$1/month

**Solution**:
1. Verify pricing tier is "Basic" not "Standard"
2. Check for orphaned namespaces in other resource groups
3. Review Azure Cost Management for unexpected operations

---

## Next Steps After Azure Setup

Once you've completed this setup:

1. ✅ **Verify Resources Created**:
   - Service Bus namespace (Basic tier)
   - Two queues: `scoring-jobs` and `report-jobs`
   - Connection string saved to .env

2. ✅ **Complete E2E Testing** (Phases 1-3):
   - Submit assessment → Scoring completes → Report generates
   - Verify all three phases work end-to-end
   - Test with multiple concurrent submissions

3. ✅ **Ready for Phase 4a Implementation**:
   - Install azure-servicebus Python SDK
   - Create Service Bus client wrapper
   - Add queue message sender
   - Implement background worker
   - Add fallback logic to BackgroundTasks

---

## Phase 4a Implementation Checklist

When you're ready to implement Phase 4a code:

- [ ] Azure resources created and verified (this document)
- [ ] E2E testing of Phases 1-3 complete
- [ ] .env configured with Service Bus connection string
- [ ] Install `azure-servicebus` Python package
- [ ] Create `backend/service_bus.py` (Service Bus client)
- [ ] Update `backend/routers/candidate.py` (hybrid queue logic)
- [ ] Create `backend/worker.py` (background queue processor)
- [ ] Add `GET /admin/queue/status` endpoint
- [ ] Test with `USE_SERVICE_BUS=false` (BackgroundTasks)
- [ ] Test with `USE_SERVICE_BUS=true` (Service Bus)
- [ ] Verify fallback works if Service Bus unavailable

---

## Summary

**What You're Creating**:
- 1 Service Bus namespace (Basic tier)
- 2 queues (scoring-jobs, report-jobs)
- Connection string for backend

**Cost**: ~$0.05/month

**Timeline**:
1. **Now**: Create Azure resources (this guide) - 10 minutes
2. **Next**: Complete E2E testing of Phases 1-3
3. **Then**: Implement Phase 4a code - 2-3 hours

**Key Benefit**: Production-grade job queue for essentially free, with automatic fallback to BackgroundTasks for local development!

---

**Status**: ⏳ **Waiting for E2E Testing Completion**  
**Next**: Phase 4a Implementation (after E2E testing successful)  
**Documentation**: Ready ✅
