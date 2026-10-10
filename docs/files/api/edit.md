# Edit API fields in the tester

API fields are edited inline in the **API tester** — there is no separate Edit API page. Edits write directly to the YAML.

## Where to edit

| Place | Fields |
|---|---|
| {{btn:settings-gear:Settings}} (first tab) | `timeout`, `import` |
| **Auth** | `auth` — none, bearer, basic, API key, or OAuth2 |
| **Doc** | `title`, `tags`, `description` — click the pencil next to a section to edit |
| **Inputs** (request) | Declared `inputs` (pencil), runtime example values, soft **Expect** |
| **Outputs** (response) | Declared `outputs` / `setenv` (pencil); view mode shows extracted / env values after Send |
| **Params** / **Headers** / **Body** / **Cookies** | Request message fields (same as Send) |

### Settings

- `timeout` — per-request timeout in milliseconds
- `import` — alias → path pairs with file picker (JSON, YAML, CSV)

### Auth

- `auth` — none, bearer, basic, API key, or OAuth2 (see [Auth](./auth.md))

### Doc

Each of **Title**, **Tags**, and **Description** has a pencil control. View mode shows the rendered value (Markdown for description); edit mode shows the same boxes formerly on the Edit API page.

See [Documentation](./documentation.md) for description annotations.

### Inputs / Outputs

- **Inputs** (request pane): Example dropdown, soft **Expect**, and declared/runtime inputs
- **Outputs** (response pane): pencil switches between extraction paths and values after Send; **Setenv** works the same way (edit expressions / view env values written after Send)

Protocol-specific fields (GraphQL query, gRPC service/method, WebSocket message) appear on their protocol tabs. See [Protocols](./protocols/index.md).

---

See also: [API overview](./index.md) · [Quick start](./quick-start.md) · [Reference](./reference.md) · [Examples](./examples.md)
