# Running a `.mmt` file (important)

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
