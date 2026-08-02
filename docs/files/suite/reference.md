# Reference (types)
- `type:` `suite`
- `title:` string
- `description:` string (supports Markdown)
- `tags:` string[]
- `servers:` string[] (paths to `type: server` `.mmt` files — started before tests, kept running for the suite)
- `export:` string[] (root-only, paths to report files)
- `items:` string[] (paths to `.mmt` files; use `then` to separate sequential stages; `tests` is a legacy alias)
- `environment:` object (root-only)
  - `preset:` string
  - `file:` string
  - `variables:` object

---
