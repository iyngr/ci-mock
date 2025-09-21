# Backend API Summary (single-file)

This file lists the main backend API endpoints in this repository and the expected minimal request/response shapes. It's intended as a quick reference for local testing and integrations.

Base URL (default used by smoke tests): http://localhost:8002

---

## Root & Platform

- GET /
  - Response: { "message": "AI Technical Assessment Platform API", "version": "1.0.0" }
- GET /health
  - Response: { "status": "healthy", "database": "connected|disconnected" }
- GET /metrics
  - Response: service metrics and container statistics (may return 503 if DB not configured)

## RAG (mounted under /api/rag)

- POST /api/rag/ask
  - Request: { "question": "string", "context_limit": int (optional), "similarity_threshold": float (optional), "skill": "string" (optional) }
  - Response: RAGQueryResponse: { "success": bool, "answer": str|null, "context_documents": [ ... ], "source_count": int, "confidence_score": float|null }

- POST /api/rag/knowledge-base/update
  - Request: { "content": "text", "content_type": "text|pdf|url", "skill": "string", "metadata": {} }
  - Response: { "success": bool, "knowledge_entry_id": "id", "embedding_generated": bool }

- GET /api/rag/knowledge-base/search?query=...&limit=5
  - Response: { "success": bool, "results": [ {"id","content","skill"}... ], "request_charge": float }

- GET /api/rag/health
  - Response: { "status": "healthy", "timestamp": "...", "services": {...} }

## Scoring (mounted under /api/scoring)

- POST /api/scoring/dev/create-mock-submission
  - Dev helper: creates a mock assessment + submission
  - Response: { "success": true, "submission_id": "sub_x", "assessment_id": "assess_x" }

- POST /api/scoring/triage
  - Request: { "submissionId": "sub_x" }
  - Response: ScoringTriageResponse: { "submissionId": "...", "totalScore": float, "maxPossibleScore": float, "percentageScore": float, "mcqResults": [...], "llmResults": [...] }

- POST /api/scoring/validate-mcq
  - Request: MCQ validation payload, returns MCQScoreResult

- GET /api/scoring/dev/evaluations/{submission_id}
  - Response: { "evaluations": [...], "submission": {...} }

- GET /api/scoring/dev/rag-queries?limit=N
  - Dev helper: returns recent telemetry documents written to primary DB container `RAG_QUERIES`.

## Utils (mounted under /api/utils)

- POST /api/utils/run-code
  - Request: CodeExecutionRequest (from models) - typically includes submissionId, questionId, language, code, stdin
  - Response: execution result (mock or Judge0 result) { "success": bool, "output": str, "error": str|null, "executionTime": float }

- POST /api/utils/code-runs
  - Request: { "submissionId": "...", "questionId": "...", "language": "python", "code": "...", "stdin": null }
  - Response: { "runId": "...", "success": bool, "output": str|null, "error": str|null, "executionTime": float }

- POST /api/utils/code-runs/finalize
  - Request: { "submissionId": "...", "questionId": "...", "runId": "...", "isFinal": true }
  - Response: { "success": true }

## Candidate (mounted under /api/candidate)

- POST /api/candidate/assessment/start
  - Start assessment request (requires candidate token in Authorization header in real flows)

- GET /api/candidate/assessment/{submission_id}/questions
- POST /api/candidate/assessment/{submission_id}/submit

Auth: candidate routes expect a Bearer token header in development (mock tokens supported).

## Admin (mounted under /api/admin)

- POST /api/admin/login
  - Dev login returns a mock token: { "success": true, "token": "mock_jwt_<user>_<hash>", ... }

- GET /api/admin/dashboard
- POST /api/admin/assessments/create
- Many admin utilities for questions / tests / reports.

## Interview & Live Interview

- /api/interview endpoints: session creation, interview plan, ephemeral realtime keys, code proxy, finalize transcript
- /api/live-interview endpoints: realtime orchestration, guardrails, code submission, finalize

---

Notes
- Many endpoints are dev-friendly and will run without a Cosmos DB configured. Some ops that need persistence will return 503 when the DB isn't configured.
- For telemetry/RU checks, use the `RAG_QUERIES` dev endpoint to inspect saved telemetry documents.
