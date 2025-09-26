# Smart Screen (Single-Container)

A self-contained FastAPI app that serves a static SPA for AI-powered resume screening and a secure API endpoint protected by Azure Entra ID. It calls Azure OpenAI with JSON-only outputs and keeps everything in one deployable Docker image.

## Features
- Static front-end (HTML/CSS/JS) served by FastAPI
- PDF parsing via PyMuPDF (fitz)
- Azure Entra ID (JWT) validation via JWKS
- Azure OpenAI Chat Completions with `response_format: json_object`
- Single Dockerfile for Azure Container Apps

## Required Environment Variables
Set these before running locally or in your container:

- AZURE_OPENAI_ENDPOINT (e.g., https://your-aoai.openai.azure.com)
- AZURE_OPENAI_API_KEY
- AZURE_OPENAI_DEPLOYMENT_NAME (e.g., gpt-5-mini)
- AZURE_OPENAI_API_VERSION (default: 2024-09-01-preview)
- AZURE_ENTRA_TENANT_ID
- AZURE_ENTRA_API_AUDIENCE (Application ID URI, e.g., api://smartscreen)

## Local Run (PowerShell)
```powershell
$env:AZURE_OPENAI_ENDPOINT="https://your-aoai.openai.azure.com";
$env:AZURE_OPENAI_API_KEY="<key>";
$env:AZURE_OPENAI_DEPLOYMENT_NAME="gpt-5-mini";
$env:AZURE_OPENAI_API_VERSION="2024-09-01-preview";
$env:AZURE_ENTRA_TENANT_ID="<tenant-guid>";
$env:AZURE_ENTRA_API_AUDIENCE="api://smartscreen";

python -m pip install -r requirements.txt;
uvicorn main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000.

Note: The API requires a valid Bearer token from Entra ID. Place it in localStorage under key `msal_token` or adjust `static/script.js` to acquire with MSAL.

## Docker
### Build
```powershell
cd smartscreen;
docker build -t smartscreen:local .
```

### Run
```powershell
# pass env vars; replace values accordingly
$env:AZURE_OPENAI_ENDPOINT="https://your-aoai.openai.azure.com";
$env:AZURE_OPENAI_API_KEY="<key>";
$env:AZURE_OPENAI_DEPLOYMENT_NAME="gpt-5-mini";
$env:AZURE_OPENAI_API_VERSION="2024-09-01-preview";
$env:AZURE_ENTRA_TENANT_ID="<tenant-guid>";
$env:AZURE_ENTRA_API_AUDIENCE="api://smartscreen";

docker run -it --rm -p 8000:8000 `
  -e AZURE_OPENAI_ENDPOINT=$env:AZURE_OPENAI_ENDPOINT `
  -e AZURE_OPENAI_API_KEY=$env:AZURE_OPENAI_API_KEY `
  -e AZURE_OPENAI_DEPLOYMENT_NAME=$env:AZURE_OPENAI_DEPLOYMENT_NAME `
  -e AZURE_OPENAI_API_VERSION=$env:AZURE_OPENAI_API_VERSION `
  -e AZURE_ENTRA_TENANT_ID=$env:AZURE_ENTRA_TENANT_ID `
  -e AZURE_ENTRA_API_AUDIENCE=$env:AZURE_ENTRA_API_AUDIENCE `
  smartscreen:local
```

Open http://localhost:8000.

## API
- GET `/` -> serves the SPA
- GET `/static/*` -> static assets
- GET `/api/config` -> public, non-secret config (tenantId, audience)
- POST `/api/screen-resume` -> multipart form-data: `file` (PDF), `mode` (auto|customized), optional `role`, `domain`, `skills` (CSV up to 5)
  - Requires Authorization: Bearer <token>
  - Returns JSON: `{ summary: string[], recommendation: string }`
- GET `/health` -> health check

## Notes
- If you need client-side token acquisition, wire up MSAL using GET `/api/config` for tenant and audience.
- The service truncates extracted text to ~15k characters to control tokens.
- Keep PDF sizes modest; very large PDFs will take longer to parse.
