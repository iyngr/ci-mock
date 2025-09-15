# Auto-Submit Azure Function (Timer)

Timer-triggered Azure Function that enforces authoritative assessment expiry and initiates evaluation handoff. Runs on a 5‑minute schedule (configurable) and finalizes any `in-progress` submissions whose `expiration_time` has elapsed.

## 1. Overview

Logic:
1. Query `submissions` (partition key `/assessment_id`) for expired sessions (status `in-progress`, `utc_now > expiration_time`).
2. Atomically update submission → `status=completed_auto_submitted`, set `submitted_at`.
3. Enqueue / invoke evaluation (optional HTTP call to backend or LLM Agent pipeline depending on configuration).
4. Skip already finalized submissions to ensure idempotence.

Separation of concerns: scoring artifacts are written to the `evaluations` container (PK `/submission_id`) by backend / agent services — the function does not embed large evaluation payloads in the submission document.

---
## 2. Configuration

### Required Environment Variables

**Cosmos DB Connection (choose one for local dev; use Managed Identity in Azure):**

Option 1 - Connection String (Development):
```
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=https://your-account.documents.azure.com:443/;AccountKey=your-key;
```

Option 2 - Managed Identity (Production Recommended):
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

**Optional - Evaluation Trigger:**
```
AI_SCORING_ENDPOINT=https://your-api.com/api/utils/evaluate
```

---
## 3. Deployment

### Azure CLI

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

### VS Code Extension

1. Install Azure Functions extension
2. Open this folder in VS Code
3. Use Command Palette: "Azure Functions: Deploy to Function App"

### GitHub Actions (CI/CD)

Add the provided workflow file to `.github/workflows/` in your repository.

---
## 4. Local Development

1. Install Azure Functions Core Tools
2. Install Python dependencies: `pip install -r requirements.txt`
3. Configure `local.settings.json` with your Cosmos DB details
4. Run locally: `func start`

---
## 5. Monitoring

- View execution logs in Azure Portal > Function App > Functions > auto_submit_expired_assessments
- Monitor with Application Insights for detailed telemetry
- Set up alerts for failed executions

---
## 6. Security Best Practices

1. **Use Managed Identity** in production instead of connection strings
2. **Store secrets** in Azure Key Vault, not environment variables
3. **Enable Application Insights** for monitoring and debugging
4. **Configure appropriate RBAC** permissions for Cosmos DB access
5. **Use private endpoints** for Cosmos DB connectivity in production

---
## 7. Cosmos DB Permissions

The function requires the following permissions on the Cosmos DB account:
- Read access to the `submissions` container
- Write access to update submission documents

For Managed Identity, assign the "Cosmos DB Built-in Data Contributor" role.

---
## 8. Schedule Configuration

Current schedule: Every 5 minutes (`0 */5 * * * *`)

To modify the schedule, update the CRON expression in `function_app.py`:
- Every minute: `0 * * * * *`
- Every 10 minutes: `0 */10 * * * *`
- Every hour: `0 0 * * * *`

---
## 9. Error Handling

The function includes comprehensive error handling:
- Individual submission failures don't stop the batch
- Detailed logging for troubleshooting
- Cosmos DB connection retries (built into SDK)

---
## 10. Performance Considerations
| Concern           | Approach                                                  |
| ----------------- | --------------------------------------------------------- |
| Idempotence       | Status check prior to update; safe re-runs                |
| Partition Fan-out | Cross-partition query limited to candidate expired window |
| RU Efficiency     | Narrow projection (id, assessment_id, expiration fields)  |
| Timeouts          | Function timeout < 10m; batches segmented if large        |
| Large Scale       | Consider continuation tokens + shorter cadence            |

---
## 11. Future Enhancements
| Area             | Idea                                                                   |
| ---------------- | ---------------------------------------------------------------------- |
| Queue decoupling | Push evaluation jobs to a durable queue (Storage Queue / Service Bus)  |
| Metrics          | Emit custom metrics (expired_found, finalized_count) to App Insights   |
| Jitter           | Add minor schedule jitter to distribute RU if multiple functions scale |
| Partial Failures | Dead-letter storage for repeated transient failures                    |

---
## 12. License
MIT (root `LICENSE`).

- Function timeout set to 10 minutes
- Cross-partition queries enabled for flexibility
- Batch processing of expired submissions
- Minimal memory footprint for cost efficiency
