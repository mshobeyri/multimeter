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

- title: Page title shown in the header
- sources: Array of folders and/or `.mmt` files to include
- services: Optional array of groups with `name`, `description?`, and `sources`

The editor’s Doc view:
- Renders a sticky header with logo (if configured), title, and a search box
- Lets you filter API boxes by typing in the search field (matches text in the box)
- Each API row is expandable; details include URL, inputs, headers, cookies, body, outputs, and examples when present
  - Example blocks may include their own inputs and outputs when provided

---

## Legacy compatibility
Older fields are mapped to `sources` automatically when reading YAML:

```yaml
type: doc
title: Legacy
files: [a.mmt]
folders: [apis]
services:
  - name: A
    files: [b.mmt]
    folders: [svc]
```

These are normalized to `sources` at runtime. When saving from the UI, only `sources` is written.

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

## Reference (types)
- type: `doc`
- title: string
- sources: string[] (folders or `.mmt` files)
- services: array of { name?: string, description?: string, sources?: string[] }
