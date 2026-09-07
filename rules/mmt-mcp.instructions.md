---
name: MultimeterMcpFirst
description: Use Multimeter MCP tools first for all .mmt create, modify, validate, format, and run tasks
globs: "**/*.mmt"
applyTo: "**/*.mmt"
alwaysApply: false
---

# Multimeter MCP-first instructions

When the request involves a `.mmt` file (create, modify, validate, format, or run), **use the Multimeter MCP server tools in your first tool calls**. Do not explore npm packages, install CLIs, or run shell commands first. Do not web-search Multimeter syntax.

## Required order

1. **New test from API** → `scaffold_test({ workspaceRoot, apiPath })` (required; do not invent blank YAML)
2. **Few-shot** → `list_examples` / `goldenSmoke` when you need a shape to mirror
3. **Inspect one API** → `api_card` (prefer over full file dump)
4. **Other syntax** → `read_documentation` with default **min** pack (`pack: full` only if needed)
5. **Edit** — write scaffold yaml or **patch** an existing file
6. **Tighten asserts** → `suggest_assertions` when improving coverage from outputs/response
7. **Validate** → `validate({ file, workspaceRoot })` after every edit
8. **Format** → `format({ file, workspaceRoot })` after validate passes (**required** on generate/modify)
9. **Run** (only when asked) → `run({ file, workspaceRoot })`

## Never do this

- Do not run `testlight`, `npx testlight`, or `npm install` first (when MCP is available)
- Do not invent a new API test without `scaffold_test`
- Do not **rewrite the whole `.mmt` file** on modify unless the user explicitly asks to rewrite/regenerate
- Do not web-search Multimeter YAML syntax

## Modify requests

For "change", "update", "fix", or "add to": **patch only** → `validate` → `format`.

## Run requests

Call MCP **`run`** only. If the user then wants stronger asserts: `suggest_assertions` → patch → validate → format.
