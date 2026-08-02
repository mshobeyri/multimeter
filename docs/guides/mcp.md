# Multimeter MCP for GitHub Copilot

Multimeter ships a bundled **MCP server** with the VS Code extension. GitHub Copilot (agent mode) and other MCP clients can use it to create, validate, format, and run `.mmt` files.

**Important:** The MCP server does **not** generate tests. The LLM generates YAML. The MCP server provides knowledge, project context, validation, formatting, and execution.

## Architecture

```
User: "Generate tests for this API"
        │
        ▼
GitHub Copilot (LLM)
        │
        ├─ read_documentation(topic: "test")
        ├─ discover_api(workspaceRoot, apiPath)
        ├─ writes .mmt file in workspace
        ├─ validate(file)
        ├─ format(file)            [optional]
        └─ run(file)               [optional]
        │
        ▼
mmtmcp/ (stdio MCP server, bundled in VSIX)
        │
        ▼
core/ (parse, validate, format, runner)
```

## Install (VS Code + Copilot)

1. Install the **Multimeter** VS Code extension.
2. Build is included in the VSIX — no manual MCP config required.
3. Open a workspace with `.mmt` files.
4. Use **Copilot agent mode** and enable the **Multimeter** MCP server.

The extension registers the server via `mcpServerDefinitionProviders` in `src/mcpProvider.ts`.

## MCP tools

| Tool | Purpose |
|------|---------|
| `read_documentation` | Multimeter DSL docs: test, api, loadtest, suite, env, constraints |
| `list_examples` | Example `.mmt` files and common patterns |
| `discover_api` | List workspace APIs or inspect one API file for test generation |
| `validate` | Validate a file on disk; returns errors and suggestions |
| `format` | Canonical Multimeter formatting |
| `run` | Execute a test/API and return structured results |

## Copilot workflow

**Use MCP tools in the first tool-call batch** — do not explore CLIs or npm packages first.

```
1. read_documentation(topic: "workflow" | "test" | ...)   ← start here
2. discover_api({ workspaceRoot, apiPath })                 ← when APIs involved
3. Copilot edits the file in the workspace
4. validate({ file, workspaceRoot })                        ← required after every edit
5. fix → validate again until valid
6. format({ file })                                         ← optional
7. run({ file, workspaceRoot })                             ← when user asks to run
```

The extension also contributes `chatInstructions` and prompt files (`EditMmtFile`, `RunMmtFile` under `commands/`) that auto-apply when working with `.mmt` files (VS Code 1.105+).

## Running a `.mmt` file (important)

When you ask Copilot to **run** a test or API file, it must call the **`run` MCP tool**:

```
run({ file: "tests/echo_test.mmt", workspaceRoot: "/path/to/workspace" })
```

Copilot should **not**:
- run `testlight` or `npx testlight`
- run `node dist/mcp/server.js` directly
- install npm packages or debug the MCP tarball
- use the `mmt-mcp` binary as a CLI runner (`mmt-mcp` is the MCP stdio server only)

If Copilot tries shell/CLI workarounds instead of the `run` tool, check that:
1. **Copilot agent mode** is enabled
2. The **Multimeter** MCP server is enabled in the MCP tools list
3. You are on a recent VS Code build with MCP support (1.101+ recommended)

## Other MCP clients

The same server works in Cursor and CLI inspectors.

### Cursor / manual config

Project files:

- `.cursor/mcp.json`
- `.vscode/mcp.json` (reference)

Build first:

```bash
npm run buildmcp
```

### MCP Inspector

```bash
npm run test:mcp
```

Open http://localhost:6274 and invoke tools directly.

## Development

```bash
npm run buildmcp     # build core + mmtmcp + copy to dist/mcp
npm run compile      # full extension build
```

Layout:

```
mmtmcp/                 MCP server package
  src/server.ts         tool registration
  src/tools/handlers.ts tool implementations
  src/resources/        docs + examples helpers
src/mcpProvider.ts      VS Code extension registration
dist/mcp/               bundled into VSIX
  server.js
  guides/
  examples/
  node_modules/
core/src/mmtFormat.ts   canonical formatting
```

## Environment variables

| Variable | Set by | Purpose |
|----------|--------|---------|
| `MMT_GUIDES_DIR` | extension | bundled AI docs |
| `MMT_EXAMPLES_DIR` | extension | bundled examples |
| `MMT_WORKSPACE_ROOT` | extension | current workspace root |
| `NODE_PATH` | extension | MCP runtime dependencies |
