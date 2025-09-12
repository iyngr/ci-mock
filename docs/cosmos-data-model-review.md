# Cosmos DB Data Model Review

_Last updated: 2025-09-12_

## Executive Summary
The current Cosmos DB (SQL API via azure-cosmos SDK) modeling works functionally but several partition keys are low-cardinality (\`/role\`, \`/type\`, \`/language\`, \`/source_type\`) which will lead to RU hotspots and higher costs at scale. There is also a container naming mismatch (`knowledge_base` vs `KnowledgeBase`) and an uncreated but referenced container (`RAGQueries`). Embedded documents optimize read paths (assessment + questions, submission + answers/events) but risk large item growth. A few code paths use incorrect partition keys during point reads/updates (notably submissions in scoring).

## Current Containers (from `CosmosDBService.ensure_containers_exist`)
| Container (configured) | Partition Key | Notes / Divergence in Code |
|------------------------|---------------|-----------------------------|
| assessments            | /id           | Questions embedded; PK = id (one item per logical partition). |
| submissions            | /assessment_id| Code later reads with PK=submission_id (bug). |
| users                  | /role         | Only two values → hotspot risk. |
| questions              | /type         | Few values (mcq/descriptive/coding). |
| generated_questions    | /skill        | Good; skill used in queries. |
| knowledge_base         | /source_type  | Code actually uses `KnowledgeBase` (capital K) and partitions by skill in fallback. |
| code_executions        | /language     | Very low cardinality. |
| evaluations            | /submission_id| Not heavily used (scoring writes back into `submissions`). |
| (missing) RAGQueries   | (implicit)    | Referenced via `db.upsert_item("RAGQueries", ...)` but not created. |

## Containers Referenced in Routers
- `assessments`
- `submissions`
- `generated_questions`
- `questions` (only in comments / future) 
- `KnowledgeBase` (capitalization) 
- `code_executions`
- `RAGQueries`
- Potential (not yet created): events/proctoring externalization, evaluation history.

## Embedding vs Referencing
| Entity | Current Strategy | Rationale | Risks / Trade-offs | Recommendation |
|--------|------------------|-----------|--------------------|----------------|
| Assessment.questions | Entire question objects embedded (polymorphic) | Single read to serve candidate | Question edit after embedding does not propagate | Accept (snapshot semantics). If shared question bank needed later, introduce separate `questions` container and store references + version. |
| Submission.answers | Embedded | One doc read for candidate progress & scoring | Document can grow large; update RU increases | Monitor size; if answers add large evaluation payloads, consider splitting `answers` into separate container keyed by /submission_id. |
| Submission.proctoring_events | Embedded list | Convenience, single read for session review | Potential high-frequency events cause bloat | If events > few hundred per session, move to `proctor_events` container with /submission_id + TTL. |
| GeneratedQuestion metadata | Standalone per item | Reuse & caching | None major | Keep. Normalize skill slug consistently. |
| KnowledgeBaseEntry.embedding | Embedded vector | Simplicity for small scale RAG | Large vectors enlarge item; RU cost for write | Accept now; if vectors become large & queries complex, evaluate vector store / Azure AI Search. |
| BulkQuestionUpload session data | Embedded arrays | Simplicity | Large CSV could exceed item size (2 MB limit) | Enforce max rows or split into per-question docs. |

## Partition Key Assessment
| Container | Current PK | Issue | Suggested PK | Benefit |
|-----------|-----------|-------|--------------|---------|
| users | /role | 2–3 distinct values → hotspot | /id or /email (or /organization_id if multi-tenant) | Even distribution, point reads. |
| questions | /type | 3 values → hotspot | /skill (normalized) | Aligns with skill-based retrieval, spreads RU. |
| knowledge_base / KnowledgeBase | /source_type | Few values | /skill (or synthetic `<skill>#<bucket>`) | Efficient skill-filter + balanced partitions. |
| code_executions | /language | Few values | /submission_id | Correlate all executions per submission; parallelizable across submissions. |
| RAGQueries | (none defined) | Lacking container creation; poor analytics grouping | /dateBucket or /assessment_id | Time-series or assessment analytics without cross-part scans. |
| assessments | /id | Acceptable but no grouping | (Optional) /target_role or /organization_id | Group queries by role/tenant. |
| submissions | /assessment_id | Good for per-assessment analytics; complicates point reads by submission_id alone | (Keep) OR /id if direct submission lookups dominate | Choose based on workload; implement cache mapping if keeping /assessment_id. |

## Identified Bugs / Inconsistencies
1. **Submission Access in Scoring**: `scoring.py` fetch uses `partition_key=submission_id` though container PK is `/assessment_id` → will fail point reads. Must supply correct partition key or redesign PK.
2. **Container Name Mismatch**: Code writes to `KnowledgeBase`; provisioning uses `knowledge_base`.
3. **Missing Container**: `RAGQueries` not created in `ensure_containers_exist`.
4. **Mixed Partition Usage for Generated Questions**: Model normalizes skill (`lower().replace(" ", "-")`) but creation code passes raw `skill` string; potential partition duplication ("React Hooks" vs "react-hooks").

## Query Pattern Observations
- Dashboard counts rely on cross-partition scans (e.g., submissions by status). Consider background aggregation container (`assessment_stats`) or maintain counters via stored procedure / transactional batch (future optimization).
- Candidate history queries by candidate_id/email cross partitions (PK is assessment_id) → acceptable if volume moderate; heavy usage warrants materialized view.
- RAG queries logged without consistent partition key dimension; will impair analytical filtering later.

## Indexing Considerations
All containers default to full indexing (implicit). High-write containers (`submissions`, future `RAGQueries`, `code_executions`) may benefit from selective indexing:
- Exclude large arrays: `/answers/?`, `/proctoring_events/?` (assuming you rarely filter on elements inside arrays).
- Keep indexes on scalar filter fields: `status`, `assessment_id`, `candidate_id`, `skill`, `created_at`.

## Lookup / Reference Entities
No dedicated lookup collections (skills, roles). Introducing a lightweight `lookups` container (pk `/id`) for canonical skill slugs and developer roles can:
- Standardize skill normalization
- Power UI dropdowns without scanning distinct values

## Recommended Target Container Configuration
```text
assessments          pk: /id (or /target_role if needed later)
submissions          pk: /assessment_id   (keep)  OR switch to /id (trade-off)
users                pk: /id
questions            pk: /skill
generated_questions  pk: /skill
KnowledgeBase        pk: /skill
code_executions      pk: /submission_id
RAGQueries           pk: /dateBucket  (store YYYYMMDD) OR /assessment_id
proctor_events*      pk: /submission_id  (future, if externalized)
evaluations*         pk: /submission_id  (only if decoupled from submissions)
```

## Migration Strategy (Incremental, Zero-Downtime)
1. **Provision New Containers** with v2 suffix (e.g., `questions_v2`) using improved PKs.
2. **Backfill Script**: Batch read old container, transform partition key field (ensure normalized), upsert into v2.
3. **Dual-Write Phase**: Update application code to write to both (feature flag) while reads still from old.
4. **Switch Reads**: After verification, point reads to v2.
5. **Decommission Old** after retention window; optionally rename (or keep with suffix for audit).
6. **Apply TTL & Index Policies**: Add TTL for ephemeral analytics (code executions, RAGQueries) and custom index policy to exclude large arrays.

## Quick Fix Actions (Short Term)
| Priority | Action | Effort | Impact |
|----------|--------|--------|--------|
| P1 | Fix scoring read/update partition key usage for submissions | Low | Prevent runtime errors / wasted RU |
| P1 | Add `RAGQueries` & proper `KnowledgeBase` container creation | Low | Avoid missing container failures |
| P2 | Normalize skill slug at write time (single utility) | Low | Prevent partition fragmentation |
| P2 | Standardize container naming (`KnowledgeBase`) in provisioner | Low | Operational consistency |
| P3 | Change low-cardinality PKs (users, questions, knowledge_base, code_executions) | Medium | RU distribution & cost reduction |
| P3 | Add TTL to code_executions & future RAGQueries | Low | Storage cost control |
| P4 | Add index policy tuning after volume metrics | Medium | Write RU reduction |

## Document Size Watchpoints
- Monitor average `submission` size; externalize proctoring events if approaching hundreds of events or large evaluation payloads.
- Enforce max CSV rows for bulk question uploads to avoid oversized `BulkQuestionUpload` documents.

## Normalization Guidance (NoSQL Context)
Selective denormalization is correct here. Do **not** normalize polymorphic question details unless you need shared live updates. Introduce referencing only when mutation/ reuse benefits outweigh extra read round trips.

## Optional Enhancements
- Materialized `assessment_stats` container (pk /assessment_id) updated via small transactional batch (or application-level writes) for O(1) dashboard metrics.
- Candidate-centric `candidate_submissions` summary (pk /candidate_id) for rapid history queries.
- Vector externalization to Azure AI Search if embedding volume & query complexity grows.

## Sample Skill Normalization Helper
```python
def normalize_skill(raw: str) -> str:
    return raw.strip().lower().replace(" ", "-")
```
Use before any write and for partition_key derivation.

## Risk Summary
| Risk | Cause | Mitigation |
|------|-------|------------|
| Hot partitions | Low-cardinality PK choices | Repartition (see target config) |
| Query RU inflation | Cross-part scans for candidate/status queries | Aggregation containers, improved PKs |
| Item size bloat | Embedded events & answers growth | Externalize large arrays; TTL events |
| Operational errors | Container name mismatch | Align provisioning names |
| Analytics friction | Missing RAGQueries PK strategy | Introduce date/assessment-based PK |

## Next Steps (Suggested Order)
1. Implement container creation fixes + skill normalization utility.
2. Correct scoring partition key usage.
3. Add `RAGQueries` + TTL and dataset logging pattern with date bucket.
4. Plan & execute PK migration for users, questions, knowledge base, code_executions.
5. Introduce index policy customization after migration.
6. Evaluate need for event externalization based on real telemetry.

---
_This review intentionally balances short-term pragmatic fixes with medium-term scalability; adapt ordering based on actual RU metrics once connected to STG Cosmos._
