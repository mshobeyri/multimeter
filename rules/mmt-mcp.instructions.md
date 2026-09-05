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
2. **Inspect one API** → `api_card` (prefer over full file dump)
3. **Other syntax** → `read_documentation` with default **min** pack (`pack: full` only if needed)
4. **API listing** → `discover_api` when you need to find APIs
5. **Edit** — write scaffold yaml or **patch** an existing file (no full rewrite)
6. **Tighten asserts** → `suggest_assertions` when improving coverage from outputs/response
7. **Validate** → `validate({ file, workspaceRoot })` after every edit
8. **Format** (optional) → `format({ file, workspaceRoot })`
9. **Run** (only when asked) → `run({ file, workspaceRoot })`

## Never do this first

- Do not run `testlight`, `npx testlight`, or `npm install`
- Do not run `node dist/mcp/server.js` or debug the MCP package tarball
- Do not search the repo for runner internals before calling MCP `run`
- Do not guess Multimeter YAML syntax — call `scaffold_test` or `read_documentation`
- Do not generate a new API test from scratch without `scaffold_test`

## Modify requests

For "change", "update", "fix", or "add to" a `.mmt` file: patch only, then **`validate` before finishing**.

## Run requests

For "run" or "execute": call MCP **`run`** only. Return `success`, logs, and errors from the tool response.
