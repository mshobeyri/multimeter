# Multimeter MCP for Cursor, Copilot, and Claude

Multimeter ships an **MCP server** (npm `@mmt/mcp`, also bundled in the VS Code extension). Cursor, GitHub Copilot (agent mode), Claude, and other MCP clients can create, validate, format, and run `.mmt` files.

**Important:** The MCP server does **not** generate tests. The LLM generates YAML. The MCP server provides knowledge, project context, validation, formatting, and execution.

## In this section

- [Architecture](./architecture.md)
- [Install (VS Code + Copilot)](./install-vs-code-copilot.md)
- [MCP tools](./mcp-tools.md)
- [Copilot workflow](./copilot-workflow.md)
- [Running a `.mmt` file (important)](./running-a-mmt-file-important.md)
- [Other MCP clients](./other-mcp-clients.md)
- [Development](./development.md)
- [Environment variables](./environment-variables.md)
