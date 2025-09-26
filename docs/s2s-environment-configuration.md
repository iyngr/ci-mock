# S2S Live Interview Environment Variables Configuration

This document outlines all required environment variables for the Speech-to-Speech (S2S) live interview feature across all services.

## Backend Service (FastAPI)

### Azure OpenAI Realtime API (Required for S2S)
```bash
# Azure OpenAI Realtime API Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-4o-mini-realtime-preview  # example for live interview; your realtime deployment may differ
AZURE_OPENAI_REALTIME_API_VERSION=2025-04-01-preview
AZURE_OPENAI_REALTIME_REGION=eastus2
AZURE_OPENAI_REALTIME_VOICE=verse

# Standard Azure OpenAI Configuration (for non-realtime features)
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini  # example for Smart Mock (non-realtime LLM usage)
## AZURE_OPENAI_MODEL removed from recommended config. Provide the Azure deployment name via AZURE_OPENAI_DEPLOYMENT_NAME (example: `gpt-5-mini`).
## Note: GPT-5 family deployments do not accept `temperature`/`top_p` — use `max_completion_tokens` instead of `max_tokens` when configuring request parameters.

### Realtime vs non-realtime deployments
Realtime (speech-to-speech / low-latency interactive) deployments are often different Azure deployment resources than the non-realtime chat/completion models used elsewhere.

- Example: Smart Mock (assessment agent / batch analysis) may use a GPT-5 deployment such as `gpt-5-mini` configured via `AZURE_OPENAI_DEPLOYMENT_NAME`.
- Example: Live Interview (S2S realtime) commonly uses a realtime-enabled deployment such as `gpt-4o-mini-realtime-preview` configured via `AZURE_OPENAI_REALTIME_DEPLOYMENT`.

Ensure you provision and reference the correct deployment name for the scenario you intend to run. The realtime deployment name, API version, and region must match the provisioned realtime model resource.
AZURE_OPENAI_API_VERSION=2024-09-01-preview
```

### Judge0 Configuration (Required for code execution)
```bash
# Judge0 API Configuration
USE_JUDGE0=true
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key-here
```

### Database Configuration
```bash
# Cosmos DB Configuration
COSMOS_DB_CONNECTION_STRING=your-cosmos-connection-string
COSMOS_DB_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
COSMOS_DB_KEY=your-cosmos-key
COSMOS_DB_NAME=your-database-name
```

### Service URLs
```bash
# Internal API base URL for service-to-service communication
INTERNAL_API_BASE=http://localhost:8000

# LLM-agent URL for Judge0 results push
LLM_AGENT_URL=http://localhost:8080
```

## LLM-Agent Service

### Azure OpenAI Configuration (Required for AI analysis)
```bash
# Azure OpenAI Configuration
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini
## AZURE_OPENAI_MODEL removed from recommended config. Provide the Azure deployment name via AZURE_OPENAI_DEPLOYMENT_NAME (example: `gpt-5-mini`).
## Note: GPT-5 family deployments do not accept `temperature`/`top_p` — use `max_completion_tokens` instead of `max_tokens` when configuring request parameters.
AZURE_OPENAI_API_VERSION=2024-09-01-preview
```

### Debug and Development
```bash
# Debug Mode Configuration
DEBUG_MODE=false
CONSOLE_UI_ENABLED=false
```

### Optional Judge0 Configuration (if needed)
```bash
# Judge0 API (optional for LLM-agent)
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-rapidapi-key-here
```

## Auto-Submit Service (Azure Functions)

### Cosmos DB Configuration (Required)
```bash
# Cosmos DB Configuration (choose one option)

# Option 1: Connection String (recommended for development)
COSMOS_DB_CONNECTION_STRING=your-cosmos-connection-string

# Option 2: Managed Identity (recommended for production)
COSMOS_DB_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/

# Option 3: Account Key (fallback)
COSMOS_DB_ENDPOINT=https://your-cosmos-account.documents.azure.com:443/
COSMOS_DB_KEY=your-cosmos-key

# Database name
COSMOS_DB_NAME=your-database-name
```

### AI Scoring Configuration
```bash
# LLM-agent endpoint for S2S scoring
LLM_AGENT_ENDPOINT=http://localhost:8080

# Optional: Legacy AI scoring endpoint
AI_SCORING_ENDPOINT=https://your-backend-api.azurewebsites.net/api/utils/evaluate
```

## Frontend Service (Next.js)

### API Configuration
```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Production Deployment Considerations

### Azure Container Apps Environment Variables
```bash
# Backend Container App
az containerapp update \
  --name backend-app \
  --resource-group your-rg \
  --set-env-vars \
    "AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-key" \
  "AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-5-mini-realtime-preview" \
    "JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com" \
    "JUDGE0_API_KEY=secretref:judge0-key" \
    "COSMOS_DB_CONNECTION_STRING=secretref:cosmos-connection" \
    "LLM_AGENT_URL=https://llm-agent-app.internal"

# LLM-agent Container App
az containerapp update \
  --name llm-agent-app \
  --resource-group your-rg \
  --set-env-vars \
    "AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/" \
    "AZURE_OPENAI_API_KEY=secretref:azure-openai-key" \
  "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5-mini"

# Frontend Container App
az containerapp update \
  --name frontend-app \
  --resource-group your-rg \
  --set-env-vars \
    "NEXT_PUBLIC_API_URL=https://backend-app.your-domain.com"
```

### Azure Functions Environment Variables
```bash
# Auto-submit Function App
az functionapp config appsettings set \
  --name auto-submit-func \
  --resource-group your-rg \
  --settings \
    "COSMOS_DB_ENDPOINT=https://your-cosmos.documents.azure.com:443/" \
    "COSMOS_DB_NAME=your-database-name" \
    "LLM_AGENT_ENDPOINT=https://llm-agent-app.your-domain.com"
```

### Secrets Management (Production)
Store sensitive values in Azure Key Vault:

```bash
# Store secrets in Key Vault
az keyvault secret set --vault-name your-keyvault --name "azure-openai-key" --value "your-api-key"
az keyvault secret set --vault-name your-keyvault --name "judge0-key" --value "your-rapidapi-key"
az keyvault secret set --vault-name your-keyvault --name "cosmos-connection" --value "your-connection-string"

# Reference secrets in Container Apps
--set-env-vars "AZURE_OPENAI_API_KEY=secretref:azure-openai-key"
```

## Validation Checklist

### Pre-deployment Validation
- [ ] Azure OpenAI Realtime API deployment is available in your region
- [ ] Azure OpenAI API key has proper permissions
- [ ] Judge0 RapidAPI subscription is active
- [ ] Cosmos DB account has proper access permissions
- [ ] All service URLs are accessible from each service
- [ ] Firewall rules allow inter-service communication

### Testing Environment Variables
```bash
# Test Azure OpenAI connectivity
curl -H "api-key: $AZURE_OPENAI_API_KEY" \
  "$AZURE_OPENAI_ENDPOINT/openai/deployments/$AZURE_OPENAI_REALTIME_DEPLOYMENT/chat/completions?api-version=$AZURE_OPENAI_REALTIME_API_VERSION"

# Test Judge0 connectivity
curl -H "X-RapidAPI-Key: $JUDGE0_API_KEY" \
  -H "X-RapidAPI-Host: judge0-ce.p.rapidapi.com" \
  "$JUDGE0_API_URL/languages"

# Test Cosmos DB connectivity (from auto-submit function)
# This will be tested during function deployment
```

## Common Issues and Solutions

### Azure OpenAI Realtime API Issues
- **Issue**: "Deployment not found"
  - **Solution**: Ensure realtime deployment is created in correct region (eastus2, westus)
  - **Check**: Deployment name matches AZURE_OPENAI_REALTIME_DEPLOYMENT

### Judge0 API Issues
- **Issue**: Rate limiting or quota exceeded
  - **Solution**: Upgrade RapidAPI subscription or implement request throttling
  - **Check**: Monitor usage in RapidAPI dashboard

### Inter-Service Communication Issues
- **Issue**: Backend cannot reach LLM-agent
  - **Solution**: Verify LLM_AGENT_URL is correct and services can communicate
  - **Check**: Network policies and firewall rules in Azure Container Apps

### Cosmos DB Access Issues
- **Issue**: Auto-submit function cannot access database
  - **Solution**: Verify managed identity permissions or connection string validity
  - **Check**: Azure Function App system-assigned identity has Cosmos DB permissions

## Environment-Specific Configurations

### Development (.env files)
Create `.env` files in each service directory with development values.

### Staging
Use Azure Key Vault references with staging-specific resources.

### Production
Use managed identities where possible, Key Vault for secrets, and production-grade resource configurations.