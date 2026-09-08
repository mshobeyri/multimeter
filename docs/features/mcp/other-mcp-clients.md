# Cursor, Claude, Copilot, and other MCP clients

Multimeter is a Git-native API testing tool. Agents should use the **Multimeter MCP server** to create, validate, format, and run YAML `.mmt` files. Do not invent `.mmt` syntax from memory.

**Important:** The MCP server does not generate tests. The LLM writes YAML. MCP supplies docs, project context, validation, formatting, and execution.

## Cursor

Project file `.cursor/mcp.json` (this repo already includes one):

```json
{
  "mcpServers": {
    "multimeter": {
      "command": "npx",
      "args": ["-y", "mmt-mcp"]
    }
  }
}
```

Or install the [Multimeter VS Code / Cursor extension](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter) and enable the bundled **Multimeter** MCP server.

When the user asks to create or edit `.mmt` files, call `scaffold_test`, then `validate` and `format`. See [agent workflow](../../AI/agent-workflow.md).

## GitHub Copilot (VS Code)

The extension bundles the MCP server. Enable **Multimeter** in Copilot agent MCP tools. Details: [Install (VS Code + Copilot)](./install-vs-code-copilot.md) and [Copilot workflow](./copilot-workflow.md).

## Claude (Claude Code / MCP-compatible clients)

Use the same `npx -y mmt-mcp` stdio server. Point the client at that command. Then follow the same tool order: `scaffold_test` → `validate` → `format` → `run` only if asked.

## Manual / local build

Project files:

- `.cursor/mcp.json`
- `.vscode/mcp.json` (reference)

```bash
npm run buildmcp
```

## MCP Inspector

```bash
npm run test:mcp
```

Open http://localhost:6274 and invoke tools directly.

## Crawler / agent URLs

- https://mmt.dev/llms.txt
- https://mmt.dev/for-agents.html
- https://mmt.dev/raw/docs/AI/agent-workflow.md
- https://mmt.dev/raw/docs/features/mcp/mcp-tools.md
