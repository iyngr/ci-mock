# Prompts (.prompty)

This folder stores prompt assets as `.prompty` files (Prompty v1).

- Why: versionable, testable prompts; environment-agnostic; easier tuning without code edits.
- How loaded: `llm-agent/prompt_loader.py` reads `name`, `system`, and `model` blocks.
- Fallback: If a `.prompty` file is missing or fails to parse, agents use their baked-in defaults.

Files added:
- `orchestrator.prompty`
- `code_analyst.prompty`
- `text_analyst.prompty`
- `report_synthesizer.prompty`
- `question_enhancer.prompty`

Future additions (optional):
- `question_generator.prompty`
- `rag_validator.prompty`
- `rag_qa.prompty`
