# Curl

Import and run HTTP requests with curl in VS Code.

## Paste to convert

Paste a `curl ...` command into an API editor (YAML side). Multimeter detects it and converts the paste into `type: api` YAML you can edit and send.

## Run in Curl

For HTTP APIs in the tester, right-click {{btn:send:Send}} and choose **Run in Curl**. Multimeter builds curl commands from the current request (method, URL, headers, body, environment) and:

- Runs the variant that matches your default terminal (Bash/Zsh, PowerShell, or CMD)
- Copies a reference block to the clipboard with **Bash**, **PowerShell**, and **CMD** variants

Shared flags are the same across shells (`-X`, `-H`, `--data-raw`, certificate options). Only quoting differs:

| Shell | Executable | Quoting |
|-------|------------|---------|
| Bash / macOS / Linux / Git Bash / WSL | `curl` | Single quotes (`'…'`) |
| PowerShell (Windows) | `curl.exe --% …` | Native quoting after stop-parsing (avoids the `Invoke-WebRequest` alias) |
| CMD (Windows) | `curl` | Double quotes with `""` for embedded `"` |

Available for HTTP only — not GraphQL, gRPC, or WebSocket.

## See also

- [HTTP protocol](../files/api/protocols/http.md) · [API tester](../files/api/index.md)
