# Setting Up Judge0 CE in Azure Functions

To host the open-source Judge0 Community Edition (CE) as a separate service in an Azure Function (avoiding the Judge0 API's 50-execution limit), follow these steps. This uses Judge0 CE's Docker-based deployment, which is ideal for Azure Functions' custom container support. Note: This requires an Azure subscription and may incur costs (e.g., for Function App runtime and storage).

## Prerequisites
- Azure CLI installed (`az` command).
- Docker installed locally.
- Git for cloning the repo.
- Basic knowledge of Azure Functions and containers.

## Step 1: Obtain and Prepare Judge0 CE
1. Clone the Judge0 CE repository:
   ```bash
   git clone https://github.com/judge0/judge0.git
   cd judge0
   ```

2. Build the Docker image locally (use the provided Dockerfile in the repo):
   ```bash
   docker build -t judge0-ce .
   ```

3. Test the image locally (optional, to verify):
   ```bash
   docker run -p 2358:2358 judge0-ce
   # Access at http://localhost:2358
   ```

## Step 2: Deploy to Azure Container Registry (ACR)
1. Create an ACR instance:
   ```bash
   az acr create --resource-group <your-resource-group> --name <your-acr-name> --sku Basic
   ```

2. Log in to ACR:
   ```bash
   az acr login --name <your-acr-name>
   ```

3. Tag and push the Docker image:
   ```bash
   docker tag judge0-ce <your-acr-name>.azurecr.io/judge0-ce:v1
   docker push <your-acr-name>.azurecr.io/judge0-ce:v1
   ```

## Step 3: Create Azure Function App with Custom Container
1. Create a Function App (use Linux for container support):
   ```bash
   az functionapp create --resource-group <your-resource-group> --name <your-function-app-name> --storage-account <your-storage-account> --functions-version 4 --runtime custom --os-type Linux --image <your-acr-name>.azurecr.io/judge0-ce:v1
   ```

2. Configure environment variables (e.g., for Judge0 settings like supported languages):
   ```bash
   az functionapp config appsettings set --name <your-function-app-name> --resource-group <your-resource-group> --settings JUDGE0_CE_LANGUAGES="c,cpp,python" JUDGE0_CE_TIMEOUT=5
   ```
   - Adjust based on Judge0 CE docs for supported env vars.

3. Enable authentication if needed (e.g., via Azure AD or API keys) for security:
   ```bash
   az functionapp auth set --name <your-function-app-name> --resource-group <your-resource-group> --enabled true
   ```

## Step 4: Integrate with Your Backend
- Update `backend/routers/utils.py` to call your Azure Function instead of the Judge0 API.
- Example modification (replace the Judge0 API call):

  ```python
  # filepath: backend/routers/utils.py
  import httpx

  # ...existing code...

  @router.post("/run-code")
  async def run_code(request: CodeExecutionRequest):
      # Replace with your Azure Function URL
      azure_function_url = "https://<your-function-app-name>.azurewebsites.net/api/submissions"
      
      payload = {
          "source_code": request.code,
          "language_id": request.language_id,  # Map to Judge0 CE language IDs
          "stdin": request.input or "",
      }
      
      async with httpx.AsyncClient() as client:
          response = await client.post(azure_function_url, json=payload)
          if response.status_code == 200:
              return response.json()
          else:
              raise HTTPException(status_code=500, detail="Code execution failed")
      
      # ...existing code...
  ```

- Ensure the payload matches Judge0 CE's API format (refer to its docs).
- Update environment variables in `backend/.env` to point to the new URL.

## Azure Best Practices
- **Security**: Use Azure Key Vault for secrets (e.g., API keys). Enable HTTPS and consider IP restrictions.
- **Scaling**: Set up auto-scaling for the Function App to handle load.
- **Monitoring**: Enable Application Insights for logs and performance.
- **Costs**: Monitor usage; Function Apps have free tiers but can scale up.
- **Compliance**: Ensure data handling complies with Azure's policies (e.g., for code execution).

If you encounter issues, check Azure Function logs via the portal or CLI (`az functionapp logs`). For more details, refer to the [Judge0 CE GitHub repo](https://github.com/judge0/judge0) and [Azure Functions docs](https://docs.microsoft.com/en-us/azure/azure-functions/). Let me know if you need code for specific parts!

## Judge0 — Reliability, Normalization, and Safety

### Submission Policy

**Best practices for reliable code execution:**

1. **Normalize languages to Judge0 IDs at the backend** (never trust client)
   - Map client language names to standardized Judge0 language IDs server-side
   - Validate language support before submission
   - Reject unsupported languages early with clear error messages

2. **Enforce strict limits and reject early with clear messages:**
   - **Max source size**: Limit code length (e.g., 10KB)
   - **Max execution time**: Set reasonable timeout (e.g., 5-10 seconds)
   - **Max memory usage**: Prevent memory exhaustion
   - **Max stdout size**: Limit output to prevent abuse

3. **Prefer polling with backoff unless you've set up webhooks**
   - Implement exponential backoff for polling
   - Cap polling at N seconds (e.g., 30 seconds)
   - Report "Inconclusive" gracefully for timeouts
   - Consider webhook setup for production workloads

### Normalization (Standard Response Format)

**Standardized Judge0 response structure for consistent handling:**

```json
{
  "status": "Accepted|Wrong Answer|Runtime Error|Compilation Error|In Queue|Processing",
  "stdout": "base64 or utf-8",
  "stderr": "base64 or utf-8", 
  "time": "float-seconds",
  "memory": "int-kb"
}
```

**Response handling recommendations:**
- Always check `status` field first
- Handle base64 encoded outputs appropriately
- Normalize time/memory units across different language runtimes
- Provide meaningful error messages for each status type

### Safety

**Critical security considerations:**

1. **Output Sanitization**
   - **Never echo back raw stderr to candidates without sanitizing** (XSS risk)
   - Always render outputs in `<pre>` tags with proper HTML escaping
   - Strip or sanitize any potentially malicious content
   - Consider content filtering for inappropriate output

2. **Sandbox Security**
   - **Ensure no network access** from the execution sandbox
   - If Judge0 instance permits file operations:
     - Restrict file size limits
     - Restrict file count limits
     - Disable file system write access where possible
   - Monitor for resource abuse attempts

3. **Additional Security Measures**
   - Implement rate limiting per user/session
   - Log all execution attempts for security monitoring
   - Use separate Judge0 instances for different security tiers
   - Regular security updates and patching of Judge0 containers

**Example secure output handling:**
```python
import html
import base64

def sanitize_output(output: str, is_base64: bool = False) -> str:
    """Safely sanitize Judge0 output for display"""
    if is_base64:
        try:
            output = base64.b64decode(output).decode('utf-8')
        except:
            return "Invalid output encoding"
    
    # HTML escape to prevent XSS
    sanitized = html.escape(output)
    
    # Additional filtering if needed
    # sanitized = filter_inappropriate_content(sanitized)
    
    return sanitized
```
