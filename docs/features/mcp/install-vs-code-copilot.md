# Install (VS Code + Copilot)

1. Install the **Multimeter** VS Code extension.
2. Build is included in the VSIX — no manual MCP config required.
3. Open a workspace with `.mmt` files.
4. Use **Copilot agent mode** and enable the **Multimeter** MCP server.

The extension registers the server via `mcpServerDefinitionProviders` in `src/mcpProvider.ts`.
