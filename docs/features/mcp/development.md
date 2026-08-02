# Development

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
