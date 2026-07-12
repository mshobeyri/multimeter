# Multimeter agent workflow (MCP-first)

When the user asks to **create, modify, validate, format, or run** any `.mmt` file, use the **Multimeter MCP server tools first**. Do not explore npm packages, CLIs, or shell workarounds before calling MCP.

## Golden rule

**If the task involves a `.mmt` file, start with Multimeter MCP tools in the first tool-call batch.**

Do **not** first try:
- `testlight`, `npx testlight`, or npm install/run
- `node dist/mcp/server.js` or the `mmt-mcp` binary
- Reading Multimeter source, tarball contents, or package.json to find a runner
- Guessing YAML syntax from memory or random repo files

## Decision tree

| User intent | First MCP tool(s) | Then |
|-------------|-------------------|------|
| Create or change test/api/env/suite | `read_documentation(topic)` | Edit file → `validate` → `format` (optional) |
| Change existing `.mmt` file | `read_documentation(topic)` for that type | Edit file → `validate` |
| Generate test from API | `discover_api` + `read_documentation(topic: "test")` | Write file → `validate` |
| Run or execute `.mmt` | `run({ file, workspaceRoot })` | Report `success`, logs, errors |
| Unsure of syntax | `read_documentation` | Use returned docs, not web search |
| Need examples | `list_examples` | Follow patterns, then `validate` |

## Modify workflow (required)

When the user asks to **modify**, **update**, **fix**, or **add steps** to a `.mmt` file:

1. `read_documentation(topic: "<type>")` — pick `test`, `api`, `suite`, etc.
2. If the file imports APIs, call `discover_api({ workspaceRoot, apiPath })` when helpful.
3. Apply the edit to the workspace file.
4. **`validate({ file, workspaceRoot })` immediately after every edit.**
5. Fix validation errors; call `validate` again until `valid: true`.
6. Optionally `format({ file, workspaceRoot })`.
7. Only call `run` when the user asks to execute.

## Run workflow (required)

When the user asks to **run**, **execute**, or **test** a file:

```
run({ file: "<path/to/file.mmt>", workspaceRoot: "<workspace root>" })
```

Return the MCP tool JSON (`success`, `logs`, `failures`, `errors`). Do not substitute shell commands.

## Validation is mandatory

After **every** generate or modify operation on `.mmt` files, call `validate` before telling the user the task is done.

## YAML rules (always)

- Output valid Multimeter YAML only.
- First non-comment line must be `type: <api|test|env|...>`.
- Never add YAML comments (`#`).
- Use snake_case tokens: `e:api_url`, `i:user_id`, `r:uuid`, `c:epoch_ms`.
