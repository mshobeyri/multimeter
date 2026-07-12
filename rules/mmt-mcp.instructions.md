---
description: Use Multimeter MCP tools first for all .mmt create, modify, validate, format, and run tasks
applyTo: "**/*.mmt"
---

# Multimeter MCP-first instructions

When the request involves a `.mmt` file (create, modify, validate, format, or run), **use the Multimeter MCP server tools in your first tool calls**. Do not explore npm packages, install CLIs, or run shell commands first.

## Required order

1. **Understand syntax** → `read_documentation` (topic: `test`, `api`, `suite`, etc.)
2. **API context** → `discover_api` when generating or changing tests that call APIs
3. **Edit** the file in the workspace
4. **Validate** → `validate({ file, workspaceRoot })` after every edit
5. **Format** (optional) → `format({ file, workspaceRoot })`
6. **Run** (only when asked) → `run({ file, workspaceRoot })`

## Never do this first

- Do not run `testlight`, `npx testlight`, or `npm install`
- Do not run `node dist/mcp/server.js` or debug the MCP package tarball
- Do not search the repo for runner internals before calling MCP `run`
- Do not guess Multimeter YAML syntax — call `read_documentation`

## Modify requests

For "change", "update", "fix", or "add to" a `.mmt` file: call `read_documentation` for the file type, make the edit, then **`validate` before finishing**.

## Run requests

For "run" or "execute": call MCP **`run`** only. Return `success`, logs, and errors from the tool response.
