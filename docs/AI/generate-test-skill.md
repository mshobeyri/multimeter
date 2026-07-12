# Auto Test Generation Skill

Use this skill when the user wants a Multimeter test generated from an API file, an OpenAPI/Postman spec, or a natural-language scenario.

## Goal

Produce a valid Multimeter `type: test` YAML file that is deterministic, minimal, and easy to validate.

## Required workflow

1. Read the target API file or spec and identify the relevant endpoint and inputs.
2. Prefer a smoke-test baseline first.
3. Use `call`, `assert`, and `check` steps.
4. Reuse imports, aliases, and environment tokens consistently.
5. Validate the generated YAML before returning it.

## Rules

- Output only valid YAML for the generated test.
- Start the file with `type: test`.
- Keep the first non-comment line as `type: test`.
- Prefer small, focused smoke tests unless the user asks for broader coverage.
- Use tokens such as `e:`, `i:`, `r:`, and `c:` when appropriate.
- If the source is ambiguous, ask a short clarifying question before generating.

## Suggested structure

```yaml
type: test
title: <human-readable title>
tags: []
steps:
  - call: <imported_api_or_test>
    id: <step_id>
    inputs:
      <name>: <value>
  - assert: ${<step_id>.status} == 200
```

## When to use this skill

- “Generate a test for this API.”
- “Create a smoke test from this OpenAPI spec.”
- “Turn this endpoint into a Multimeter test.”
