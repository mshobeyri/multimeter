This file tells the AI how to generate **`type: doc`** `.mmt` files.

Doc files describe how to build HTML/Markdown documentation from existing `.mmt` API files.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be `type: doc`.
- Do **not** redefine APIs here; instead, point to files/folders containing `type: api` definitions.

---

## Schema (mental model for the AI)

This matches `DocData` in `core/src/DocData.ts` and `docs/doc-mmt.md`.

Top-level keys and types:

```yaml
type: doc                       # REQUIRED, must be exactly "doc"

title?: string                  # title of the documentation page
description?: string            # optional description or intro text
logo?: string                   # optional path/URL to a logo image
sources?:                       # list of folders/files to scan for APIs
  - string
services?:                      # optional logical groupings
  - name?: string
    description?: string
    sources?:
      - string
```

Notes:
- `sources` and each service’s `sources` can include:
  - Direct paths to `.mmt` files.
  - Folders containing `.mmt` files (recursively scanned).
- Only `type: api` entries discovered in those paths are rendered as API boxes.

---

## Common patterns the AI should generate

### 1. Single-folder API catalog

User asks: "Generate docs for all APIs in `./apis`."

```yaml
type: doc
title: API Catalog
sources:
  - ./apis
```

### 2. Multi-service catalog with groupings

User asks: "We have user and order services under different folders; build docs for both."

```yaml
type: doc
title: Platform APIs
description: Documentation for core platform services.
sources:
  - ./shared
services:
  - name: Users
    description: User registration, login, and profile APIs.
    sources:
      - ./services/users
  - name: Orders
    description: Order creation, tracking, and status APIs.
    sources:
      - ./services/orders
```

### 3. Mixed single files and folders

```yaml
type: doc
title: Authentication APIs
sources:
  - ./auth/login.mmt
  - ./auth/refresh.mmt
  - ./auth
```

---

## How the AI should answer doc-related questions

- If the user mentions **"generate documentation"**, **"API catalog"**, or similar, prefer `type: doc`.
- If the user provides a list of API files or folders, put them in `sources` and optionally group them under `services` if they describe separate domains.
- If the user wants a **logo** or branding, set `logo` to a relative path or URL (do not invent images; reuse what they mention).

---

## Style rules for the AI

- Use 2-space indentation.
- Keep titles short and descriptive.
- Keep service names in Title Case (e.g. `Users`, `Billing`).
- Prefer concise descriptions (1–2 sentences per service).

When unsure, generate a **small doc file** that points to the most obvious folder(s) the user mentioned (such as `./apis` or `./examples`).
