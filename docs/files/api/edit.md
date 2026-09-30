# Edit API fields in the tester

API fields are edited inline in the **API tester** — there is no separate Edit API page. Edits write directly to the YAML.

## Where to edit

| Place | Fields |
|---|---|
| {{btn:settings-gear:Settings}} (first tab) | `timeout`, `auth`, `import`, `setenv` |
| **Doc** | `title`, `tags`, `description` — click the pencil next to a section to edit |
| **In/Out** | Declared `inputs` / `outputs` (pencil), runtime example **Inputs** / **Outputs**, soft **Expect** |
| **Params** / **Headers** / **Body** / **Cookies** | Request message fields (same as Send) |

### Settings

- `timeout` — per-request timeout in milliseconds
- `auth` — none, bearer, basic, API key, or OAuth2
- `import` — alias → path pairs with file picker (JSON, YAML, CSV)
- `setenv` — capture response values into environment variables

### Doc

Each of **Title**, **Tags**, and **Description** has a pencil control. View mode shows the rendered value (Markdown for description); edit mode shows the same boxes formerly on the Edit API page.

See [Documentation](./documentation.md) for description annotations.

### In/Out

- **Example** dropdown and soft **Expect** stay on this tab
- Pencil on **Inputs** / **Outputs** switches between runtime values (for Send) and declared defaults / extraction paths

Protocol-specific fields (GraphQL query, gRPC service/method, WebSocket message) appear on their protocol tabs. See [Protocols](./protocols/index.md).

---

See also: [API overview](./index.md) · [Quick start](./quick-start.md) · [Reference](./reference.md) · [Examples](./examples.md)
