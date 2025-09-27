# Responses API Migration Plan for `llm-agent`

## Background
- The `llm-agent` service currently relies on `AzureOpenAIChatCompletionClient` with a thin `call_llm` wrapper to normalize GPT-5 deployment quirks.
- Tool invocation, JSON validation, and conversation state are managed manually within AutoGen teams and FastAPI endpoints.
- Azure OpenAI now exposes the unified **Responses API** (preview) which supersedes legacy Completions/Chat Completions and underpins the Assistants API.

## Objectives
1. Replace direct Chat Completions usage with a Responses-compatible client while maintaining AutoGen 0.7.4 agent ergonomics.
2. Preserve existing FastAPI surface area and team compositions (assessment, question generation, rewriting) so downstream services remain unaffected.
3. Enable structured outputs, tool orchestration, and state threading natively through the Responses API.
4. Establish roll-forward/roll-back controls and validation pipelines to de-risk the migration.

## Stakeholders
- **AI Platform**: Owns Azure OpenAI deployments, API-version management, and cost guardrails.
- **Assessment AI Team**: Maintains `llm-agent`, agent prompt sets, and AutoGen orchestration.
- **QA & Ops**: Runs regression suites (`scripts/smoke_test_backend.py`), monitors latency/error budgets, and coordinates staged rollouts.

## Implementation Phases

### Phase 0 – Prerequisites & Environment (1 sprint)
- Confirm GPT-5 deployments are enabled for the Responses preview (`POST /openai/v1/responses`).
- Update infrastructure-as-code to set `AZURE_OPENAI_API_VERSION=2024-09-01-preview` (or newer when GA) behind a feature flag.
- Document firewall/private endpoint rules covering the `/responses` route.
- Align secret management so API keys/tokens are accessible to new SDK components.

### Phase 1 – Responses Adapter Development (1–2 sprints)
- Implement `ResponsesModelClient` that satisfies AutoGen's `create(messages=…, **kwargs)` contract while internally calling the Responses SDK.
  - Translate `SystemMessage/UserMessage/AssistantMessage` to the Responses `input` array.
  - Preserve streaming support by wiring Responses event streams to AutoGen callbacks.
  - Handle `previous_response_id` forwarding when AutoGen supplies historical turns.
- Normalize generation params:
  - Drop unsupported GPT-5 fields (`temperature`, `top_p`) or map `max_tokens → max_output_tokens` automatically.
  - Accept prompty-driven `response_format` for JSON schemas.
- Feature-flag the adapter via `USE_RESPONSES_API` env var.
- Unit-test the adapter with mocked SDK responses to lock regression behavior.

### Phase 2 – Agent & Service Integration (1–2 sprints)
- Swap `model_client = create_model_client()` to build either the legacy chat client or the new Responses adapter depending on the feature flag.
- Update `call_llm` in `main.py` to use adapter-native semantics (remove redundant GPT-5 guards once adapter handles them).
- Ensure AutoGen tools (`fetch_submission_data`, `score_mcqs`, `rag_tool_cached`, etc.) are registered as Responses function tools by mapping tool signatures to the `tools=[{"type":"function", …}]` schema.
- Extend agent state objects to cache `response_id` when available so follow-up messages can leverage server-side state instead of full history payloads.

### Phase 3 – Structured Outputs & RAG Enhancements (1 sprint)
- Turn on JSON schema enforcement for scoring/reporting agents using Responses `response_format`.
- Evaluate moving Cosmos RAG attachments to Responses-compatible `file_search` or MCP servers once generally available; otherwise retain the LangChain adapter under configuration guards.
- Review prompty files to ensure instructions align with deterministic JSON output expectations.

### Phase 4 – Validation & Observability (1 sprint, overlaps Phase 2/3)
- Extend `_validate_azure_openai()` to ping `/responses` with `max_output_tokens=1` to fail fast on misconfiguration.
- Refresh `scripts/smoke_test_backend.py` to cover key endpoints under both flag states.
- Capture baseline metrics (latency, throughput, cost) via Application Insights or custom telemetry and compare against legacy runs.
- Implement structured logging around Responses tool calls to ease debugging.

### Phase 5 – Rollout & Post-Migration Hardening (1 sprint)
- Deploy to staging with feature flag ON; run full regression suite plus targeted manual UX tests.
- Monitor error budgets for 48 hours; if healthy, promote to production.
- Keep legacy client path dormant but available for emergency rollback (flag OFF) until Responses API reaches GA.
- After GA, remove dead code and retire the legacy chat client to reduce maintenance overhead.

## Risks & Mitigations
- **SDK Maturity**: The Responses SDK is in preview. Mitigate with feature flags and adapter abstraction to revert quickly.
- **AutoGen Compatibility**: If AutoGen 0.7.4 lacks Responses helpers, the custom adapter isolates change. Track upstream updates to replace the adapter when official support arrives.
- **Latency Variability**: Responses introduces run management overhead. Benchmark and, if necessary, move high-frequency tasks (e.g., quick health prompts) to `gpt-4.1-nano` deployments or adjust max tokens.
- **Tool Payload Drift**: JSON schema enforcement may surface validation errors. Iterate prompts and schemas to ensure agents emit compliant structures.

## Post-Migration Benefits
- **Unified API Surface**: One endpoint for chat, tool calls, and assistant-like workflows simplifies client logic and future migrations.
- **First-Class GPT‑5 Support**: GPT-5 deployment quirks (token limits, sampling restrictions) are natively handled by the Responses stack, reducing custom code in `call_llm`.
- **Deterministic Outputs**: JSON schema enforcement cuts down on manual parsing/validation in scoring pipelines, accelerating downstream automation.
- **Improved Tool Orchestration**: Function/tool runs and `required_action` payloads align with Assistants semantics, easing integration with Logic Apps or upcoming Azure Agent Service features.
- **Scalability & Observability**: Threaded sessions and response IDs enable incremental context loading, lowering token usage and improving traceability.
- **Future Readiness**: Once Azure GA’s Agent Service or MCP-based tooling becomes mainstream, the Responses foundation allows quick adoption without another overhaul.

## Success Metrics
- 0% increase in P95 latency during staged rollout (compared with chat completions baseline).
- ≥10% reduction in scoring/report parsing errors thanks to JSON schemas.
- Zero 5XX errors attributed to Azure OpenAI endpoint misconfiguration after Phase 4 validation.
- Positive developer feedback (survey) on clarity and maintainability of the new adapter abstraction.

## References
- Use #context7 and referenced sources to understand the context.
- References - https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/- tutorial/agents.html#
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/assistant
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key

- Note Migrate from current Completions or Chat Completions API to Responses completely while being compatible with Autogen, I assume Autogen (0.7.4) already offers support to this. Also note that I use Azure Open AI GPT 5 models. Refer #file:llm-agent for current implementation