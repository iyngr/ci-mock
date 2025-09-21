# Cosmos DB Data Model Review (Updated)

Last updated: 2025-09-20

## 1. Executive Summary
The data model has been refactored to address earlier low‑cardinality partition keys, container naming inconsistencies, and evaluation payload bloat. All active containers are now provisioned with corrected partition keys, TTL where appropriate, and selective indexing exclusions. Full evaluation artifacts have been externalized to an `evaluations` container (PK = `/submission_id`) while submissions now store only a compact summary, reducing document growth risk. A SECOND Cosmos DB account (serverless, vector-enabled) now isolates RAG vector workloads (`KnowledgeBase`, optional `RAGQueries`) from transactional assessment workloads to minimize RU baseline, allow independent scaling, and prevent vector experimentation from impacting critical scoring paths. Remaining work centers on re‑scoring sequencing, optional analytics/materialized views, and future time‑series optimization for RAG queries.

Key Improvements Implemented:
- Migrated problematic PK choices (users, questions, knowledge base, code executions) to higher‑cardinality keys.
- Unified canonical container naming (`KnowledgeBase`, `RAGQueries`).
- Added TTL (30 days) for ephemeral telemetry containers (`code_executions`, `RAGQueries`).
- Introduced evaluation separation (full vs summary) to stabilize submission item size.
- Centralized container + logical PK metadata (`constants.py`) enabling automatic PK inference (`auto_create_item`).

## 2. Current Provisioned Containers
Source: `CosmosDBService.ensure_containers_exist` (Primary / Transactional Account)

| Container             | Physical Name           | Partition Key Path  | Logical PK Field | TTL  | Index Customization                                                          | Purpose                                                                           |
| --------------------- | ----------------------- | ------------------- | ---------------- | ---- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Assessments           | `assessments`           | `/id`               | `id`             | None | Default                                                                      | Assessment templates with embedded questions (snapshot)                           |
| Submissions           | `submissions`           | `/assessment_id` †A | `assessment_id`  | None | Exclude large arrays (`answers`, `proctoring_events`, `detailed_evaluation`) | Candidate assessment sessions + answer/proctoring data                            |
| Users                 | `users`                 | `/id`               | `id`             | None | Default                                                                      | Admin & candidate identities (no hotspot)                                         |
| Questions             | `questions`             | `/skill` †Sk        | `skill`          | None | Default                                                                      | (Future / bank) canonical reusable questions (skill partition)                    |
| Generated Questions   | `generated_questions`   | `/skill` †Sk        | `skill`          | None | Default                                                                      | AI-generated cached questions by skill                                            |
| Code Executions       | `code_executions`       | `/submission_id` †S | `submission_id`  | 30d  | Default                                                                      | Judge0 execution traces per submission                                            |
| Evaluations           | `evaluations`           | `/submission_id` †S | `submission_id`  | None | Default (future selective)                                                   | Full scoring artifacts (MCQ + LLM)                                                |
| RAG Queries           | `RAGQueries`            | `/assessment_id` †A | `assessment_id`  | 30d  | Default                                                                      | Logged retrieval queries & diagnostics (PRIMARY if not using dual-account option) |
| Interviews            | `interviews`            | `/assessment_id`    | `assessment_id`  | None | Default                                                                      | Interview sessions and metadata                                                   |
| Interview Transcripts | `interview_transcripts` | `/assessment_id`    | `assessment_id`  | None | Default                                                                      | Speech-to-speech transcripts and session data                                     |

Vector / RAG Account (Serverless, Vector Enabled):

| Container              | Physical Name   | Partition Key Path  | Vector Index Path            | TTL  | Purpose                                                                   |
| ---------------------- | --------------- | ------------------- | ---------------------------- | ---- | ------------------------------------------------------------------------- |
| Knowledge Base         | `KnowledgeBase` | `/skill` †Sk        | `/embedding` (quantizedFlat) | None | Isolated RAG corpus with vector similarity (1536-dim OpenAI embedding)    |
| RAG Queries (optional) | `RAGQueries`    | `/assessment_id` †A | n/a                          | 30d  | (Optional) Keep retrieval logs in same vector account or leave in primary |

Notes:
- Previous missing container (`RAGQueries`) now provisioned in primary; can be moved or duplicated to vector account if tighter RAG telemetry colocation desired.
- All logical PK fields defined in `COLLECTIONS` allow automatic inference; manual partition key errors minimized.
- Dual-account split: Primary (transactional + scoring) vs Serverless Vector (RAG retrieval). RAG account does NOT auto-provision containers—`KnowledgeBase` created manually with vector index; application only validates existence.

Footnotes:
- †A = Assessment axis (groups many submissions / RAG queries for cohort analytics & batch operations)
- †S = Submission (session) axis (isolates high-churn or lineage-scoped data per candidate attempt)
- †Sk = Skill axis (semantic/topic locality for retrieval, generation, reuse, vector relevance)

## 2a. Why Multiple Partition Key Axes?
Cosmos DB expects you to optimize each container for its dominant access pattern; enforcing a single universal PK would increase RU costs and create hotspots. We deliberately use three axes:

| Axis            | Used By                                             | Co-located Data                                      | Primary Workloads Optimized                                               | Why Not Another Axis?                                                                               |
| --------------- | --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Assessment (†A) | `submissions`, `RAGQueries`                         | All submissions or queries for one assessment        | Batch scoring insights, per-assessment analytics, retrieval diagnostics   | Using submission axis would fragment aggregate queries; using skill would mix unrelated assessments |
| Submission (†S) | `evaluations`, `code_executions`                    | Evaluation lineage & code run events for one attempt | Low-latency session history, safe high-cardinality isolation, TTL cleanup | Assessment axis could hotspot during live exam surges                                               |
| Skill (†Sk)     | `questions`, `generated_questions`, `KnowledgeBase` | Topically related content                            | Targeted generation cache, topical retrieval, vector relevance locality   | Assessment or submission axes have low diversity & poor semantic grouping                           |

Design Principles Applied:
1. Co-locate what you batch-read or batch-analyze together (assessments → submissions).
2. Isolate high-churn ephemeral sequences (code executions) by a high-cardinality key.
3. Preserve semantic grouping for retrieval & cache hit efficiency (skill).
4. Avoid low-cardinality write hotspots (role, language, type).
5. Keep lineage histories (evaluations) in the same partition as their submission.

Result: Lower RU, simpler operational reasoning, cleaner future scaling (each axis can evolve independently—e.g., shard skills if a single skill becomes too “hot”).

## 2b. Visual Data Flow & Partition Axes
```mermaid
flowchart LR
	subgraph A[Assessment Axis †A]
		ASMT[Assessments (/id)] -->|spawns| SUBS[(Submissions /assessment_id)]
		ASMT --> RAG[RAGQueries /assessment_id]
	end

	subgraph S[Submission Axis †S]
		SUBS --> EVALS[(Evaluations /submission_id)]
		SUBS --> CODE[(Code Executions /submission_id)]
	end

	subgraph SK[Skill Axis †Sk]
		Q[Questions /skill]
		GQ[Generated Questions /skill]
		KB[KnowledgeBase /skill]
	end

	%% Cross-axis relationships
	SUBS -->|references questions snapshot| Q
	GQ -->|feeds| ASMT
	KB -->|vector context| RAG
```

Axis Highlights:
- Assessment axis drives cohort-level analytics & retrieval diagnostics.
- Submission axis captures volatile per-attempt telemetry & evaluation lineage.
- Skill axis centralizes semantic/question assets for reuse and RAG enrichment.

Operational Independence:
- You can purge old `code_executions` (TTL) without touching evaluation lineage or question bank.
- Skill-based re-embedding (KB rebuild) does not impact live submissions.
- Adding rescore versions scales only the submission axis partitions affected.
- Vector index rebuilds (e.g., switching `flat` → `quantizedFlat`) occur in the isolated serverless account, avoiding throughput contention.

## 2c. Dual-Account Vector Architecture
Rationale: Isolate experimental / scale-variable RAG vector workloads from mission-critical assessment flows while minimizing baseline cost.

| Aspect               | Primary Account (Transactional)                                              | RAG Account (Serverless Vector)             |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| Workloads            | Assessments, Submissions, Evaluations, Code Executions, (default) RAGQueries | KnowledgeBase (vector), optional RAGQueries |
| Throughput Model     | Provisioned / Autoscale (future)                                             | Serverless pay-per-request                  |
| Vector Feature       | Not enabled (simpler indexing)                                               | Enabled (index path `/embedding`)           |
| Failure Blast Radius | Scoring & test delivery                                                      | Retrieval augmentation only                 |
| Cost Behavior Idle   | Fixed baseline (if provisioned)                                              | Near-zero idle RU cost                      |
| Migration Risk       | Low—stable schemas                                                           | Low volume early; can be promoted later     |

Environment Variables:
```bash
RAG_COSMOS_DB_ENDPOINT=https://<rag-account>.documents.azure.com/
RAG_COSMOS_DB_DATABASE=ragdb
RAG_COSMOS_DB_PREFERRED_LOCATIONS=East US
```

Initialization Path:
1. App startup loads primary DB as before.
2. Attempts to initialize RAG service (`rag_database.get_rag_service`).
3. Verifies `KnowledgeBase` exists (no create if absent to avoid accidental non-vector container creation).
4. Optionally creates `RAGQueries` in RAG account (TTL 30d) if present.

Fallback Behavior:
- If RAG env vars unset → RAG endpoints transparently use primary account containers.
- If RAG account unreachable → logs warning, falls back (no feature hard fail unless vector-only path is invoked).

Operational Advantages:
- Clean separation of RU patterns (point reads vs similarity scans).
- Safe to iterate on embedding model / index type without impacting assessment SLA.
- Enables later promotion to dedicated throughput or external vector store if corpus size / QPS justify.

Future Enhancements:
- Add usage-based promotion heuristic (when avg RU/query > threshold, consider dedicated throughput vs serverless).
- Introduce partition load monitoring per skill to preempt hot skill shard planning.


## Operational provisioning (manual container creation)

This repository intentionally does NOT auto-create containers during startup. Operators must create required containers manually in the target Cosmos DB account(s). The quick reference below is merged from the operational note and includes example Azure CLI commands.

Primary (transactional) account required containers and partition keys:
- assessments: partition key `/id`
- submissions: partition key `/assessment_id`
- users: partition key `/id`
- questions: partition key `/skill`
- generated_questions: partition key `/skill`
- KnowledgeBase: partition key `/skill` (if you want KnowledgeBase in the transactional account; normally this lives in the RAG account)
- code_executions: partition key `/submission_id` (TTL 30d)
- evaluations: partition key `/submission_id`
- RAGQueries: partition key `/assessment_id` (TTL 30d)
- interviews: partition key `/assessment_id`
- interview_transcripts: partition key `/assessment_id`

RAG (serverless/vector-enabled) account intended containers:
- KnowledgeBase: partition key `/skill` with vector index enabled (must be provisioned with vector indexing settings using the Azure Portal/ARM/Bicep or az CLI extension)

Manual creation examples (Azure CLI):

```bash
# Create a standard container in the primary DB
az cosmosdb sql container create --account-name <account> --database-name <db> --name RAGQueries --partition-key-path /assessment_id --throughput 400 --resource-group <rg>

# Create KnowledgeBase in RAG account with default TTL (example)
az cosmosdb sql container create --account-name <rag-account> --database-name <db> --name KnowledgeBase --partition-key-path /skill --resource-group <rg>
```

Note: Vector indexing for `KnowledgeBase` cannot be created via the simple CLI above in some subscriptions; prefer Azure Portal or ARM/Bicep templates that include vector index properties. Consult the repository docs (for example `docs/judge0-azure-setup.md`) for observed quirks and recommended ARM templates.


## 3. Partition Key Rationale (Current State)
| Domain Concern                      | Container                                     | Chosen PK      | Why It Works                                        | Trade-offs / Future Options                                                                     |
| ----------------------------------- | --------------------------------------------- | -------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Assessment distribution             | assessments                                   | /id            | One item per logical partition → predictable        | Limited grouping; /target_role possible later                                                   |
| Submission analytics per assessment | submissions                                   | /assessment_id | Batch scoring + per-assessment aggregation locality | Point lookups by submission_id require cross-partition query (mitigated by id lookup + PK read) |
| User isolation                      | users                                         | /id            | High cardinality; even RU spread                    | None significant                                                                                |
| Skill-centric retrieval             | questions, generated_questions, KnowledgeBase | /skill         | Aligns with query/filter patterns                   | Skill skew possible (monitor)                                                                   |
| Execution grouping                  | code_executions                               | /submission_id | Collocates all runs for session; TTL manages churn  | High-cardinality but shallow per PK (desired)                                                   |
| Evaluation lineage                  | evaluations                                   | /submission_id | All evaluation versions together for diff/rescore   | Very large rescore history could cluster—introduce dateBucket suffix if needed                  |
| RAG query correlation               | RAGQueries                                    | /assessment_id | Associate retrievals with assessment context        | For time-series metrics add derived `dateBucket` field + synthetic PK variant later             |

Deferred Enhancements:
- Optional `dateBucket` (YYYYMMDD) composite for RAG time-slicing.
- Synthetic partition mix (e.g., `<skill>#<bucket>`) if a single skill becomes disproportionately large.

## 4. Embedding vs Referencing (Revalidated)
| Entity                       | Strategy                                           | Outcome                                  | Risk Mitigation                            | Current Decision                                            |
| ---------------------------- | -------------------------------------------------- | ---------------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Assessment.questions         | Embedded polymorphic                               | Single network fetch for candidate start | Snapshot semantics accepted                | Keep                                                        |
| Submission.answers           | Embedded                                           | Simple scoring read path                 | Could inflate; monitor item size           | Keep; externalize only if > ~1.2MB typical                  |
| Submission.proctoring_events | Embedded                                           | Unified audit view                       | High-frequency events could bloat          | Introduce `proctor_events` container if median > 300 events |
| Evaluation artifacts         | Externalized (evaluations) + summary in submission | Prevents runaway submission growth       | Need join (two reads) when viewing details | Adopted                                                     |
| KnowledgeBaseEntry.embedding | Embedded                                           | Simplicity                               | Vector size inflation                      | Revisit at scale (move to Azure AI Search)                  |
| Code executions              | Separate container                                 | TTL bounds storage                       | None major                                 | Adopted                                                     |

## 5. Evaluation Storage Refactor
Previous design stored full `detailed_evaluation` inside each submission (risking large array/doc growth). Now:
- Full artifact: `EvaluationRecord` in `evaluations` (PK `/submission_id`).
- Submission carries `evaluation` (method, version, summary aggregates, `latestEvaluationId`).
- Enables multi-run lineage (future: increment `runSequence`, add `reEvaluationOf`).
- Facilitates selective re-score without rewriting submission history.

Future Additions:
1. Compute `runSequence` by counting existing evaluations per submission.
2. Support re-evaluation referencing prior evaluation id.
3. Optional purge/compaction policy (keep last N evaluations) if volume high.

## 6. Indexing & RU Optimization
Active custom policy only on `submissions` (array exclusions). Planned next steps:
- Consider excluding verbose feedback fields in `evaluations` once stable (e.g., `/llmResults/*`).
- Add composite indexes only in response to observed ORDER BY + filter patterns (avoid premature complexity).

Guidelines:
- Maintain selective indexing for write-heavy containers; measure RU after initial traffic before further exclusions.
- Avoid indexing large opaque arrays (already excluded where applicable).

## 7. Normalization & Skill Slugging
Function: `normalize_skill` (collapse whitespace → hyphen, lowercase, strip invalid chars) applied at write boundaries in admin & RAG paths. Ensures consistent partitioning and prevents fragmented skill partitions (`React Hooks` vs `react-hooks`).

## 8. Operational Patterns & Query Notes
- Submission scoring path now uses `find_one` (cross-partition) for submission lookup by id, then uses correct PK (`assessment_id`) for updates.
- Cross-partition candidate history queries acceptable at current scale; add `candidate_submissions` materialized view if latency becomes noticeable.
- RAG query logging gains TTL to limit storage and reduce scans for stale data.

## 9. Remaining / Deferred Roadmap
| Area               | Item                                      | Status      | Rationale                                      |
| ------------------ | ----------------------------------------- | ----------- | ---------------------------------------------- |
| Evaluation lineage | Increment `runSequence` + re-eval linkage | Deferred    | Implement after first multi-run use case       |
| Analytics          | `assessment_stats` aggregation container  | Deferred    | Add once dashboard scan RU > acceptable budget |
| Candidate view     | `candidate_submissions` summary container | Deferred    | Only if per-candidate queries become hot       |
| Lookup taxonomy    | `lookups` container (skills/roles)        | Deferred    | Low immediate value; telemetry first           |
| Proctor events     | Externalization & TTL                     | Conditional | Await empirical event volume                   |
| RAG queries        | Composite PK with dateBucket              | Optional    | Add for high-volume time-series analytics      |

## 10. Risk & Mitigation Matrix (Updated)
| Risk                                     | Current Exposure         | Mitigation In Place                            | Additional Action Trigger                                        |
| ---------------------------------------- | ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| Hot partitions (skill skew)              | Low (early stage)        | Skill slug normalization                       | Monitor partition metrics; shard skill if >40% RU                |
| Submission doc bloat                     | Moderated                | Evaluation externalization; index exclusions   | Externalize proctor events if size >1.5MB 95th percentile        |
| Cross-part scans for candidate history   | Acceptable               | Potential materialized view plan               | P95 latency or RU threshold exceeded                             |
| Evaluation artifact growth               | Low (version=1 only)     | Separate container                             | Implement retention once avg evaluations/submission >3           |
| RAG analytics granularity                | Basic (assessment scope) | TTL + assessment partition                     | Add dateBucket when time-series dashboards planned               |
| Vector workload interference             | Removed (isolated)       | Dual-account architecture                      | If RAG QPS explodes, evaluate dedicated RU or external vector DB |
| Accidental non-vector container recreate | Low                      | Manual creation + runtime existence check only | Add infra-as-code guardrail (Bicep/TF validation)                |

## 11. Migration Status Summary
| Change               | Previously              | Now                               | Migration Needed                   |
| -------------------- | ----------------------- | --------------------------------- | ---------------------------------- |
| Users PK             | /role                   | /id                               | None (empty dataset)               |
| Questions PK         | /type                   | /skill                            | None (bank not yet populated)      |
| KnowledgeBase PK     | /source_type            | /skill                            | None (standardized)                |
| Code Executions PK   | /language               | /submission_id                    | N/A (new path)                     |
| Evaluations storage  | Embedded in submissions | External + summary                | One-off structural change complete |
| RAGQueries container | Missing                 | Provisioned (/assessment_id, TTL) | N/A                                |

## 12. Monitoring & Telemetry Recommendations
- Capture per-container RU + latency (aggregate every 15m) to identify emerging hotspots.
- Track submission document size percentile distribution monthly.
- Log evaluation run counts per submission to decide when to implement retention policies.

## 13. Immediate Action Checklist (All Implemented)
1. Central constants + auto PK inference.
2. Correct submission update partition usage in scoring.
3. Provision missing containers (`RAGQueries`, `KnowledgeBase`).
4. Apply TTL to ephemeral telemetry containers.
5. Externalize full evaluation artifacts.

## 14. Sample Usage Patterns
Point Read (submission summary + latest evaluation):
1. `find_one(submissions, {"id": submission_id})` (cross-partition, returns assessment_id)
2. `read_item(evaluations, evaluation_id, partition_key=submission_id)` for full details (optional)

Skill-Normalized Write (generated question):
```python
skill_slug = normalize_skill(input_skill)
item = {"skill": skill_slug, ...}
await db.auto_create_item(CONTAINER["GENERATED_QUESTIONS"], item)
```

## 15. Change Log (Chronological)
| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2025-09-11 | Introduced `constants.py`, skill normalization helper.                       |
| 2025-09-12 | Added container provisioning updates (TTL, indexing exclusions, RAGQueries). |
| 2025-09-12 | Added `auto_create_item` + refactored routers to use it.                     |
| 2025-09-13 | Fixed MCQ validation bug (removed nonexistent `get_item`).                   |
| 2025-09-13 | Added evaluation externalization (`EvaluationRecord`, submission summary).   |
| 2025-09-14 | Comprehensive document rewrite reflecting current model & roadmap.           |
| 2025-09-14 | Added dual-account vector (serverless) architecture & env var documentation. |

## 16. Summary
Current model emphasizes pragmatic denormalization, operational safety (automatic PK inference), and future-proofing for evaluation scaling. No immediate migrations are pending due to empty/low-volume state; focus now should shift to telemetry-driven adjustments rather than speculative restructuring.

---
This document supersedes prior versions; obsolete recommendations (e.g., migrating users/questions PK) are now marked complete.


## Partition key naming and aliases (important operational note)

There is a subtle but important difference between Pydantic field names (Python identifiers), Pydantic aliases (for example `assessmentId`) and the actual JSON property names written to Cosmos DB documents (the keys in the stored JSON). Cosmos DB partition key paths are literal JSON paths (for example `/assessment_id` or `/assessmentId`).

Guidance and current project convention:

- Canonical logical field names used throughout the Python codebase are snake_case (for example `assessment_id`, `submission_id`, `skill`).
- Many Pydantic models expose camelCase aliases for public JSON APIs (for example `assessmentId`, `submissionId`) for client friendliness. Internally, code often uses the snake_case attributes.
- The Cosmos partition key path must match the actual JSON key stored in the document. To avoid mismatches, choose one of the following and apply it consistently:
	- Option A (recommended for this repo): store documents with snake_case keys for partitioning fields (e.g., document contains `"assessment_id": "..."`) and use partition paths like `/assessment_id`. When calling `model_dump()` prefer `by_alias=False` or ensure the DB layer writes the snake_case key.
	- Option B: store partition key fields using the camelCase alias (e.g., `"assessmentId"`) and update `COLLECTIONS` in `backend/constants.py` to reference the exact JSON key used (for example set `pk_field` to `assessmentId`).

Current codebase status: code and model partition_key properties currently reference the logical snake_case names (for example `Submission.partition_key` returns `self.assessment_id`, `EvaluationRecord.partition_key` returns `self.submission_id`). The `constants.py` `pk_field` values are the logical snake_case names too. This is consistent provided the write path stores the snake_case key in Cosmos. If you adopt camelCase aliases for persisted documents, update `constants.py` and the docs to match.

Action items (recommendations):
- Add an automated check (CI) that ensures writes include the partition key field under the chosen casing (snake_case or alias). This prevents runtime partition key exceptions.
- Consider adding a small helper in the DB layer that canonicalizes partition-key lookup from both alias and snake_case (safe fallback) when `partition_key` is being inferred.

