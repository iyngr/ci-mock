# AI Technical Assessment Platform

Unified, extensible assessment platform for coding & conceptual evaluation with:

* Next.js 14 front‑end (App Router, TypeScript, Tailwind, Shadcn/UI, Monaco)
* FastAPI backend (Python 3.12, async) for authoritative session + scoring APIs
* LLM Agent (multi‑agent evaluation & generation using Azure OpenAI)
* Auto‑Submit Azure Function (timer-triggered session finalization)
* Dual Azure Cosmos DB accounts (Transactional + Vector/RAG) with a vector‑indexed Knowledge Base
* Judge0 code execution integration

> For an in‑depth data model rationale see: `docs/cosmos-data-model-review.md` (authoritative partition strategy & vector architecture).

---
## 1. High‑Level Architecture

```mermaid
flowchart LR
  FE[Next.js Frontend] -->|HTTPS /api/*| BE[FastAPI Backend]
  FE -->|LLM assist (optional)| AGENT[LLM Agent Service]
  BE --> COSMOS[(Cosmos DB Transactional)]
  BE -->|Vector/RAG| COSMOS_RAG[(Cosmos DB RAG / Vector)]
  BE --> JUDGE0[Judge0 API]
  AGENT --> AOAI[Azure OpenAI]
  AGENT --> COSMOS
  AUTO[Auto-Submit Azure Function] --> COSMOS
  AUTO --> BE
```

| Service          | Runtime                 | Purpose                                                                 | Key Tech                                                      |
| ---------------- | ----------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Frontend         | Node / Next.js 14       | Candidate + Admin UI, real-time interactions                            | React 19, Tailwind, Shadcn, Monaco                            |
| Backend          | FastAPI (ASGI)          | Authoritative session mgmt, scoring orchestration, RAG, code exec proxy | FastAPI, azure-cosmos, Pydantic v2                            |
| LLM Agent        | FastAPI / AutoGen       | Multi-agent evaluation, question generation, report synthesis           | AutoGen, Azure OpenAI GPT‑4o                                  |
| Auto-Submit      | Azure Functions (Timer) | Periodic session expiry & auto-finalization                             | Python 3.11 Functions v4                                      |
| Cosmos (Primary) | NoSQL Account           | Transactional assessments & telemetry                                   | Partitioned containers (assessment / submission / skill axes) |
| Cosmos (Vector)  | Serverless + Vector     | KnowledgeBase embeddings + optional RAGQueries                          | Vector index (quantizedFlat)                                  |

---
## 2. Core Feature Set

### Candidate
* Secure code-based entry & instructions
* Server-authoritative timing (no client tampering)
* MCQ / Descriptive / Coding question rendering
* Monaco editor + Judge0 execution
* Auto submission on expiry + explicit submission
* Basic proctoring (fullscreen, tab switch tracking)

### Admin
* Authenticated dashboard & KPIs
* Assessment creation / initiation
* AI-assisted question authoring (single + bulk enhancement & semantic dedupe)
* Submission monitoring & detailed report view
* Re-usable question & generated question banks grouped by skill

### AI / Evaluation
* Multi-agent scoring & report synthesis
* RAG retrieval from vector KnowledgeBase (skill-partitioned) – optional
* Evaluation artifact externalization (lightweight submission summary + full `evaluations` container record)

### Operational Integrity
* Timer enforcement (backend + function) — resilient to client manipulation
* TTL on high-churn telemetry containers (`code_executions`, `RAGQueries`)
* Partition-key aligned batch analytics (`submissions` under `/assessment_id`)
* Separate serverless vector account to isolate experimental RAG cost & RU patterns

---
## 3. Data Model (Summary)

Axes: Assessment (`/assessment_id`), Submission (`/submission_id`), Skill (`/skill`).

Primary Account Containers (current):
* `assessments` (/id) – immutable snapshots
* `submissions` (/assessment_id) – candidate sessions ( answers + summary eval )
* `evaluations` (/submission_id) – full evaluation lineage
* `code_executions` (/submission_id, TTL 30d)
* `users` (/id)
* `questions` & `generated_questions` (/skill)
* `RAGQueries` (/assessment_id, TTL 30d) – may alternatively reside in vector account

Vector/RAG Account:
* `KnowledgeBase` (/skill) with vector path `/embedding` (quantizedFlat, 1536‑dim default)
* Optional mirror `RAGQueries` (/assessment_id)

See `docs/cosmos-data-model-review.md` for: justifications, migration log, risk matrix, and partition rationale.

---
## 4. Local Development Quick Start

### Prerequisites
* Node 18+ & PNPM
* Python 3.12 + [uv](https://github.com/astral-sh/uv)
* (Optional) Azure Functions Core Tools (for auto-submit)
* Azure OpenAI key (or planned Managed Identity – enable later)

### Backend
```bash
cd backend
uv sync
cp .env.example .env   # fill Cosmos endpoints / keys (test phase)
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd frontend
pnpm install
pnpm dev
```

### LLM Agent (optional during initial UI dev)
```bash
cd llm-agent
uv sync
cp .env.sample .env
uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## Local development (run all services)

To run the full stack locally (backend + frontend + llm-agent):

1. Start the backend (port 8000):

```powershell
cd backend; uv sync; cp .env.example .env; uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

2. Start the llm-agent (port 8001):

```powershell
cd llm-agent; uv sync; cp .env.sample .env; uv run uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

3. Start the frontend (port 3000):

```powershell
cd frontend; pnpm install; pnpm dev
```

Notes:
- Ensure `COSMOS_DB_*` and optional `RAG_COSMOS_DB_*` env vars are set in the appropriate `.env` files before starting.
- If you need AutoGen Studio for visual tooling, see `llm-agent/README.md` for manual install guidance.


### Auto-Submit Function (local)
```bash
cd auto-submit
pip install -r requirements.txt
func start
```

### Vector / RAG Smoke Test Scripts
```bash
python scripts/cosmos_connectivity.py
python scripts/cosmos_vector_test.py
```

---
## 5. Environment Variables (Condensed)

| Category        | Key (Backend)                                                           | Notes                         |
| --------------- | ----------------------------------------------------------------------- | ----------------------------- |
| Cosmos Primary  | `COSMOS_DB_ENDPOINT`, `COSMOS_DB_KEY`, `COSMOS_DB_DATABASE`             | Key auth for local; MI later  |
| Cosmos Vector   | `RAG_COSMOS_DB_ENDPOINT`, `RAG_COSMOS_DB_KEY`, `RAG_COSMOS_DB_DATABASE` | Optional for RAG features     |
| Azure OpenAI    | `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`                         | Agent & direct embedding      |
| LLM Agent       | `LLM_AGENT_URL`                                                         | Backend proxy to agent if set |
| Judge0          | `JUDGE0_API_URL`, `JUDGE0_API_KEY`, `USE_JUDGE0`                        | Code execution toggle         |
| Feature Toggles | `USE_RAG_ACCOUNT`                                                       | Force fallback if unset       |

Frontend: `NEXT_PUBLIC_API_URL` (points to backend base URL).

LLM Agent adds: `AZURE_OPENAI_DEPLOYMENT_NAME`, `AZURE_OPENAI_MODEL`, trace logging toggles.

Function adds: `COSMOS_DB_ENDPOINT` / `COSMOS_DB_KEY` or MI + `COSMOS_DB_NAME`, `AI_SCORING_ENDPOINT`.

---
## 6. RAG & Vector Search

* Vector account created separately (serverless) with feature flag (KnowledgeBase required manual vector container creation).
* Vector index: `quantizedFlat` on `/embedding` (1536 dims, cosine) – migratable to `diskANN` at scale (>50k vectors / physical partition).
* Query pattern enforced: `SELECT TOP N ... WHERE c.skill = @skill ORDER BY VectorDistance(...)` to bound RU.
* Isolation limits RU blast radius and cost; can later promote to provisioned throughput if stable high QPS.

---
## 7. Server-Authoritative Session Lifecycle

Flow:
1. Admin initiates test; backend stamps allowed duration.
2. Candidate starts session → backend creates submission w/ expiration.
3. Frontend polls / receives server time & expiry; displays countdown.
4. Azure Function scans expired `in-progress` submissions every 5 min; finalizes & triggers evaluation pipeline.
5. Evaluation artifacts stored externally in `evaluations`; submission keeps summary pointer.

Related docs: `docs/server-authoritative-assessment.md`, `auto-submit/`, `docs/testing-guide.md`.

---
## 8. Deployment Overview

| Component        | Suggested Azure Target                           |
| ---------------- | ------------------------------------------------ |
| Backend          | Azure Container Apps (w/ Managed Identity)       |
| Frontend         | Vercel or Azure Static Web Apps / Container Apps |
| LLM Agent        | Separate Container App (scales independently)    |
| Auto-Submit      | Azure Functions (Consumption)                    |
| Cosmos (Primary) | Provisioned / Autoscale (later)                  |
| Cosmos (Vector)  | Serverless (early) → optionally provisioned      |

Deployment Steps (abridged):
1. Provision Cosmos (primary) + vector account (enable vector search upfront).
2. Deploy backend container → assign system managed identity → grant **Cosmos DB Built-in Data Contributor** on both accounts.
3. Deploy agent service (optional first iteration without MI — key auth).
4. Deploy auto-submit function + configure identity / secrets.
5. Frontend build & deploy with `NEXT_PUBLIC_API_URL` pointing to backend.
6. Add monitoring (RU metrics, latency dashboards) & alerts prior to traffic ramp.

---
## 9. Monitoring & Optimization

* `/metrics` backend endpoint surfaces RU aggregates & container counts.
* RU heuristics: vector queries kept constrained by skill filter + TOP N.
* TTL trimming: `code_executions`, `RAGQueries` reduce storage RU overhead.
* Future: add composite indexes only when query shape + ORDER BY emerges in telemetry.

---
## 10. Roadmap (Selected)

| Area               | Planned                                   | Trigger                             |
| ------------------ | ----------------------------------------- | ----------------------------------- |
| Evaluation lineage | `runSequence` + re-eval linkage           | First multi-eval feature request    |
| Analytics          | `assessment_stats` materialized container | RU / latency threshold in dashboard |
| RAG time-slicing   | `dateBucket` augmentation                 | High-volume retrieval analytics     |
| Rate limiting      | Distributed token bucket                  | RU spikes or > target QPS           |
| Vector index       | diskANN migration                         | >50k vectors / partition            |

---
## 11. Contributing

1. Fork & branch (`feat/<name>`)
2. Add / update tests (pytest for backend & agent)
3. Update relevant README / docs
4. Ensure lint & type checks pass
5. Submit PR with concise summary + data model impacts (if any)

---
## 12. License

MIT License (see `LICENSE`).

---
**Reference:** Detailed data model & partitioning: `docs/cosmos-data-model-review.md`.