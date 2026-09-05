# Auto Test Generation Skill

Use this skill when the user wants a Multimeter test generated from an API file, an OpenAPI/Postman spec, or a natural-language scenario.

## Goal

Produce a valid Multimeter `type: test` YAML file that is deterministic, minimal, and easy to validate — with **low token cost**.

## Required workflow (API → test)

1. Identify the target API `.mmt` path (use `discover_api` only if the path is unknown).
2. Call MCP **`scaffold_test({ workspaceRoot, apiPath })`** — **required**. Do not invent a blank test.
   - Offline / no MCP: `testlight scaffold test --from <api.mmt>`
3. Write the returned YAML to `suggestedPath` (or the user path).
4. Apply **only minimal** edits (title, expects, inputs). Prefer smoke unless asked for more.
5. Call **`validate`** before finishing; fix until valid.
6. Stop when validate passes — no polish rewrite.

## Rules

- Output only valid YAML for the generated test.
- Start the file with `type: test`.
- Never add YAML comments (`#`).
- Never web-search Multimeter syntax.
- Use tokens such as `e:`, `i:`, `r:`, and `c:` when appropriate.
- Modify requests: patch only; do not rewrite the whole file.
- If the source is ambiguous, ask a short clarifying question before generating.

## Scaffold baseline (what `scaffold_test` already produces)

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
