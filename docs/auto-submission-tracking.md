# Auto-Submission Tracking

## Overview

Added comprehensive tracking for when assessments are automatically submitted due to proctoring violations.

## Backend Model Changes

### Submission Model
Added the following fields to track auto-submission events:

```python
# Proctoring violation tracking
auto_submitted: bool = Field(default=False, alias="autoSubmitted", description="Whether test was auto-submitted due to violations")
violation_count: int = Field(default=0, alias="violationCount", description="Total number of proctoring violations")
auto_submit_reason: Optional[str] = Field(None, alias="autoSubmitReason", description="Reason for auto-submission (e.g., 'exceeded_violation_limit', 'suspicious_activity')")
auto_submit_timestamp: Optional[datetime] = Field(None, alias="autoSubmitTimestamp", description="When auto-submission occurred")
```

### SubmissionRequest Model
Updated to include the same fields for frontend-to-backend communication.

## Frontend Integration

The frontend now automatically detects when a submission is triggered by violations and includes tracking data:

```typescript
// Determine if this is an auto-submission due to violations
const isAutoSubmitted = violationCount >= 3
const currentTimestamp = new Date().toISOString()

// Include in submission request
{
  answers: mappedAnswers,
  proctoringEvents: mappedEvents,
  autoSubmitted: isAutoSubmitted,
  violationCount: violationCount,
  autoSubmitReason: isAutoSubmitted ? "exceeded_violation_limit" : null,
  autoSubmitTimestamp: isAutoSubmitted ? currentTimestamp : null
}
```

## Analytics Benefits

This tracking enables administrators to:

1. **Identify violation patterns**: See which assessments had high violation counts
2. **Track auto-submission rates**: Monitor how often tests are terminated early
3. **Analyze security effectiveness**: Understand proctoring system performance
4. **Generate compliance reports**: Document assessment integrity measures
5. **Improve proctoring rules**: Adjust violation thresholds based on data

## Usage Examples

### Query auto-submitted assessments:
```python
auto_submitted_tests = submissions.find({"autoSubmitted": True})
```

### Get violation statistics:
```python
high_violation_tests = submissions.find({"violationCount": {"$gte": 2}})
```

### Track submission reasons:
```python
security_terminated = submissions.find({"autoSubmitReason": "exceeded_violation_limit"})
```

## Auto-Submit Reasons

Currently supported reasons:
- `"exceeded_violation_limit"`: Standard 3-violation rule triggered
- Future extensions: `"suspicious_activity"`, `"time_anomaly"`, `"multiple_devices"`
