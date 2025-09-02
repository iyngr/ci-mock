# Auto-Submit Azure Function

This Azure Function automatically submits expired assessment sessions every 5 minutes.

## Overview

The function queries the Cosmos DB for submissions that are:
- Status: `in-progress`
- Current UTC time is greater than `expiration_time`

For each expired submission, it:
1. Updates the status to `completed_auto_submitted`
2. Sets the `submitted_at` timestamp
3. Optionally triggers the AI scoring service

## Configuration

### Required Environment Variables

**Cosmos DB Connection (Choose one method):**

Option 1 - Connection String (Development):
```
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key;
```

Option 2 - Managed Identity (Production - Recommended):
```
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
```

Option 3 - Account Key:
```
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_DB_KEY=your-primary-key
```

**Database Configuration:**
```
COSMOS_DB_NAME=assessment-platform
```

**Optional - AI Scoring Integration:**
```
AI_SCORING_ENDPOINT=https://your-api.com/api/utils/evaluate
```

## Deployment

### Method 1: Azure CLI

```bash
# Create Function App
az functionapp create \
  --resource-group your-rg \
  --consumption-plan-location eastus \
  --runtime python \
  --runtime-version 3.11 \
  --functions-version 4 \
  --name assessment-auto-submit \
  --storage-account yourstorageaccount

# Deploy function
func azure functionapp publish assessment-auto-submit
```

### Method 2: VS Code Extension

1. Install Azure Functions extension
2. Open this folder in VS Code
3. Use Command Palette: "Azure Functions: Deploy to Function App"

### Method 3: GitHub Actions (CI/CD)

Add the provided workflow file to `.github/workflows/` in your repository.

## Local Development

1. Install Azure Functions Core Tools
2. Install Python dependencies: `pip install -r requirements.txt`
3. Configure `local.settings.json` with your Cosmos DB details
4. Run locally: `func start`

## Monitoring

- View execution logs in Azure Portal > Function App > Functions > auto_submit_expired_assessments
- Monitor with Application Insights for detailed telemetry
- Set up alerts for failed executions

## Security Best Practices

1. **Use Managed Identity** in production instead of connection strings
2. **Store secrets** in Azure Key Vault, not environment variables
3. **Enable Application Insights** for monitoring and debugging
4. **Configure appropriate RBAC** permissions for Cosmos DB access
5. **Use private endpoints** for Cosmos DB connectivity in production

## Cosmos DB Permissions Required

The function requires the following permissions on the Cosmos DB account:
- Read access to the `submissions` container
- Write access to update submission documents

For Managed Identity, assign the "Cosmos DB Built-in Data Contributor" role.

## Schedule Configuration

Current schedule: Every 5 minutes (`0 */5 * * * *`)

To modify the schedule, update the CRON expression in `function_app.py`:
- Every minute: `0 * * * * *`
- Every 10 minutes: `0 */10 * * * *`
- Every hour: `0 0 * * * *`

## Error Handling

The function includes comprehensive error handling:
- Individual submission failures don't stop the batch
- Detailed logging for troubleshooting
- Cosmos DB connection retries (built into SDK)

## Performance Considerations

- Function timeout set to 10 minutes
- Cross-partition queries enabled for flexibility
- Batch processing of expired submissions
- Minimal memory footprint for cost efficiency
