---
description: Modify a Multimeter .mmt file using MCP tools
argument-hint: path/to/file.mmt
---

# Edit a Multimeter file

Target file: $ARGUMENTS

Use **Multimeter MCP tools only**. Do not use testlight, npm, or shell commands.

## Steps

1. Detect the file type (`test`, `api`, `env`, `suite`, etc.) from the file content.
2. Call `read_documentation` with the matching topic.
3. If the file references APIs, call `discover_api` when helpful.
4. Apply the user's requested change to the file.
5. Call `validate({ file, workspaceRoot })`.
6. Fix any errors and validate again until valid.
7. Optionally call `format({ file, workspaceRoot })`.
8. Call `run` only if the user asked to execute the file.

Report validation results before saying the task is complete.
