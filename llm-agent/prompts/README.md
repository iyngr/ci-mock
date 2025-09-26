# Prompts (YAML)

This folder stores prompt assets as single-document YAML files (`.yaml`/`.yml`).

Why: versionable, testable prompts; environment-agnostic; easier tuning without code edits.

How loaded: `llm-agent/prompt_loader.py` reads `name`, `system`, and `model` blocks from the YAML file.

Notes:
- The project previously used `.prompty` files (Prompty v1). The loader is tolerant and will
	still accept legacy `.prompty` if present, but the repository has been migrated to `.yaml` files
	for clarity and simpler tooling.

Files present:
- `orchestrator.yaml`
- `code_analyst.yaml`
- `text_analyst.yaml`
- `report_synthesizer.yaml`
- `question_enhancer.yaml`
- `question_generator.yaml` (optional)
- `rag_validator.yaml` (optional)
- `rag_qa.yaml` (optional)
