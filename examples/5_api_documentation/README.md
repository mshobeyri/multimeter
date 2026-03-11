# Example 5 — API Documentation

Generate a Swagger-like HTML documentation page from your `.mmt` API files.

## What's inside

| File | Description |
|---|---|
| `api/get_users.mmt` | GET endpoint — list users |
| `api/post_create_user.mmt` | POST endpoint — create a user |
| `api/ws_notifications.mmt` | WebSocket — subscribe to notifications |
| `markdown_api/search_products.mmt` | GET — description with `> headings`, **bold**, *italic*, pipe tables, and bullet lists |
| `markdown_api/submit_order.mmt` | POST — description with numbered lists, status-code table, `ref` link, and `<<i:>>`/`<<o:>>` annotations |
| `markdown_api/health_check.mmt` | GET — entire description loaded from a Markdown file via `ref overview.md#health-check` |
| `markdown_api/overview.md` | Shared Markdown file referenced by `ref` links in API descriptions |
| `document.mmt` | Doc file that renders all the above as an interactive HTML page |

## How to use

1. Open `document.mmt` in VS Code with the Multimeter extension installed.
2. The editor renders a searchable HTML page listing all three APIs.
3. Expand any row to see URL, inputs, outputs, body, and parameter descriptions.
4. Click the **Try** button on any endpoint to send a live request from the browser.

## Concepts demonstrated

- **`type: doc`** scans a folder for `type: api` files and renders them
- **`html.triable: true`** adds interactive Try buttons to every endpoint
- **`<<i:param>>` / `<<o:param>>` annotations** in API `description` fields become parameter documentation columns
- **Markdown in descriptions** — `**bold**`, `*italic*`, `` `code` ``, `> headings`, bullet/numbered lists, pipe tables
- **`ref` file links** — `ref overview.md#section` loads description from a shared Markdown file
- **`services`** grouping — organize APIs into logical groups in the rendered doc
- Mixed protocols (HTTP GET, HTTP POST, WebSocket) in a single doc
