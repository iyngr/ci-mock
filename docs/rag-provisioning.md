# RAG (Vector) Cosmos DB Provisioning Guide

This document explains how to provision a vector-enabled Azure Cosmos DB account and create a KnowledgeBase container for retrieval-augmented generation (RAG).

Important: RAG workloads must be run against a separate serverless/vector-enabled Cosmos account to avoid RU contention with transactional data.

## Key decisions

- Use a serverless Cosmos account with vector search capability (available in supported regions).
- Create a dedicated database (e.g., `ci-rag-database`) and a `KnowledgeBase` container with vector indexing enabled.
- Ensure the embedding dimension (for example, 1024 or 1536) matches the chosen embedding model (the Azure OpenAI embedding deployment).

## Indexing policy and vector path

Cosmos vector search expects a document property with the vector. Typical document shape:

```json
{
  "id": "doc-1",
  "content": "...text to embed...",
  "embedding": [0.123, -0.234, ...],
  "metadata": {"source":"import","created_at":"..."}
}
```

Common choices:
- Vector path: `/embedding`
- Partition key: `/id` or `/metadata/source` (choose based on retrieval scale and write patterns)

## Embedding dimension and distance

Match the embedding dimension to the embedding model:
- text-embedding-3-small / text-embedding-3-large: dimensions vary (check Azure OpenAI docs)
- If you use Azure OpenAI text embedding models, verify their vector dimension and set the container index accordingly.

Distance function: cosine is commonly used.

## RU sizing and cost guidance

- Serverless accounts reduce management overhead but have per-request cost implications. Test with a dataset representative of expected query volume.
- Provisioned RU accounts allow explicit RU allocation if you need predictable throughput.

## Azure CLI example (minimal)

```powershell
# Create resource group
az group create -n rg-llm -l eastus

# Create serverless Cosmos account (illustrative)
az cosmosdb create -n my-rag-cosmos -g rg-llm --capabilities EnableServerless

# Create database and container (minimal)
az cosmosdb sql database create -a my-rag-cosmos -g rg-llm -n ci-rag-database
az cosmosdb sql container create -a my-rag-cosmos -g rg-llm -d ci-rag-database -n KnowledgeBase --partition-key-path "/id"
```

## Bicep sample (vector container placeholder)

Below is a simplified Bicep snippet. You'll need to adapt it to include vector indexing options supported by your Cosmos API and any preview features your subscription requires.

```bicep
param location string = resourceGroup().location
param accountName string
param databaseName string = 'ci-rag-database'
param containerName string = 'KnowledgeBase'

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2021-04-15' = {
  name: accountName
  location: location
  kind: 'MongoDB' // or GlobalDocumentDB depending on API
  properties: {
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
  }
}

// Create database and container resources here; vector index specifics may require API preview flags.
```

## Ingestion notes

- Normalize text and metadata before storing embeddings.
- Batch embed documents to reduce API overhead.
- Persist both the raw document and its embedding vector in the KnowledgeBase container.

## Verification

After provisioning, test a simple vector search using your chosen SDK (e.g., `azure-cosmos` with vector search APIs or LangChain AzureCosmosDBNoSqlVectorSearch) and confirm:

- The embedding dimension matches
- Queries return sensible nearest neighbors

## Troubleshooting

- BadRequest during container creation: likely the account doesn't support vector indexing. Ensure you've created a serverless/vector-enabled account in a supported region.
- Dimension mismatch: re-create the container or adjust your embedding model choice.

---

If you want, I can generate a concrete container JSON index policy for a known embedding model (tell me the embedding model name/deployment), or I can produce a full Bicep/ARM template tuned to your environment.