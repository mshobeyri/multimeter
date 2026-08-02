# Architecture

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
