---
name: run-mmt-file
description: Run a Multimeter .mmt file with the MCP run tool
argument-hint: path/to/file.mmt
---

# Run a Multimeter file

Target file: $ARGUMENTS

Call the Multimeter MCP **`run`** tool:

```
run({ file: "<target file>", workspaceRoot: "<workspace root>" })
```

Do **not** use testlight, npx, npm, shell, or `node dist/mcp/server.js`.

Return `success`, `logs`, `failures`, and `errors` from the MCP response.
