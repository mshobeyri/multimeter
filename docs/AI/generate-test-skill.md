# Auto Test Generation Skill

Use this skill when the user wants a Multimeter test generated from an API file, an OpenAPI/Postman spec, or a natural-language scenario.

## Goal

Produce a valid Multimeter `type: test` YAML file that is deterministic, minimal, and easy to validate — with **low token cost**.

## Required workflow (API → test)

1. Optional few-shot: `list_examples` → mirror **`goldenSmoke`** (`examples/ai/golden_smoke/`).
2. Identify the target API `.mmt` path (`discover_api` / `api_card` only if needed).
3. Call MCP **`scaffold_test({ workspaceRoot, apiPath })`** — **required**. Do not invent a blank test.
   - Offline: `testlight scaffold test --from <api.mmt>`
4. Write the returned YAML to `suggestedPath` (or the user path).
5. Apply **only minimal** edits (title, expects, inputs). Prefer smoke unless asked for more.
6. **`validate` until valid, then `format`** — both required before finishing.
7. Stop — no polish rewrite.
8. If the user wants stronger asserts after a run: **`suggest_assertions` → patch → validate → format**.

## Modify discipline

- **Patch only.** Never replace the whole file unless the user explicitly says rewrite/regenerate.
- Prefer surgical edits (one step, one expect, one input).

## Rules

- Output only valid YAML for the generated test.
- Start the file with `type: test`.
- Never add YAML comments (`#`).
- Never web-search Multimeter syntax.
- Use tokens such as `e:`, `i:`, `r:`, and `c:` when appropriate.
- If the source is ambiguous, ask a short clarifying question before generating.

## Golden smoke shape (mirror this)

See `docs/AI/golden-smoke.md` / `list_examples.goldenSmoke`. Scaffold already produces:

```yaml
type: test
title: <API title> smoke test
tags: [smoke, ...]
import:
  <alias>: <relative-api-path>
inputs:
  <name>: i:<name>
steps:
  - call: <alias>
    id: <step_id>
    inputs:
      <name>: i:<name>
    expect:
      status: 200
```

## When to use this skill

- “Generate a test for this API.”
- “Create a smoke test from this OpenAPI spec.”
- “Turn this endpoint into a Multimeter test.”
