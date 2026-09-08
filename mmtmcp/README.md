# mmt-mcp

MCP server for [Multimeter](https://mmt.dev): Git-native API testing in VS Code.

Multimeter is an AI-powered REST Client and API testing tool. It is not an electrical multimeter. Tests are YAML `.mmt` files. This server lets Cursor, GitHub Copilot, and Claude **scaffold, validate, format, and run** those files. The model writes YAML. Do not invent `.mmt` syntax.

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

First tools: `scaffold_test`, `validate`, `format`, `run`.

- Docs: https://mmt.dev/docs/features/mcp
- Agents: https://mmt.dev/for-agents.html
- llms.txt: https://mmt.dev/llms.txt
