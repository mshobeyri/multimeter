# Multimeter agent workflow (MCP-first)

When the user asks to **create, modify, validate, format, or run** any `.mmt` file, use the **Multimeter MCP server tools first**. Do not explore npm packages, CLIs, or shell workarounds before calling MCP. Do not web-search Multimeter syntax.

## Golden rule

**If the task involves a `.mmt` file, start with Multimeter MCP tools in the first tool-call batch.**

Do **not** first try:
- `testlight`, `npx testlight`, or npm install/run (unless MCP is unavailable — then use `testlight scaffold` / docs)
- `node dist/mcp/server.js` or the `mmt-mcp` binary
- Reading Multimeter source, tarball contents, or package.json to find a runner
- Guessing YAML syntax from memory or random repo files
- Inventing a new test from blank without `scaffold_test`

## Decision tree

| User intent | First MCP tool(s) | Then |
|-------------|-------------------|------|
| Generate test from API | **`scaffold_test`** | Write returned yaml → minimal edits → `validate` |
| Inspect one API | **`api_card`** | Prefer over full file / OpenAPI dump |
| Create or change other types | `read_documentation(topic)` (pack **min**) | Edit/patch → `validate` → `format` (optional) |
| Change existing `.mmt` file | `read_documentation(topic)` if needed | **Patch only** → `validate` |
| List APIs | `discover_api` | Then `api_card` / `scaffold_test` |
| Run or execute `.mmt` | `run({ file, workspaceRoot })` | Report `success`, logs, errors |
| Unsure of syntax | `read_documentation` (min; `pack: full` if needed) | Use returned docs, not web search |
| Need examples | `list_examples` | Follow patterns, then `validate` |
| Offline / no MCP | see `offline-agent.md` | `testlight docs` → `scaffold` → `validate` |

## Generate test from API (required)

1. `scaffold_test({ workspaceRoot, apiPath, strategy?: "smoke"|"example" })`
2. Write `yaml` to `suggestedPath` (or user path).
3. Apply **only minimal** edits (asserts, inputs, title).
4. `validate({ file, workspaceRoot })` until `valid: true`.
5. Optional `format` / `run` when asked.

## Modify workflow (required)

When the user asks to **modify**, **update**, **fix**, or **add steps** to a `.mmt` `file:`

1. `read_documentation(topic: "<type>")` when syntax is unclear.
2. If helpful, `discover_api({ workspaceRoot, apiPath })`.
3. **Patch** the workspace file — do not rewrite the whole file.
4. **`validate({ file, workspaceRoot })` immediately after every edit.**
5. Fix validation errors; call `validate` again until `valid: true`.
6. Optionally `format({ file, workspaceRoot })`.
7. Only call `run` when the user asks to execute.

## Run workflow (required)

When the user asks to **run**, **execute**, or **test** a `file:`

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
