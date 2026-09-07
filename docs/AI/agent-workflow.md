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
- Rewriting an entire `.mmt` file when the user asked to change one part

## Decision tree

| User intent | First MCP tool(s) | Then |
|-------------|-------------------|------|
| Generate test from API | **`scaffold_test`** | Write yaml → minimal edits → **`validate` → `format`** |
| Need few-shot shape | **`list_examples`** (see `goldenSmoke`) | Mirror pair; still call `scaffold_test` |
| Inspect one API | **`api_card`** | Prefer over full file / OpenAPI dump |
| Tighten asserts (after run or from outputs) | **`suggest_assertions`** | Patch only → **`validate` → `format`** |
| Create or change other types | `read_documentation(topic)` (pack **min**) | Patch → **`validate` → `format`** |
| Change existing `.mmt` file | (docs only if needed) | **Patch only** → **`validate` → `format`** |
| List APIs | `discover_api` | Then `api_card` / `scaffold_test` |
| Run or execute `.mmt` | `run({ file, workspaceRoot })` | Report tool JSON; if user wants stronger asserts → `suggest_assertions` |
| Unsure of syntax | `read_documentation` (min; `pack: full` if needed) | Local docs only — no web |
| Offline / no MCP | see `offline-agent.md` | `testlight docs` → `scaffold` → `validate` |

## Generate test from API (required)

1. Optional: `list_examples` and mirror **`goldenSmoke`** (do not invent a different structure).
2. `scaffold_test({ workspaceRoot, apiPath, strategy?: "smoke"|"example" })`
3. Write `yaml` to `suggestedPath` (or user path).
4. Apply **only minimal** edits (asserts, inputs, title).
5. **`validate({ file, workspaceRoot })` until `valid: true`.**
6. **`format({ file, workspaceRoot })` after validate passes** (required on generate).
7. `run` only when the user asks to execute.
8. If the user then wants stronger asserts from a response: `suggest_assertions` → patch → validate → format.

## Modify workflow (required)

When the user asks to **modify**, **update**, **fix**, or **add steps** to a `.mmt` `file:`

1. `read_documentation(topic: "<type>")` only when syntax is unclear (pack **min**).
2. If helpful, `api_card` / `discover_api`.
3. **Patch only** — change the few lines needed. **Do not rewrite the whole file** unless the user explicitly asks for a rewrite/regenerate.
4. **`validate` immediately after every edit** until `valid: true`.
5. **`format` after validate passes.**
6. Only call `run` when the user asks to execute.

## Run → tighten asserts (optional)

When the user wants better assertions after a successful (or inspected) run:

1. `suggest_assertions` with `apiPath` and/or response `body` / `bodyFile`
2. Patch `expect` / `assert` lines only
3. `validate` → `format`

## Validation + format are mandatory

After **every** generate or modify on `.mmt` files:

1. `validate` until valid  
2. `format`  
before telling the user the task is done.

## YAML rules (always)

- Output valid Multimeter YAML only.
- First non-comment line must be `type: <api|test|env|...>`.
- Never add YAML comments (`#`).
- Use snake_case tokens: `e:api_url`, `i:user_id`, `r:uuid`, `c:epoch_ms`.
