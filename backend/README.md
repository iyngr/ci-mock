# Backend Service (FastAPI)

Authoritative API layer for assessments, submissions, evaluation orchestration, and RAG retrieval. Implements secure timing, question management, evaluation artifact separation, and integration with a dual Cosmos DB topology (Transactional + Vector).

---
## 1. Stack Overview

| Concern                | Technology                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| Web Framework          | FastAPI (ASGI, Python 3.12)                                       |
| Data Layer             | Azure Cosmos DB (NoSQL API) – primary & serverless vector account |
| Identity (future prod) | Azure AD / Managed Identity (DefaultAzureCredential)              |
| Code Execution         | Judge0 (REST, optional)                                           |
| AI / LLM               | Azure OpenAI (GPT‑4o family) + external LLM Agent service         |
| Packaging              | `uv` (PEP 723 / pyproject)                                        |

Key Design Principles:
1. Server authoritative session lifecycle (prevents client timer tampering)
2. Explicit evaluation artifact externalization (`evaluations` container)
3. Partition key axes optimized per access pattern (assessment / submission / skill)
4. Vector workload isolation (separate serverless account)
5. Minimal selective indexing + TTL for ephemeral telemetry

---
## 2. Environment Configuration

### Required Environment Variables

```bash
## Primary Cosmos DB (Transactional)
COSMOS_DB_ENDPOINT=https://<primary-account>.documents.azure.com:443/
COSMOS_DB_KEY=<local-dev-only-key>
COSMOS_DB_DATABASE=assessment

## Vector / RAG Cosmos DB (optional for KnowledgeBase)
RAG_COSMOS_DB_ENDPOINT=https://<rag-account>.documents.azure.com:443/
RAG_COSMOS_DB_KEY=<rag-key>
RAG_COSMOS_DB_DATABASE=ragdb
RAG_COSMOS_DB_PREFERRED_LOCATIONS=East US

## Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://<aoai>.openai.azure.com/
AZURE_OPENAI_API_KEY=<key>  # (defer MI until pre-deploy)

## LLM Agent (if using proxy microservice)
LLM_AGENT_URL=http://localhost:8001

## Judge0
USE_JUDGE0=true
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=<rapidapi-key>

## Feature Toggles / Misc
USE_RAG_ACCOUNT=true
ENVIRONMENT=development
```

### Cosmos DB Setup (Current Model Summary)
Primary account containers (auto-created if missing):

| Container           | Partition Key  | Notes                                      |
| ------------------- | -------------- | ------------------------------------------ |
| assessments         | /id            | Immutable snapshots per assessment         |
| submissions         | /assessment_id | Session state + compact evaluation summary |
| evaluations         | /submission_id | Full evaluation artifacts (LLM + MCQ)      |
| code_executions     | /submission_id | TTL 30d, Judge0 traces                     |
| users               | /id            | High-cardinality identities                |
| questions           | /skill         | Canonical bank (future)                    |
| generated_questions | /skill         | AI generation cache                        |
| RAGQueries          | /assessment_id | TTL 30d (may live in vector acct)          |

Vector account (manual vector container creation):

| Container     | PK     | Vector Path | Index         | Purpose                    |
| ------------- | ------ | ----------- | ------------- | -------------------------- |
| KnowledgeBase | /skill | /embedding  | quantizedFlat | RAG embeddings (1536 dims) |

> Detailed rationale + roadmap: `../docs/cosmos-data-model-review.md`.

---
## 3. Installation

1. **Install Dependencies**:
   ```bash
   uv install
   ```

2. **Set Environment Variables**:
   Create a `.env` file or set environment variables directly.

3. **Run the Application**:
   ```bash
   uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

---
## 4. Data Model Highlights

* Partition axes: assessment vs submission vs skill (purpose-built locality)
* Evaluation artifact offloading reduces submission doc growth & RU on writes
* Skill normalization (`normalize_skill`) prevents partition fragmentation
* TTL applied selectively for telemetry containers
* Vector workload isolated – no accidental non-vector re-provisioning

---
## 5. API Surface (Representative)

### Admin (`/api/admin`)
| Method | Path                     | Purpose                            |
| ------ | ------------------------ | ---------------------------------- |
| POST   | /login                   | Auth (session/token)               |
| POST   | /tests                   | Create/initiate assessment         |
| GET    | /dashboard               | KPI metrics                        |
| POST   | /questions/add-single    | AI-augmented question enhancement  |
| POST   | /questions/bulk-validate | Bulk validation (semantic + exact) |

### Candidate (`/api/candidate`)
| Method | Path                  | Purpose                             |
| ------ | --------------------- | ----------------------------------- |
| POST   | /login                | Candidate entry                     |
| POST   | /assessment/start     | Start session (authoritative timer) |
| GET    | /assessment/{test_id} | Fetch question snapshot             |
| POST   | /assessment/submit    | Final submission                    |

### Utils / RAG / Scoring
| Method | Path                           | Purpose                          |
| ------ | ------------------------------ | -------------------------------- |
| POST   | /api/utils/run-code            | Judge0 execution wrapper         |
| POST   | /api/utils/evaluate            | Trigger evaluation (LLM + rules) |
| POST   | /api/rag/knowledge-base/update | Ingest or update KB entry        |
| POST   | /api/rag/ask                   | Retrieval + answer synthesis     |

---
## 6. Service Layer (`CosmosDBService`)

Mongo-flavored helpers over Cosmos SQL API:
* `find_one(container, filter_dict)` – cross-partition scan (use sparingly) then targeted PK ops
* `auto_create_item(container, item)` – infers partition key via `constants.COLLECTIONS`
* RU & latency metrics aggregated → `/metrics` endpoint
* Bulk create helper maintains RU efficiency for ingestion bursts

Retry & Resilience:
* Exponential + header-based (429 Retry-After) pacing
* Graceful partial failures (evaluation write separate from submission update)
* Logging of high-RU outliers for tuning

---
## 7. Performance & RU Optimization

### Connection Optimization

The backend implements several performance optimizations:

#### Connection Policy
```python
connection_policy = ConnectionPolicy()
connection_policy.connection_mode = "Gateway"  # or "Direct" for production
connection_policy.request_timeout = 30
connection_policy.retry_options.max_retry_attempt_count = 3
```

#### Preferred Locations
Set `COSMOS_DB_PREFERRED_LOCATIONS` environment variable:
```bash
COSMOS_DB_PREFERRED_LOCATIONS=East US,West US,Central US
```

#### Consistency Level
Configure optimal consistency with `COSMOS_DB_CONSISTENCY_LEVEL`:
- `Session` (default, optimal for most cases)
- `Eventual` (lowest latency)
- `BoundedStaleness` (balanced)
- `Strong` (highest consistency, highest latency)

### Partition Key Recap
| Container                       | PK             | Rationale                                    |
| ------------------------------- | -------------- | -------------------------------------------- |
| submissions                     | /assessment_id | Cohort analytics, batch eval                 |
| evaluations                     | /submission_id | Lineage locality                             |
| code_executions                 | /submission_id | High-churn isolation + TTL                   |
| questions / generated_questions | /skill         | Semantic grouping for RAG & generation cache |
| KnowledgeBase (vector acct)     | /skill         | Skill-scoped similarity slices               |

#### Efficient Queries
```python
# Good: Uses partition key
query = "SELECT * FROM c WHERE c.assessment_id = @assessment_id"

# Better: Specific field selection
query = "SELECT c.id, c.status FROM c WHERE c.assessment_id = @assessment_id"

# Best: With proper indexing
query = "SELECT c.id FROM c WHERE c.assessment_id = @assessment_id AND c.status = @status"
```

### RU Monitoring

#### Request Charge Tracking
```python
# Automatic RU monitoring in all operations
cosmos_metrics.record_operation(request_charge, duration_ms, operation_type)

# High RU operations are automatically logged
# Warning: "High RU operation: query_items consumed 55.2 RU"
```

#### Performance Metrics Endpoint
```bash
# Get current performance metrics
GET /metrics

# Response includes:
{
  "service_metrics": {
    "total_request_charge": 1250.5,
    "operation_count": 42,
    "average_ru_per_operation": 29.8,
    "average_duration_ms": 45.2
  },
  "container_statistics": {
    "assessments": {
      "document_count": 15,
      "partition_key": ["/id"],
      "throughput_type": "Manual"
    }
  }
}
```

### Bulk Ingestion Example
```python
await db.bulk_create_items("generated_questions", items, batch_size=50)
```

### Practical Guidelines
1. Always include partition filter where possible
2. Use `SELECT <fields>` projections (avoid `SELECT *` in hot paths)
3. Monitor RU budget pre-prod; add index exclusions only with evidence
4. Keep vector queries scoped by skill + TOP N
5. Avoid embedding large evaluation artifacts in submissions

---
## 8. Troubleshooting

#### High RU Consumption
- Check partition key distribution
- Optimize queries to use partition keys
- Consider indexing policy adjustments
- Use projection queries (SELECT specific fields)

#### Slow Queries
- Verify partition key usage in WHERE clauses
- Check for cross-partition queries
- Monitor request charges per operation
- Consider query pattern optimization

#### Throttling (429 errors)
- Increase provisioned throughput
- Implement proper retry logic (already included)
- Distribute load across partition keys
- Use autoscale throughput if available

---
## 9. Secure Deployment Notes

Production Guidance:
* Replace key-based auth with system-assigned Managed Identity (MI) & RBAC: `Cosmos DB Built-in Data Contributor`.
* Store secrets (Judge0, fallback keys) in Azure Key Vault + reference in Container App.
* Enable HTTPS-only, restrict CORS origins, and apply rate limiting on vector endpoints if high QPS.
* Monitor `Total Request Units` & `Server Side Latency` per container; alert when RU spikes exceed forecast.

### Monitoring

- Request charges logged at DEBUG level
- Container creation logged at INFO level
- Errors logged with full context
- Retry attempts tracked with delays

---
## 10. Former MongoDB Migration (Historical Context)
Legacy Motor implementation replaced by:
* `azure-cosmos` SDK w/ SQL style queries
* Compatibility helpers intentionally mimic subset of prior API for faster refactor onboarding.

## Development

### Running Tests

```bash
# Install test dependencies
uv add --dev pytest pytest-asyncio httpx

# Run tests
uv run pytest
```

### Code Quality

```bash
# Format code
uv run black .

# Lint code
uv run ruff check .

# Type checking
uv run mypy .
```

---
## 11. Containerization (Example)
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install uv && uv sync --frozen
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Verify COSMOS_DB_ENDPOINT is correct
   - Check Azure credentials (DefaultAzureCredential order)
   - Ensure proper permissions on Cosmos DB account

2. **High Request Charges**:
   - Review query patterns and indexing
   - Optimize partition key usage
   - Monitor RU consumption in logs

3. **Throttling (429 errors)**:
   - Automatic retry logic handles this
   - Consider increasing provisioned throughput
   - Optimize query efficiency

### Logging

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger('azure.cosmos')
logger.setLevel(logging.DEBUG)
```

---
## 12. Security Snapshot
* AAD / Managed Identity planned pre-production
* Key Vault recommended for secrets & embedding model switches
* CORS locked to known frontend origins
* No sensitive evaluation artifacts stored in logs; full details isolated in `evaluations`

---
## 13. Contributing
1. Open issue or small RFC for data model changes
2. Add/adjust tests (pytest + httpx for API) for new endpoints
3. Keep README + `docs/` synchronized (data model doc is source of truth)
4. Prefer incremental feature flags for new evaluation flows
5. Include RU impact notes in PR description if query changes

---
## 14. License
MIT (see repository root `LICENSE`).
