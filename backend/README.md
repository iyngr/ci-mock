# AI Technical Assessment Platform - Backend

## Overview

FastAPI backend for the AI-powered technical assessment platform, now powered by Azure Cosmos DB NoSQL API.

## Architecture

- **Framework**: FastAPI with async/await support
- **Database**: Azure Cosmos DB NoSQL API
- **Authentication**: Azure Active Directory with DefaultAzureCredential
- **Code Execution**: Judge0 API integration
- **AI Evaluation**: Azure OpenAI integration

## Environment Configuration

### Required Environment Variables

```bash
# Azure Cosmos DB Configuration
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
DATABASE_NAME=assessment_platform

# Azure Authentication (Optional - DefaultAzureCredential handles this)
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id

# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-openai-key

# Judge0 Configuration
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-judge0-key
USE_JUDGE0=true

# Application Settings
ENVIRONMENT=development
```

### Azure Cosmos DB Setup

1. **Create Cosmos DB Account**:
   - Choose "Azure Cosmos DB for NoSQL" (not MongoDB API)
   - Enable automatic failover and multi-region writes if needed

2. **Database and Containers**:
   The application automatically creates the following containers with optimized partition keys:
   
   | Container | Partition Key | Purpose |
   |-----------|---------------|---------|
   | `assessments` | `/id` | Assessment templates |
   | `submissions` | `/assessment_id` | Candidate submissions |
   | `users` | `/role` | Admin and candidate users |
   | `questions` | `/type` | Question bank |
   | `code_executions` | `/language` | Code execution logs |
   | `evaluations` | `/submission_id` | AI evaluation results |

3. **Authentication**:
   - Uses Azure Active Directory with DefaultAzureCredential
   - Supports managed identity in Azure environments
   - Falls back to environment variables or Azure CLI credentials

## Installation

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

## Database Schema

### Cosmos DB Data Models

All models inherit from `CosmosDocument` base class which includes:
- `id`: Document identifier (maps to `_id` for compatibility)
- `_etag`: Optimistic concurrency control
- `_ts`: Cosmos DB timestamp
- `partition_key`: Computed property for efficient partitioning

### Key Features

- **Polymorphic Questions**: Uses Pydantic discriminated unions for MCQ, Descriptive, and Coding questions
- **Field Aliasing**: Frontend-backend compatibility with proper field mapping
- **Partition Strategy**: Optimized partition keys for query performance
- **Request Charge Monitoring**: Automatic RU consumption tracking

## API Endpoints

### Admin Routes (`/api/admin`)
- `POST /login` - Admin authentication
- `GET /dashboard` - Dashboard statistics
- `POST /tests` - Initiate new assessment
- `GET /submissions` - All candidate submissions
- `GET /assessments` - Assessment templates
- `GET /candidates` - Candidate analytics

### Candidate Routes (`/api/candidate`)
- `POST /login` - Candidate login with code
- `POST /assessment/start` - Start assessment session
- `GET /assessment/{id}/questions` - Get assessment questions
- `GET /submissions/history` - Personal submission history

### Utils Routes (`/api/utils`)
- `POST /run-code` - Execute code with Judge0
- `POST /evaluate` - AI-powered evaluation

## Database Operations

### CRUD Operations

The `CosmosDBService` class provides MongoDB-style operations:

```python
# Create
await db.create_item("assessments", assessment_data, partition_key="role")

# Read
item = await db.read_item("assessments", item_id, partition_key)

# Update
await db.update_item("assessments", item_id, update_data, partition_key)

# Delete
await db.delete_item("assessments", item_id, partition_key)

# Query with SQL
results = await db.query_items("assessments", 
    "SELECT * FROM c WHERE c.target_role = @role",
    [{"name": "@role", "value": "python-backend"}])
```

### Error Handling & Retry Logic

- **Automatic Retries**: Exponential backoff for transient errors (429, 503, 408)
- **Request Charge Monitoring**: Tracks RU consumption for optimization
- **Throttling Handling**: Respects retry-after headers for rate limiting
- **Connection Resilience**: Graceful degradation when database unavailable

## Performance Optimization

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

### Query Optimization

#### Partition Key Strategy
- **Assessments**: `/id` - Direct point reads by assessment ID
- **Submissions**: `/assessment_id` - Group submissions by assessment
- **Users**: `/role` - Separate admin/candidate data
- **Questions**: `/type` - Optimize by question type queries
- **Code Executions**: `/language` - Group by programming language
- **Evaluations**: `/submission_id` - Link evaluations to submissions

#### Efficient Queries
```python
# Good: Uses partition key
query = "SELECT * FROM c WHERE c.assessment_id = @assessment_id"

# Better: Specific field selection
query = "SELECT c.id, c.status FROM c WHERE c.assessment_id = @assessment_id"

# Best: With proper indexing
query = "SELECT c.id FROM c WHERE c.assessment_id = @assessment_id AND c.status = @status"
```

### RU Monitoring & Optimization

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

#### Bulk Operations
```python
# Use bulk operations for better efficiency
results = await db.bulk_create_items("assessments", items_list, batch_size=100)
```

### Best Practices

1. **Single Client Instance**: One CosmosClient per application lifecycle
2. **Optimal Partition Keys**: Design for query patterns, not just distribution
3. **Field Selection**: Use `SELECT c.field1, c.field2` instead of `SELECT *`
4. **Pagination**: Use `OFFSET/LIMIT` for large result sets
5. **Batch Operations**: Group multiple operations when possible
6. **Monitor RU Consumption**: Use `/metrics` endpoint for optimization
7. **Connection Pooling**: Configure appropriate connection limits
8. **Regional Proximity**: Set preferred locations nearest to users

### Troubleshooting Performance

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

### Best Practices Implemented

1. **Single Client Instance**: One CosmosClient per application lifetime
2. **Efficient Partition Keys**: Optimized for query patterns
3. **Request Charge Monitoring**: RU consumption tracking and logging
4. **Retry Logic**: Automatic handling of transient failures
5. **Query Optimization**: SQL queries optimized for minimal RU usage

### Monitoring

- Request charges logged at DEBUG level
- Container creation logged at INFO level
- Errors logged with full context
- Retry attempts tracked with delays

## Migration from MongoDB

This backend has been migrated from Motor/MongoDB to Azure Cosmos DB NoSQL API:

### Key Changes

1. **Dependencies**: 
   - ❌ `motor>=3.7.1` 
   - ✅ `azure-cosmos` + `azure-identity`

2. **Connection**:
   - ❌ MongoDB connection strings
   - ✅ Azure Cosmos DB endpoints with AAD auth

3. **Query Language**:
   - ❌ MongoDB query syntax
   - ✅ SQL API queries

4. **Operations**:
   - ❌ `collection.find()`, `collection.insert_one()`
   - ✅ `container.query_items()`, `container.create_item()`

### Compatibility Layer

The `CosmosDBService` provides compatibility methods:
- `find_one()` - MongoDB-style single document queries
- `find_many()` - MongoDB-style multi-document queries
- `count_items()` - Document counting with filters

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

## Deployment

### Azure App Service

1. Set environment variables in App Service configuration
2. Enable managed identity
3. Grant Cosmos DB permissions to managed identity
4. Deploy with `uv` for dependency management

### Container Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install uv
RUN uv install

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

## Security

- **Authentication**: Azure AD with managed identity support
- **Authorization**: Role-based access control
- **Data Protection**: TLS encryption in transit
- **Secrets Management**: Azure Key Vault integration recommended
- **CORS**: Configured for specific frontend origins

## Contributing

1. Follow FastAPI and Pydantic best practices
2. Maintain compatibility with frontend models
3. Add proper error handling and logging
4. Write tests for new functionality
5. Update documentation for API changes
