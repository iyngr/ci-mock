# Azure Function Deployment Configuration

## Prerequisites

- Azure CLI installed and authenticated
- Azure Functions Core Tools v4.x
- Python 3.9+ (Azure Functions v2 Python runtime)

## Manual Deployment Steps

### 1. Create Azure Resources

```bash
# Set variables
RESOURCE_GROUP="rg-assessment-platform"
LOCATION="East US"
STORAGE_ACCOUNT="saassessmentplatform"
FUNCTION_APP_NAME="func-assessment-autosubmit"
COSMOS_ACCOUNT_NAME="cosmos-assessment-db"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account (required for Functions)
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create Cosmos DB account
az cosmosdb create \
  --name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --default-consistency-level Session \
  --locations regionName=$LOCATION

# Create Cosmos DB database and containers
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --name assessment-db

az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --database-name assessment-db \
  --name submissions \
  --partition-key-path "/test_id" \
  --throughput 400

# Create Function App
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime python \
  --runtime-version 3.9 \
  --functions-version 4 \
  --name $FUNCTION_APP_NAME \
  --storage-account $STORAGE_ACCOUNT \
  --os-type Linux
```

### 2. Configure Managed Identity

```bash
# Enable system-assigned managed identity
az functionapp identity assign \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Get the principal ID
PRINCIPAL_ID=$(az functionapp identity show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId --output tsv)

# Grant Cosmos DB permissions to the managed identity
az cosmosdb sql role assignment create \
  --account-name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --scope "/subscriptions/$(az account show --query id --output tsv)/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.DocumentDB/databaseAccounts/$COSMOS_ACCOUNT_NAME" \
  --principal-id $PRINCIPAL_ID \
  --role-definition-id "00000000-0000-0000-0000-000000000002"  # Cosmos DB Built-in Data Contributor
```

### 3. Configure Application Settings

```bash
# Get Cosmos DB endpoint
COSMOS_ENDPOINT=$(az cosmosdb show \
  --name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --query documentEndpoint --output tsv)

# Set application settings
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_DB_ENDPOINT=$COSMOS_ENDPOINT" \
    "COSMOS_DB_NAME=assessment-db" \
    "AI_SCORING_ENDPOINT=https://your-backend-api.azurewebsites.net/api/utils/evaluate"
```

### 4. Deploy Function Code

```bash
# Navigate to function directory
cd azure-functions

# Install dependencies locally (for packaging)
pip install -r requirements.txt

# Deploy to Azure
func azure functionapp publish $FUNCTION_APP_NAME
```

## Automated Deployment with GitHub Actions

See `.github/workflows/deploy-azure-function.yml` for automated deployment configuration.

## Monitoring and Logging

### Enable Application Insights

```bash
# Create Application Insights resource
az monitor app-insights component create \
  --app $FUNCTION_APP_NAME-insights \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Get instrumentation key
INSIGHTS_KEY=$(az monitor app-insights component show \
  --app $FUNCTION_APP_NAME-insights \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey --output tsv)

# Configure Function App to use Application Insights
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings "APPINSIGHTS_INSTRUMENTATIONKEY=$INSIGHTS_KEY"
```

### View Logs

```bash
# Stream live logs
az functionapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Query logs with KQL
az monitor log-analytics query \
  --workspace $WORKSPACE_ID \
  --analytics-query "
    FunctionAppLogs
    | where FunctionName == 'auto_submit_expired_assessments'
    | order by TimeGenerated desc
    | take 50
  "
```

## Scaling and Performance

### Configure Scaling

```bash
# Set maximum instance count for consumption plan
az functionapp config set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --max-outbound-connections 50
```

### Monitor Performance

- Use Azure Monitor to track function execution metrics
- Set up alerts for failures or long execution times
- Monitor Cosmos DB RU consumption

## Security Best Practices

1. **Use Managed Identity**: Avoid storing connection strings in configuration
2. **Network Security**: Configure VNet integration if required
3. **Key Vault Integration**: Store sensitive configuration in Azure Key Vault
4. **RBAC**: Use minimal required permissions for Cosmos DB access

## Backup and Disaster Recovery

### Cosmos DB Backup

```bash
# Enable point-in-time restore (if not already enabled)
az cosmosdb update \
  --name $COSMOS_ACCOUNT_NAME \
  --resource-group $RESOURCE_GROUP \
  --backup-policy-type Continuous
```

### Function App Backup

- Function code is stored in source control (no additional backup needed)
- Application settings and configuration should be documented
- Use ARM templates for infrastructure as code

## Cost Optimization

1. **Consumption Plan**: Pay only for execution time
2. **Cosmos DB Autoscale**: Automatically adjust throughput
3. **Monitor Usage**: Track RU consumption and function executions
4. **Optimize Queries**: Use efficient Cosmos DB queries to minimize costs

## Troubleshooting

### Common Issues

1. **Function Not Triggering**
   - Check CRON expression syntax
   - Verify Function App is running
   - Review Application Insights logs

2. **Cosmos DB Access Denied**
   - Verify managed identity is configured
   - Check RBAC role assignments
   - Ensure correct endpoint and database name

3. **Performance Issues**
   - Monitor Cosmos DB RU consumption
   - Optimize query patterns
   - Consider partitioning strategy

### Debug Commands

```bash
# Check function status
az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# View recent executions
az functionapp log tail --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

# Test function manually
az functionapp function show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --function-name auto_submit_expired_assessments
```
