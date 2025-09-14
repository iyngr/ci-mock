# Cosmos DB Data Model Review (Updated)

Last updated: 2025-09-14

## 1. Executive Summary
The data model has been refactored to address earlier low‑cardinality partition keys, container naming inconsistencies, and evaluation payload bloat. All active containers are now provisioned with corrected partition keys, TTL where appropriate, and selective indexing exclusions. Full evaluation artifacts have been externalized to an `evaluations` container (PK = `/submission_id`) while submissions now store only a compact summary, reducing document growth risk. Remaining work centers on re‑scoring sequencing, optional analytics/materialized views, and future time‑series optimization for RAG queries.

Key Improvements Implemented:
- Migrated problematic PK choices (users, questions, knowledge base, code executions) to higher‑cardinality keys.
- Unified canonical container naming (`KnowledgeBase`, `RAGQueries`).
- Added TTL (30 days) for ephemeral telemetry containers (`code_executions`, `RAGQueries`).
- Introduced evaluation separation (full vs summary) to stabilize submission item size.
- Centralized container + logical PK metadata (`constants.py`) enabling automatic PK inference (`auto_create_item`).

## 2. Current Provisioned Containers
Source: `CosmosDBService.ensure_containers_exist`

| Container | Physical Name | Partition Key Path | Logical PK Field | TTL | Index Customization | Purpose |
|-----------|---------------|--------------------|------------------|-----|--------------------|---------|
| Assessments | `assessments` | `/id` | `id` | None | Default | Assessment templates with embedded questions (snapshot) |
| Submissions | `submissions` | `/assessment_id` | `assessment_id` | None | Exclude large arrays (`answers`, `proctoring_events`, `detailed_evaluation`) | Candidate assessment sessions + answer/proctoring data |
| Users | `users` | `/id` | `id` | None | Default | Admin & candidate identities (no hotspot) |
| Questions | `questions` | `/skill` | `skill` | None | Default | (Future / bank) canonical reusable questions (skill partition) |
| Generated Questions | `generated_questions` | `/skill` | `skill` | None | Default | AI-generated cached questions by skill |
| Knowledge Base | `KnowledgeBase` | `/skill` | `skill` | None | Default | RAG corpus entries with embeddings |
| Code Executions | `code_executions` | `/submission_id` | `submission_id` | 30d | Default | Judge0 execution traces per submission |
| Evaluations | `evaluations` | `/submission_id` | `submission_id` | None | Default (future selective) | Full scoring artifacts (MCQ + LLM) |
| RAG Queries | `RAGQueries` | `/assessment_id` | `assessment_id` | 30d | Default | Logged retrieval queries & diagnostics |

Notes:
- Previous missing container (`RAGQueries`) now provisioned.
- All logical PK fields defined in `COLLECTIONS` allow automatic inference; manual partition key errors are minimized.

## 3. Partition Key Rationale (Current State)
| Domain Concern | Container | Chosen PK | Why It Works | Trade-offs / Future Options |
|----------------|----------|----------|--------------|-----------------------------|
| Assessment distribution | assessments | /id | One item per logical partition → predictable | Limited grouping; /target_role possible later |
| Submission analytics per assessment | submissions | /assessment_id | Batch scoring + per-assessment aggregation locality | Point lookups by submission_id require cross-partition query (mitigated by id lookup + PK read) |
| User isolation | users | /id | High cardinality; even RU spread | None significant |
| Skill-centric retrieval | questions, generated_questions, KnowledgeBase | /skill | Aligns with query/filter patterns | Skill skew possible (monitor) |
| Execution grouping | code_executions | /submission_id | Collocates all runs for session; TTL manages churn | High-cardinality but shallow per PK (desired) |
| Evaluation lineage | evaluations | /submission_id | All evaluation versions together for diff/rescore | Very large rescore history could cluster—introduce dateBucket suffix if needed |
| RAG query correlation | RAGQueries | /assessment_id | Associate retrievals with assessment context | For time-series metrics add derived `dateBucket` field + synthetic PK variant later |

Deferred Enhancements:
- Optional `dateBucket` (YYYYMMDD) composite for RAG time-slicing.
- Synthetic partition mix (e.g., `<skill>#<bucket>`) if a single skill becomes disproportionately large.

## 4. Embedding vs Referencing (Revalidated)
| Entity | Strategy | Outcome | Risk Mitigation | Current Decision |
|--------|----------|---------|----------------|------------------|
| Assessment.questions | Embedded polymorphic | Single network fetch for candidate start | Snapshot semantics accepted | Keep |
| Submission.answers | Embedded | Simple scoring read path | Could inflate; monitor item size | Keep; externalize only if > ~1.2MB typical |
| Submission.proctoring_events | Embedded | Unified audit view | High-frequency events could bloat | Introduce `proctor_events` container if median > 300 events |
| Evaluation artifacts | Externalized (evaluations) + summary in submission | Prevents runaway submission growth | Need join (two reads) when viewing details | Adopted |
| KnowledgeBaseEntry.embedding | Embedded | Simplicity | Vector size inflation | Revisit at scale (move to Azure AI Search) |
| Code executions | Separate container | TTL bounds storage | None major | Adopted |

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
| Area | Item | Status | Rationale |
|------|------|--------|-----------|
| Evaluation lineage | Increment `runSequence` + re-eval linkage | Deferred | Implement after first multi-run use case |
| Analytics | `assessment_stats` aggregation container | Deferred | Add once dashboard scan RU > acceptable budget |
| Candidate view | `candidate_submissions` summary container | Deferred | Only if per-candidate queries become hot |
| Lookup taxonomy | `lookups` container (skills/roles) | Deferred | Low immediate value; telemetry first |
| Proctor events | Externalization & TTL | Conditional | Await empirical event volume |
| RAG queries | Composite PK with dateBucket | Optional | Add for high-volume time-series analytics |

## 10. Risk & Mitigation Matrix (Updated)
| Risk | Current Exposure | Mitigation In Place | Additional Action Trigger |
|------|------------------|---------------------|--------------------------|
| Hot partitions (skill skew) | Low (early stage) | Skill slug normalization | Monitor partition metrics; shard skill if >40% RU |
| Submission doc bloat | Moderated | Evaluation externalization; index exclusions | Externalize proctor events if size >1.5MB 95th percentile |
| Cross-part scans for candidate history | Acceptable | Potential materialized view plan | P95 latency or RU threshold exceeded |
| Evaluation artifact growth | Low (version=1 only) | Separate container | Implement retention once avg evaluations/submission >3 |
| RAG analytics granularity | Basic (assessment scope) | TTL + assessment partition | Add dateBucket when time-series dashboards planned |

## 11. Migration Status Summary
| Change | Previously | Now | Migration Needed |
|--------|-----------|-----|------------------|
| Users PK | /role | /id | None (empty dataset) |
| Questions PK | /type | /skill | None (bank not yet populated) |
| KnowledgeBase PK | /source_type | /skill | None (standardized) |
| Code Executions PK | /language | /submission_id | N/A (new path) |
| Evaluations storage | Embedded in submissions | External + summary | One-off structural change complete |
| RAGQueries container | Missing | Provisioned (/assessment_id, TTL) | N/A |

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
| Date | Change |
|------|--------|
| 2025-09-11 | Introduced `constants.py`, skill normalization helper. |
| 2025-09-12 | Added container provisioning updates (TTL, indexing exclusions, RAGQueries). |
| 2025-09-12 | Added `auto_create_item` + refactored routers to use it. |
| 2025-09-13 | Fixed MCQ validation bug (removed nonexistent `get_item`). |
| 2025-09-13 | Added evaluation externalization (`EvaluationRecord`, submission summary). |
| 2025-09-14 | Comprehensive document rewrite reflecting current model & roadmap. |

## 16. Summary
Current model emphasizes pragmatic denormalization, operational safety (automatic PK inference), and future-proofing for evaluation scaling. No immediate migrations are pending due to empty/low-volume state; focus now should shift to telemetry-driven adjustments rather than speculative restructuring.

---
This document supersedes prior versions; obsolete recommendations (e.g., migrating users/questions PK) are now marked complete.
