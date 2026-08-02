# Edit API

Open an API file in VS Code and click {{btn:edit:Edit API}} in the tester top bar to switch from the **API tester** to **edit mode**. Use the back control on the edit header to return to the tester.

Edits in edit mode write directly to the YAML file (unlike temporary tester changes, which can show an **Update YAML** / **Reset** warning).

## Tabs

| Tab | What you edit |
|---|---|
| {{btn:search:Overview}} | `title`, `tags`, `description` (with optional Markdown preview), `import`, `inputs`, `outputs`, `setenv` |
| {{btn:symbol-interface:Interface}} | `protocol`, `url`, `method`, `timeout`, `headers`, `query`, `cookies`, `body`, `auth`, request/response `format` |
| {{btn:lightbulb:Examples}} | Named examples — add, edit, or remove example blocks |

### Overview

| Field | Notes |
|---|---|
| `title` | Maps to `title:` |
| `tags` | Searchable tag chips; maps to `tags:` |
| `description` | Markdown editor with optional preview; maps to `description:` |
| `import` | Key/value alias → path pairs with file picker (JSON, YAML, CSV data files) |
| `inputs` | Parameter definitions used by `<<i:>>` tokens and the In / Out tab |
| `outputs` | Extraction expressions for response values |
| `setenv` | Capture response values into environment variables |

See [Documentation](./documentation.md) for description annotations and [Inputs](./inputs.md) / [Outputs](./outputs.md) for token syntax.

### Interface

The Interface tab is the structured editor for the request definition:

- `protocol` — HTTP, WebSocket, GraphQL, or gRPC
- `url` — base URL (query string is edited separately)
- `method` — HTTP verb when applicable
- `timeout` — per-request timeout in milliseconds
- `headers`, `query`, `cookies` — key/value editors
- `body` — request body with format selector (`json`, `xml`, `text`, `urlencoded`, `binary`, …)
- `auth` — none, bearer, basic, API key, or OAuth2
- `format` — separate request and response format pickers

Protocol-specific fields (GraphQL query, gRPC service/method, WebSocket message) appear when that protocol is selected. See [Protocols](./protocols/index.md).

### Examples

Each example block has a **name**, optional **inputs**, and optional **outputs**. Use **Add Example** to create a new block; remove with the delete control on each example.

Named examples appear in the tester **In / Out** tab dropdown and get run glyphs in the YAML editor when `name:` is non-empty. See [Examples](./examples.md).

---

See also: [API overview](./index.md) · [Quick start](./quick-start.md) · [Reference](./reference.md)
