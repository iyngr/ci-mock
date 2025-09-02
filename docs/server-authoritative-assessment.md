# Server-Authoritative Assessment System Documentation

## Overview

This document describes the refactored assessment timing system that has been migrated from client-side control to a robust, server-authoritative implementation. The new system ensures assessment security and integrity by managing session lifecycle on the backend.

## Architecture Changes

### Before (Client-Side)
- Frontend managed assessment duration and timing
- Timer countdown handled in browser JavaScript
- Vulnerable to client-side manipulation
- No server-side validation of session expiry

### After (Server-Authoritative)
- Backend creates and owns assessment sessions
- Server calculates and enforces expiration times
- Frontend displays countdown to server-provided expiration
- Azure Function handles auto-submission of expired sessions

## System Components

### 1. Backend API (FastAPI)

#### New Models

**Submission Model** (`backend/models.py`)
```python
class Submission(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    test_id: str
    candidate_email: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    expiration_time: datetime
    status: str = "in-progress"  # "in-progress", "completed", "completed_auto_submitted"
    answers: List[Answer] = []
    proctoring_events: List[ProctoringEvent] = []
    submitted_at: Optional[datetime] = None
```

#### New API Endpoints

**Start Assessment**
- **Endpoint**: `POST /api/candidate/assessment/start`
- **Purpose**: Creates a new assessment session with server-controlled timing
- **Request**: 
  ```json
  {
    "assessment_id": "test1",
    "candidate_id": "candidate@example.com"
  }
  ```
- **Response**: 
  ```json
  {
    "submission_id": "abc123def456",
    "expiration_time": "2025-09-02T14:30:00Z",
    "duration_minutes": 120
  }
  ```

**Submit Assessment**
- **Endpoint**: `POST /api/candidate/assessment/submit`
- **Purpose**: Updates existing submission with final answers
- **Request**: 
  ```json
  {
    "submission_id": "abc123def456",
    "answers": [...],
    "proctoring_events": [...]
  }
  ```

### 2. Frontend Changes (Next.js)

#### Instructions Page (`frontend/src/app/candidate/instructions/page.tsx`)
- Calls `/api/candidate/assessment/start` when candidate clicks "Start Assessment"
- Stores `submissionId`, `expirationTime`, and `durationMinutes` in localStorage
- Handles loading state during assessment initialization

#### Assessment Page (`frontend/src/app/candidate/assessment/page.tsx`)
- Retrieves expiration time from localStorage on load
- Calculates remaining time based on server-provided expiration
- Timer counts down to absolute expiration time, not relative duration
- Uses `submissionId` for final submission instead of `testId`

### 3. Auto-Submit Azure Function

#### Function Details
- **Trigger**: Timer trigger (every 5 minutes: `0 */5 * * * *`)
- **Purpose**: Auto-submit assessments that have expired but not been submitted
- **Database Query**: Finds submissions where `status = "in-progress"` and `expiration_time < current_time`
- **Action**: Updates status to `"completed_auto_submitted"`

#### Security Features
- Uses managed identity for secure database access
- Logs all auto-submission activities
- Optionally triggers AI scoring for auto-submitted assessments

## Data Flow

### Assessment Start Flow
1. Candidate completes instructions and clicks "Start Assessment"
2. Frontend calls `POST /api/candidate/assessment/start`
3. Backend:
   - Fetches assessment details (duration)
   - Records server start time
   - Calculates expiration time (start_time + duration)
   - Creates Submission document with "in-progress" status
   - Returns submissionId and expirationTime
4. Frontend stores session data and navigates to assessment
5. Assessment page initializes timer based on server expiration time

### Assessment Submission Flow
1. Candidate completes assessment and clicks submit
2. Frontend calls `POST /api/candidate/assessment/submit` with submissionId
3. Backend:
   - Validates submission exists and hasn't expired
   - Updates submission with answers and proctoring events
   - Changes status to "completed"
   - Records submission timestamp
4. Frontend redirects to success page

### Auto-Submit Flow
1. Azure Function runs every 5 minutes
2. Queries for submissions where `status = "in-progress"` AND `expiration_time < now()`
3. For each expired submission:
   - Updates status to "completed_auto_submitted"
   - Records auto-submission timestamp
   - Optionally triggers AI scoring

## Security Benefits

1. **Tamper Resistance**: Assessment duration cannot be modified client-side
2. **Server Validation**: All timing decisions made by trusted server
3. **Automatic Cleanup**: Abandoned sessions are automatically closed
4. **Audit Trail**: Complete record of session start, end, and auto-submissions
5. **Time Synchronization**: Uses server time for all calculations

## Environment Configuration

### Backend Environment Variables
```env
DATABASE_URL=mongodb://localhost:27017/assessment
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-judge0-key
```

### Azure Function Environment Variables
```env
COSMOS_DB_CONNECTION_STRING=AccountEndpoint=https://...
COSMOS_DB_ENDPOINT=https://your-cosmos.documents.azure.com:443/
COSMOS_DB_NAME=assessment-db
AI_SCORING_ENDPOINT=https://your-api.com/api/utils/evaluate
```

## Deployment

### Backend Deployment
1. Deploy FastAPI application to Azure App Service or Container Apps
2. Configure environment variables
3. Ensure Cosmos DB connection

### Azure Function Deployment
1. Deploy function app using Azure CLI or VS Code extension
2. Configure managed identity for Cosmos DB access
3. Set environment variables in Azure portal
4. Monitor function execution logs

### Frontend Deployment
1. Build Next.js application: `pnpm build`
2. Deploy to Vercel, Azure Static Web Apps, or Azure App Service
3. Configure `NEXT_PUBLIC_API_URL` environment variable

## Testing

### Unit Tests
- Test backend endpoints with mock data
- Validate timer calculations in frontend
- Test Azure Function with sample expired submissions

### Integration Tests
- End-to-end assessment flow
- Auto-submission scenarios
- Time expiration edge cases

### Load Testing
- Concurrent assessment sessions
- Azure Function performance under load
- Database query optimization

## Monitoring and Alerts

### Backend Monitoring
- API response times and error rates
- Database connection health
- Assessment submission success rates

### Azure Function Monitoring
- Function execution frequency and duration
- Auto-submission counts and success rates
- Database query performance

### Frontend Monitoring
- Timer accuracy and synchronization
- Submission success rates
- User experience metrics

## Migration Strategy

### Phase 1: Backward Compatibility
- Keep legacy `/api/candidate/submit` endpoint
- Support both old and new assessment flows
- Monitor usage patterns

### Phase 2: Full Migration
- Update all frontend flows to use new endpoints
- Deprecate legacy endpoints
- Migrate existing in-progress assessments

### Phase 3: Cleanup
- Remove legacy code and endpoints
- Optimize database queries
- Performance tuning

## Troubleshooting

### Common Issues

1. **Timer Desynchronization**
   - Ensure server and client clocks are synchronized
   - Implement periodic time sync checks

2. **Auto-Submit Not Working**
   - Check Azure Function execution logs
   - Verify Cosmos DB permissions
   - Review CRON expression syntax

3. **Assessment Expiry Errors**
   - Validate expiration time calculations
   - Check timezone handling
   - Monitor system clock drift

### Debug Steps

1. Check backend logs for API errors
2. Verify localStorage data in browser dev tools
3. Monitor Azure Function execution in Azure portal
4. Query Cosmos DB directly to verify data consistency
