# Doc (type: doc)

Create aggregated, Swagger-like documentation from your `.mmt` files. A `doc` file lists folders and files to scan, then renders a searchable HTML page in the editor UI.

Supported:
- Sources: folders and/or individual `.mmt` files
- Services: optional groupings (each with its own sources)
- Auto-rendered HTML with sticky header (logo, title, search) and expandable API boxes

---

## Quick start

```yaml
type: doc
title: My APIs
sources:
  - ./examples
  - ./api1.mmt
```

This scans the `examples` folder plus a single file and renders all `type: api` files it finds.

### Group by services (optional)
```yaml
type: doc
title: Service Catalog
sources:
  - ./shared
services:
  - name: Accounts
    description: Endpoints for authentication and account management
    sources:
      - ./services/accounts
  - name: Billing
    description: Invoicing and payment endpoints
    sources:
      - ./services/billing
```

Notes
- Each service’s `sources` accepts folders or `.mmt` files.
- The UI lists all APIs found; grouping may be reflected in future UI refinements.

---

## Elements
The `doc` type is intentionally small:

- title: page title shown in the header
- description: introductory text shown below the title in the rendered output
- logo: path or URL to a logo image, displayed in the HTML header
- sources: array of folders and/or `.mmt` files to include
- services: optional array of groups with `name`, `description?`, and `sources`

The editor’s Doc view:
- Renders a sticky header with logo (if configured), title, and a search box
- Lets you filter API boxes by typing in the search field (matches text in the box)
- Each API row is expandable; details include URL, inputs, headers, cookies, body, outputs, and examples when present
  - Example blocks may include their own inputs and outputs when provided

---

## Complete example

```yaml
type: doc
title: Platform APIs
sources:
  - ./apis
services:
  - name: Users
    description: Core user CRUD and profile
    sources:
      - ./services/users
  - name: Orders
    description: Order placement, tracking, and status
    sources:
      - ./services/orders
```

Open this file in VS Code; the Doc view renders an interactive, searchable page of APIs.

---

## Try It (interactive API testing)

Add `html.triable: true` to enable Swagger-like "Try" buttons on every endpoint in the HTML doc:

```yaml
type: doc
title: My APIs
sources:
  - ./apis
html:
  triable: true
```

Each endpoint gets a **Try** button on the right side of its header. Clicking it slides open an interactive panel where you can:
- Edit the URL, method, query parameters, headers, and body
- Click **Send** to fire a real HTTP request from the browser
- See the response status, headers, body (auto-formatted JSON), and timing

Each example also gets a small **Try** button that pre-fills the panel with that example's inputs.

### CORS

Browser security blocks requests to APIs on different domains unless the API server sets `Access-Control-Allow-Origin` headers. If your API server doesn't set these headers, you can route requests through a CORS proxy:

```yaml
html:
  triable: true
  cors_proxy: "https://corsproxy.io/?"
```

The proxy URL is prepended to the target URL when sending requests.

---

## Environment variables

Use the `env` key at the doc root to define key-value pairs that replace `e:key` placeholders across all API content in both HTML and Markdown output:

```yaml
type: doc
title: My APIs
sources:
  - ./apis
env:
  url: http://localhost:8080
  token: my-secret-token
```

Every occurrence of `e:url` in API URLs, headers, bodies, descriptions, inputs, query parameters, cookies, and examples is replaced with `http://localhost:8080`. Similarly, `e:token` becomes `my-secret-token`.

Placeholders are resolved **once** at render time. The doc-level `title` and `description` are also resolved.

---

## Parameter annotations in API descriptions

API `description` fields support special annotations that document input and output parameters. These annotations are parsed and displayed as parameter description columns in both HTML and Markdown output.

Syntax:
- `<<i:param_name>> description text` — documents an input parameter
- `<<o:param_name>> description text` — documents an output parameter

Example API file:
```yaml
type: api
title: Create user
description: |
  Create a new user account.

  <<i:username>> The desired username (3-20 characters)
  <<i:email>> User email address
  <<i:role>> User role: admin, editor, or viewer

  <<o:id>> The generated user ID
  <<o:created_at>> ISO 8601 timestamp of account creation
inputs:
  username: string
  email: string
  role: viewer
method: post
url: <<e:API_URL>>/users
```

In the rendered doc, each `<<i:...>>` and `<<o:...>>` annotation appears as a row in the parameter table for that API.

---

## Markdown in API descriptions

API `description` fields support a subset of Markdown formatting that renders in both the editor UI and the generated documentation:

- `**bold**` and `*italic*`
- `` `inline code` ``
- `> headings` (blockquote-style headings)
- Bullet lists (`-` or `*`) and numbered lists (`1.`)
- Pipe tables (`| col1 | col2 |`)
- `ref path/to/file.md#section` — file reference link (highlighted in HTML, clickable in editor and preview)

This applies to descriptions in both `type: api` files and the doc-level `description` field.

---

## Reference (types)
- type: `doc`
- title: string
- description: string (rendered as subtitle/intro; supports Markdown)
- logo: string (path or URL to logo image for the HTML header)
- sources: string[] (folders or `.mmt` files)
- services: array of { name?: string, description?: string, sources?: string[] }
- html: object with optional keys:
  - triable: boolean — enable interactive Try buttons
  - cors_proxy: string — CORS proxy URL prefix
- env: object — key-value pairs that replace `e:key` placeholders in the rendered output

---

## See also
- [API](./api-mmt.md) — define the APIs that doc files scan and render
- [Test](./test-mmt.md) — orchestrate flows calling APIs
- [Environment](./environment-mmt.md) — variables and presets used by `e:VAR` tokens in docs
- [Suite](./suite-mmt.md) — group and run multiple tests together
- [Mock Server](./mock-server.md) — mock server files that can appear alongside APIs
- [Testlight CLI](./testlight.md) — generate docs from the command line (`testlight doc`)
- [Convertor](./convertor.md) — import OpenAPI/Postman specs, then document them with `type: doc`
- [Sample Project](./sample-project.md) — full walkthrough with APIs, tests, suites, and docs
