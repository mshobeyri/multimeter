# Reference (types)
- `type:` `doc`
- `title:` string
- `description:` string (rendered as subtitle/intro; supports Markdown)
- logo: string (path or URL to logo image for the HTML header)
- `sources:` string[] (folders or `.mmt` files)
- services: array of { name?: string, description?: string, sources?: string[] }
- html: object with optional keys:
  - triable: boolean — enable interactive Try buttons
  - cors_proxy: string — CORS proxy URL prefix
- `env:` object — key-value pairs that replace `e:key` placeholders in the rendered output

---
