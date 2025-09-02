# Server-Authoritative Assessment System - Test Script

This script tests the new server-authoritative assessment timing system end-to-end.

## Setup

1. Ensure backend is running: `cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
2. Ensure frontend is running: `cd frontend && pnpm dev`
3. Run this test script to validate the new functionality

## Test Cases

### Test 1: Start Assessment Endpoint

```bash
# Test the new start assessment endpoint
curl -X POST http://localhost:8000/api/candidate/assessment/start \
  -H "Content-Type: application/json" \
  -d '{
    "assessment_id": "test1",
    "candidate_id": "candidate@example.com"
  }'

# Expected Response:
# {
#   "submission_id": "abc123def456",
#   "expiration_time": "2025-09-02T16:30:00.123456",
#   "duration_minutes": 120
# }
```

### Test 2: Submit Assessment with Submission ID

```bash
# Test the new submission endpoint (replace submission_id with actual value from Test 1)
curl -X POST http://localhost:8000/api/candidate/assessment/submit \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "abc123def456",
    "answers": [
      {
        "question_id": "q1",
        "question_type": "mcq",
        "answer": 1,
        "time_spent": 60
      }
    ],
    "proctoring_events": []
  }'

# Expected Response:
# {
#   "success": true,
#   "resultId": "xyz789",
#   "submissionId": "abc123def456",
#   "message": "Assessment submitted successfully"
# }
```

### Test 3: Frontend Flow Test

1. Open browser to `http://localhost:3001/candidate`
2. Enter login code: `TEST123`
3. Proceed to instructions page
4. Click "I Understand - Start Assessment"
5. Verify that:
   - Network tab shows call to `/api/candidate/assessment/start`
   - localStorage contains `submissionId`, `expirationTime`, and `durationMinutes`
   - Assessment page loads with server-calculated timer
6. Complete assessment and submit
7. Verify submission uses `/api/candidate/assessment/submit` with `submission_id`

### Test 4: Timer Accuracy Test

```javascript
// Run in browser console on assessment page
// Check that timer matches server expiration time
const expirationTime = localStorage.getItem('expirationTime');
const serverExpiry = new Date(expirationTime);
const now = new Date();
const serverTimeLeft = Math.max(0, Math.floor((serverExpiry.getTime() - now.getTime()) / 1000));

console.log('Server time left (seconds):', serverTimeLeft);
console.log('UI timer value:', /* check displayed timer */);
// These should match within a few seconds
```

### Test 5: Expired Submission Test

```bash
# Test submitting an expired assessment
# First, create a submission with past expiration time (modify backend temporarily)
# Then try to submit:

curl -X POST http://localhost:8000/api/candidate/assessment/submit \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "expired_submission_id",
    "answers": [],
    "proctoring_events": []
  }'

# Expected Response:
# HTTP 400 Bad Request
# {
#   "detail": "Assessment has expired"
# }
```

### Test 6: Azure Function Mock Test

```python
# Test the auto-submit logic locally
# Create a mock submission in the backend and test the query logic

import datetime
from backend.models import Submission

# Mock expired submission
expired_submission = {
    "id": "test_expired",
    "test_id": "test1",
    "candidate_email": "test@example.com",
    "start_time": datetime.datetime.utcnow() - datetime.timedelta(hours=3),
    "expiration_time": datetime.datetime.utcnow() - datetime.timedelta(hours=1),
    "status": "in-progress",
    "answers": [],
    "proctoring_events": []
}

# The Azure Function should identify this as expired and update status to "completed_auto_submitted"
```

## Validation Checklist

- [ ] Start assessment endpoint creates submission with correct expiration time
- [ ] Frontend receives and stores submission data correctly
- [ ] Assessment timer counts down to server expiration time
- [ ] Submit endpoint uses submission_id instead of test_id
- [ ] Expired submissions are rejected by submit endpoint
- [ ] Auto-submit Azure Function identifies expired submissions
- [ ] LocalStorage is cleaned up after successful submission
- [ ] Error handling works for network failures
- [ ] Timer synchronization works across browser refreshes
- [ ] Multiple concurrent sessions don't interfere

## Performance Testing

### Load Test: Concurrent Assessments

```bash
# Use Apache Bench to test concurrent assessment starts
ab -n 100 -c 10 -T 'application/json' -p start_assessment_payload.json \
  http://localhost:8000/api/candidate/assessment/start
```

### Database Query Performance

```sql
-- Test the Azure Function query performance
-- This query should be efficient with proper indexing

SELECT * FROM submissions 
WHERE status = 'in-progress' 
AND expiration_time < @current_time

-- Ensure proper indexes exist:
-- - Composite index on (status, expiration_time)
-- - TTL index for automatic cleanup of old documents
```

## Troubleshooting Guide

### Common Issues

1. **"No submission ID found" error**
   - Check localStorage in browser dev tools
   - Verify start assessment endpoint was called successfully
   - Ensure no typos in localStorage key names

2. **Timer showing incorrect time**
   - Verify server and client time synchronization
   - Check timezone handling in date calculations
   - Validate expiration_time format in localStorage

3. **Azure Function not finding expired submissions**
   - Check Cosmos DB connection and permissions
   - Verify query syntax and parameters
   - Review function execution logs

4. **Assessment expires immediately**
   - Check duration calculation in start endpoint
   - Verify timezone handling in datetime operations
   - Ensure mock data has reasonable duration values

### Debug Commands

```bash
# Check backend logs for API errors
tail -f backend.log

# Inspect localStorage in browser
console.log(localStorage.getItem('submissionId'));
console.log(localStorage.getItem('expirationTime'));

# Test Azure Function locally
func start --python
```

## Success Criteria

The refactoring is successful when:

1. All assessment timing is controlled by the server
2. Frontend cannot manipulate assessment duration
3. Expired sessions are automatically handled
4. System maintains security and integrity
5. Performance is acceptable under load
6. User experience remains smooth and intuitive

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Run integration tests with real Azure services
3. Conduct user acceptance testing
4. Plan production migration strategy
5. Set up monitoring and alerting
6. Create operational runbooks
