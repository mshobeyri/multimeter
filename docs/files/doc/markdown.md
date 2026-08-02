# Markdown in API descriptions

API `description` fields support a subset of Markdown formatting that renders in both the editor UI and the generated documentation:

- `**bold**` and `*italic*`
- `` `inline code` ``
- `> headings` (blockquote-style headings)
- Bullet lists (`-` or `*`) and numbered lists (`1.`)
- Pipe tables (`| col1 | col2 |`)
- `path/to/file.md#section` — file reference link (auto-detected when single token with `.md#`; highlighted in HTML, clickable in editor and preview)

This applies to descriptions in both `type: api` files and the doc-level `description` field.

---
