# Functional Test Checklist

This document captures the functional testing status for the assessment platform. It lists completed validations, pending validations (the "big ticket" items), acceptance criteria and suggested test steps/tools. As items are completed, mark them with an emoji (✅ for done, 🟩 for in-progress, ⬜ for not started, ❌ for blocked). Add additional notes and a date/author for each status change.

---

## Summary (current snapshot)

Completed (mark with ✅ when verified):

- ✅ Admin Dashboard — validated
- ✅ Single Question Addition — validated (includes enrichment parity)
- ✅ Bulk Question Addition with duplicate validation — validated (dedupe/hashes verified)
- ✅ Initiate Test — validated (compatibility alias, auto-create assessment + submission confirmed)
- ✅ Reports — validated (report generation and persistence)

Note: The items above were validated against Cosmos DB and Azure OpenAI integrations where applicable. Logs and DB documents inspected to confirm persistence and expected fields.

Pending / In-progress (mark with emoji when state changes):

- ⬜ Candidate Assessment (End-to-End) — big-ticket validation
- ⬜ Scoring Email Communications — not implemented yet (pipeline + email)
- ✅ Instructions page — validated
- ⬜ Success page after submission — static page, validate content and link back to records
- ⬜ Microsoft Entra Auth — migration from mock JWT to Entra
- ⬜ Remove Mock JWTs and enable Managed Identities for backend (and front-end where applicable)

The sections below expand these items into concrete test plans, acceptance criteria, and recommended tools.

---

## Completed Tests: Details and Acceptance Evidence

1) Admin Dashboard

- Acceptance criteria:
  - Admin login with authorized account works.
  - Dashboard shows correct counts for assessments and submissions matching DB counts.
  - Drill-down links to submission/assessment details return the correct, normalized objects.
  - Error states (no results, malformed items) are handled gracefully in UI.

- Evidence: manual inspection and sample queries against `submissions` and `assessments` containers; API responses normalized using `_normalize_submission` helper; dashboards fetched recent entries and counts matched DB queries.

2) Single Question Addition (including enrichment parity)

- Acceptance criteria:
  - Adding a single question triggers validation and optional enrichment.
  - The question persisted in `questions` container contains `normalized_text` and `question_hash`.
  - Enrichment (embedding + metadata) completes for both single and bulk paths and produces equivalent fields when requested synchronously.

- Evidence: DB entries show normalized_text, question_hash, enrichment_status; embeddings and metadata persisted (or scheduled for background enrichment when async mode used).

3) Bulk Question Addition with duplicate validation

- Acceptance criteria:
  - CSV/JSON bulk uploads create a persisted `bulk_upload_sessions` entry with validated rows and `question_hash` values.
  - During confirm-import, duplicates (same `question_hash`) are not inserted again into `questions` container.
  - ETag optimistic locking prevents two concurrent confirm operations on the same session.

- Evidence: inspection of `bulk_upload_sessions` documents, confirm run logs, and `questions` container entries showing only unique `question_hash` inserted.

4) Initiate Test (compatibility alias)

- Acceptance criteria:
  - Old client payload shapes accepted by `/api/admin/tests` alias; missing `assessment_id` leads to safe auto-creation if role/duration provided.
  - A `submission` is created with `assessment_id` referencing the created assessment.
  - Response provides an access code and test id for the candidate.

- Evidence: server logs and DB documents created (assessment and submission entries); UI shows Access Code and test metadata.

5) Reports

- Acceptance criteria:
  - Evaluation results are written to `evaluations` container with correct `submission_id` partition key.
  - Admin Reports page reads aggregated metrics and per-submission evaluations.

- Evidence: evaluation docs present in DB and reports UI showing expected metrics.

---

## Pending Validations: Comprehensive Checklist

Each pending item below contains: background, concrete acceptance criteria, test steps, recommended tools, suggested owner (role), priority, and notes/risks.

### 1) Candidate Assessment — End-to-End (Big Ticket)

Background
: This is the primary user-facing flow. It must be validated end-to-end: a candidate uses an access code or link, completes tasks (including coding questions that may call Judge0 or code execution), submits answers, and receives a confirmation; the backend persists the submission, code execution logs, evaluations, and final scores.

Acceptance Criteria
:
- Candidate can start a test using the access code returned by `initiate_test`.
- Submission document lifecycle (status) progresses through: `reserved`/`created` → `started` → `in_progress` → `submitted` → `scored`/`completed`.
- Each code execution initiated by candidate produces a `code_executions` document with `submission_id` partition key and timestamps; Judge0 (or configured executor) returns results linked to the code_execution document.
- Evaluations are created (AI rubrics/automated scoring) and stored in `evaluations` container with the correct `submission_id` partition.
- Final score is written to the submission's `overall_score` and `status` becomes `completed`.
- Client receives a success page and a stable link to view results (if allowed).
- Candidate can recover from intermittent network issues: when the client refreshes or reconnects, the current submission state is reflected accurately.

Test Steps
:
1. Create an assessment and a submission (or reuse one from compatibility alias).
2. Use a browser automation tool (Playwright) to simulate candidate actions:
   - Enter access code, start test; measure start timestamp in submission doc.
   - Execute simple code sample and submit (simulate Judge0 response or use a test Judge0 instance).
   - Submit final answers.
3. Verify in DB: code_executions entries, evaluation entries, submission status transitions and final `overall_score`.
4. Repeat the above under intermittent network conditions (use network throttling or simulate disconnects) and confirm resume behavior.

Tools
:
- Playwright (preferred) or Selenium for browser automation
- httpx/pytest for backend assertions
- Local Judge0 or mocked execution service to avoid cost/latency

Owner
: Product QA + Backend engineer

Priority
: P0 — this must pass before production rollout

Notes / Risks
:
- Scoring pipeline depends on Azure OpenAI / LLM-agent — mock if Blue-Green or cost-limited.
- Judge0 concurrency may cause queueing; ensure the candidate flow handles pending executions gracefully.

---

### 2) Scoring Email Communications

Background
: The platform should notify responsible parties (candidate and/or hiring manager) when scoring is complete. Emailing is not implemented yet; needs pipeline and templates.

Acceptance Criteria
:
- On completion of scoring, an email is generated and delivered to the configured recipient(s).
- Email content must include candidate name/email, assessment name, overall score, and link to detail (if allowed).
- The email sending flow should be reliable and idempotent for the same scoring event.

Test Steps
:
1. Configure a test SMTP endpoint (MailHog, Ethereal, or SendGrid sandbox).
2. Trigger a scoring event (manually or via full candidate flow) and verify an email is sent.
3. Simulate transient failures in email service and confirm the retry/backoff logic or DLQ behavior works.

Tools
:
- MailHog / Ethereal for test SMTP capturing
- Or use SendGrid sandbox for staged environments

Owner
: Backend engineer + DevOps

Priority
: P0/P1 depending on whether email is required for go-live

Notes / Risks
:
- If email is not required for go-live, document and plan a follow-up implementation sprint.

---

### 3) Success Page After Submission

Background
: The success page is a mostly static page shown after candidate submits; validate content and ability to link to submission record where allowed.

Acceptance Criteria
:
- After final submit, redirect to a stable success page.
- The success page should not reveal sensitive scoring information unless allowed.
- If the platform offers a "view results" link, it should require correct authorization.

Test Steps
:
- From the candidate E2E test, confirm redirection to success page and that the page content is correct.
- Validate that viewing the results page requires auth when necessary.

Tools
:
- Playwright + backend assertions

Owner
: Frontend + Backend

Priority
: P2

---

### 4) Microsoft Entra Authentication

Background
: Replace mock JWTs with Microsoft Entra (Azure AD) integration for both FE (authentication) and BE (authorization) where applicable.

Acceptance Criteria
:
- Authentication flow for admin and candidate uses Microsoft Entra; tokens are validated server-side.
- No mock-JWT endpoints accept requests in production staging.
- Roles and scopes are enforced (admins vs candidates vs proctors).
- Backend uses managed identity (DefaultAzureCredential) to access Cosmos and other resources in production.

Test Steps
:
1. Configure a test Entra tenant.
2. Update the FE to use MSAL for signin flows; obtain an access token for API calls.
3. Call protected endpoints with no token, expired token, and valid token to validate responses (401/403/200).
4. For managed identity: deploy a staging function and verify the service can access Cosmos with DefaultAzureCredential.

Tools
:
- MSAL (front-end), Postman for manual token tests, automated integration test harness.

Owner
: Security + Backend + Frontend

Priority
: P0

Notes / Risks
:
- Entra setup and tenant permissions are admin tasks; schedule early to avoid delays.

---

### 5) Remove Mock JWTs & Replace with Managed Identities for BE/FE

Background
: Related to Entra: remove hard-coded or mocked JWT verification and require real tokens. Ensure backend calls to Azure (Cosmos, Key Vault) use managed identities instead of account keys.

Acceptance Criteria
:
- No code paths accept mock tokens in production environment.
- Backend configuration uses DefaultAzureCredential (or equivalent) in production; secrets removed from source and moved to Key Vault.

Test Steps
:
- Run tests against staging with production-like configuration: tokens should be validated against Entra.
- Test managed identity by deploying to a Function App/VM with assigned identity and verifying Cosmos reads/writes.

Tools
:
- Azure Portal, Managed Identity test env, unit tests for token validation.

Owner
: Security / DevOps

Priority
: P0

---

### 6) Tenant / Multi-Tenant Isolation

Background
: Ensure no cross-tenant or cross-admin data leakage—partition keys and RBAC must be enforced.

Acceptance Criteria
:
- Admin A cannot read or modify Admin B's sessions or submissions unless permitted.
- Partition keys (assessment_id, created_by) are enforced in DB reads/writes; code uses point reads when possible to avoid scans.

Test Steps
:
- Create records under two different tenant/admin users; attempt cross-reads and expect 403/empty results.
- Run cross-partition queries and ensure results are scoped and authorized.

Tools
:
- Integration tests and Postman

Owner
: Backend

Priority
: P1

---

### 7) Concurrency & ETag / Optimistic Concurrency

Background
: Bulk confirm import, submission updates, and other flows can be updated concurrently. ETag semantics should prevent lost updates or double imports.

Acceptance Criteria
:
- Concurrent confirm-import requests produce at most one successful import; others receive 409/412 or appropriate error.
- Simultaneous candidate updates on a submission are serialized or rejected with clear error indicating stale update.

Test Steps
:
- Use pytest with async httpx clients to issue 5 simultaneous confirm-import requests for the same bulk session; assert one success and others fail gracefully.
- Simulate two clients updating the same submission with the same ETag and confirm the second receives a 412 or explicit concurrency error.

Tools
:
- pytest + httpx, concurrency scripts

Owner
: Backend

Priority
: P0

---

### 8) Data Retention / TTL & Cleanup Validation

Background
: Ensure code_executions (already TTL'd) and other ephemeral artifacts conform to retention; validate cleanup job (daily cleanup) works.

Acceptance Criteria
:
- Code executions are removed after TTL (verify document-level TTL behavior).
- Reserved submissions expire and become `expired` after cleanup run; archived assessments removed or marked as expected.

Test Steps
:
- Create a code_execution doc with TTL set; confirm it auto-deletes as expected.
- Create reserved submissions with `expires_at` in the past and run the cleanup function locally; verify status updates.

Tools
:
- Local Cosmos emulator or test DB, function host start for cleanup, integration tests.

Owner
: Backend

Priority
: P1

---

### 9) External Integrations Resilience (Azure OpenAI, Judge0, other third-parties)

Background
: The AI and code-execution services are external and transient. The platform must behave well under failures (backoff, retries, informative errors).

Acceptance Criteria
:
- If Azure OpenAI or Judge0 are unavailable, admin flows abort safely without creating inconsistent DB state.
- Critical paths log failures and return actionable errors to admin users.
- Non-critical operations (background enrichment) are retried asynchronously and do not block UI flows.

Test Steps
:
- Use fault injection (mocking or network tooling) to simulate 500s/timeouts from OpenAI and Judge0.
- Verify validation stage fails fast and does not persist questionable data; confirm confirm-import can retry later.
- Verify background enrichment retries and that failed tasks are logged to a DLQ.

Tools
:
- toxiproxy, HTTP mock servers, integration tests with injected faults

Owner
: Backend

Priority
: P0/P1 depending on risk tolerance

---

### 10) Observability & Alerts

Background
: Ensure App Insights or equivalent captures traces, exceptions, and metrics for key flows so Ops can detect and troubleshoot.

Acceptance Criteria
:
- Request traces for candidate submission show full call chain with request ids.
- Errors and exceptions are logged and surfaced to monitoring.
- Alerts configured: high error rate, function failure spike, RU throttling alerts from Cosmos.

Test Steps
:
- Force an error and verify a trace/exception shows up in App Insights.
- Configure a sample alert and test triggering.

Tools
:
- Azure Monitor / Application Insights

Owner
: DevOps

Priority
: P1

---

### 11) Load & Performance

Background
: Validate system under realistic load (candidate concurrency, judge0 execution volume, admin bulk imports).

Acceptance Criteria
:
- Candidate concurrency up to target (TBD) does not cause systemic failure.
- Cosmos RU consumption remains within budget; autoscale triggers if configured.

Test Steps
:
- Stress test candidate starts and code executions using k6 or Locust.
- Measure latencies and Cosmos RU usage, check for throttling and backoff.

Tools
:
- k6, Locust, load scripts

Owner
: Performance / Backend

Priority
: P1

---

### 12) Backup & Restore / Disaster Recovery

Background
: Verify you can recover databases (assessments, submissions, questions) from backups.

Acceptance Criteria
:
- A test restore of a subset of data is possible and links remain intact.
- Restore process documented.

Test Steps
:
- Export a subset (or use Point-in-time Restore) and re-import to a staging DB, validate links and IDs.

Tools
:
- Azure Cosmos backup/restore tools or export/import scripts

Owner
: Ops

Priority
: P2

---

### 13) Security Posture (Secrets, RBAC, Network)

Background
: Validate secrets are in Key Vault, RBAC least privilege, and network access uses private endpoints.

Acceptance Criteria
:
- Secrets are not in repo; Key Vault used for production secrets.
- Managed identity roles assigned to service principals.
- Cosmos has firewall and private endpoint in production.

Test Steps
:
- Review repo and environment for secrets leaks.
- Test access to Cosmos with rotated keys.

Tools
:
- Azure Portal, key vault, automated secret scanning

Owner
: Security

Priority
: P0

---

### 14) UX Failure Modes / Recovery

Background
: Ensure the client UX gracefully handles failures (network drops, mid-submission), and recovery flows are documented.

Acceptance Criteria
:
- Candidate can resume a test after page refresh; saved progress is preserved.
- Partial submits do not create duplicate submissions.

Test Steps
:
- Simulate disconnect/reconnect; attempt to resume.
- Force a submission failure and verify no duplicate final submissions.

Tools
:
- Playwright, network throttling

Owner
: Frontend + Backend

Priority
: P1

---

### 15) Data Correctness Tests (Dedupe, Enrichment Parity)

Background
: Ensure dedupe logic and enrichment pipeline produce correct canonical data.

Acceptance Criteria
:
- question_hash dedupe avoids duplicates in both single and bulk flows.
- Enrichment (background vs sync) ends up with same key fields for the same question text.

Test Steps
:
- Unit tests for normalization and hashing functions.
- Integration test that runs the same question through single-add (sync) and bulk-import (async) and compares persisted enriched fields.

Tools
:
- pytest, small integration harness with a mocked AI

Owner
: Backend

Priority
: P1

---

## Quick wins and immediate actions

1. Implement an automated Playwright E2E that runs Candidate Assessment happy path in CI (use mocks for Judge0/OpenAI to keep cost low).
2. Add a concurrency pytest for confirm-import (5 concurrent requests; assert only one successful import).
3. Add small smoke tests for cleanup job (run locally with `CLEANUP_ASSESSMENT_AGE_DAYS=0`).
4. Add one Entra integration test for a protected endpoint to show token validation end-to-end.

## Suggested Owners / Working Groups

- Backend: E2E candidate flow logic, concurrency, DB invariants, cleanup, external resilience
- Frontend: candidate UI UX, success page, recovery flows
- Security/DevOps: Entra, Key Vault, Managed Identity, backups, alerts
- QA/Automation: Playwright and pytest test suites, CI integration

## How to mark items as done

- Edit this file and replace the emoji next to the item, add a one-line note with date and name; for example:

  `- ✅ Candidate Assessment (End-to-End) — validated by QA team (2025-09-26) - Playwright E2E passed.`

- Optionally, link to the test run log, PR, or ticket that proves completion.

---

## Appendix: Example Playwright candidate test outline (copyable)

This is a small script outline to create a Playwright test for the candidate assessment flow.

1) Setup: configure `NEXT_PUBLIC_API_URL` to point to your local backend and point FE to local dev server.
2) Test flow:
```ts
import { test, expect } from '@playwright/test';

test('candidate full flow', async ({ page }) => {
  // go to landing
  await page.goto('/candidate');
  // enter access code
  await page.fill('#access-code-input', 'test-access-code');
  await page.click('#start-test');
  // wait for editor or question to appear
  await page.waitForSelector('.question-card');
  // run through a simple code execution flow
  await page.fill('.monaco-editor textarea', 'print(1+1)');
  await page.click('#run-code');
  // assert execution output appears
  await page.waitForSelector('.execution-result');
  // submit
  await page.click('#submit-test');
  // expect success page
  await expect(page).toHaveURL(/success/);
});
```

Notes: adapt selectors to your FE.

---

If you want I can:
- Add the Playwright skeleton tests to the repo (choose path and I will create the files),
- Add the concurrency pytest and wire it into the `tests/` suite,
- Add a one-off script to run the cleanup function locally for quick verification.

Which of these should I start next?

---

## Migration note: Azure OpenAI - move from Chat Completions to Responses API

Background:
: Microsoft has introduced a new Responses API for Azure OpenAI which consolidates chat, completions and tooling into a single, richer API surface. The new Responses API provides a unified schema, multimodal support, and different primitives for streaming and structured outputs. Migrating from the legacy Chat Completions endpoint (or the /v1/chat/completions style) to the Responses API can improve reliability and unlock new features. See Microsoft's documentation for details:

- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key

Acceptance Criteria:
:
- All existing calls to Azure OpenAI that currently use Chat Completions are identified and cataloged.
- Replace Chat Completions client calls with the Responses client per the Microsoft guide, ensuring parameter parity (system/instructions, messages, temperature, top_p, max_tokens where applicable).
- Streaming behavior (if used) is supported using the Responses streaming primitives.
- The new API is validated end-to-end for: prompt formatting, output parsing, error handling (quota/429/backoff), and cost implications.
- Tests assert that generated evaluation texts, structured response parsing, and any scoring rubrics behave equivalently (or better) after migration.

Test Steps:
:
1. Inventory: run a code search for chat completions usage (e.g., "chat.completions" or older client calls) and list all call sites.
2. Replace one call site with the Responses API following the Microsoft migration guide and test locally using a real Azure OpenAI key or the test key.
3. Validate output shape: ensure any downstream parsers (e.g., expecting JSON blobs, assistant messages) still work or update parsers to the new response schema.
4. Test streaming flows (if any) and ensure client-side streaming handlers are compatible with the new responses streaming events.
5. Run regression tests for evaluation generation (rubric-based scoring) comparing a sample set of prompts to known outputs; assert parity or acceptable change.
6. Load-test the new client behavior to observe latency and cost; update retry/backoff policies as needed.

Tools:
:
- Microsoft docs & SDK examples (link above)
- Unit tests + integration harness with sample prompts
- Local canary against a small test key to compare outputs

Owner:
:
- Backend (LLM integration owner) + SRE/DevOps for observing cost/latency

Priority:
:
- P1 — recommended to plan migration but may be staggered by feature and cost considerations

Notes / Risks:
:
- Response schema differences may require parser updates, especially where you previously relied on a very specific chat-completions message structure.
- Streaming semantics and partial response events differ; if your code uses streaming, test carefully.
- Cost and RU (or token) differences should be monitored during rollout.

Autogen changes — support Responses API
:
Background
:
 - If you use Microsoft Autogen (agent orchestration) or similar tooling that previously assumed Chat Completions semantics, you will need to update your Autogen configuration or agents to call the Responses API. Autogen supports multiple agent types; you can either use the built-in Assistant Agent configured to call Responses, or implement a custom Agent that explicitly calls the Responses API and adapts event/stream handling.

Acceptance Criteria
:
 - Autogen agents (Assistant Agent or custom Agent) are updated to use the Responses API for model interactions.
 - Agent behaviors (tool use, message formatting, step-by-step actions) remain correct and tests for agent flows pass.
 - Streaming and tool invocation semantics are compatible with Responses streaming primitives if streaming is used.

Test Steps
:
 1. Identify all Autogen/agent codepaths that produce prompts or call the LLM. Search for Autogen agent instantiation and the code that configures the model client.
 2. Configure an Assistant Agent using Autogen examples to point at the Responses API endpoint or implement a custom Agent per Autogen's custom agent guide.
 3. Run agent integration tests for common flows (report generation, rubric scoring, tool invocation) and verify outputs are valid and stable.
 4. If streaming is used, test the new Responses streaming events and update the agent event handlers accordingly.

Tools and References
:
 - Autogen Agent docs and tutorial: https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/agents.html
 - Azure Responses API docs: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key

Owner
:
 - LLM integration owner + Backend engineers working on Autogen flows

Priority
:
 - P1 — schedule into the Responses migration plan; Autogen flows are critical to scoring and report generation so test early.

Notes / Risks
:
 - Autogen's higher-level abstractions may hide differences in response envelopes; unit tests for agent message parsing must be updated.
 - Tools triggered by agents (e.g., call judge0 or knowledge retrievers) must be validated end-to-end after agent migration.
