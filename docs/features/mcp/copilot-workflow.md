# Copilot workflow

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
