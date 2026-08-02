# Reference (types)
- type: `test`
- title: string
- tags: string[]
- description: string (supports Markdown; use `|-` for multiline)
- import: record&lt;string, string&gt; (`.mmt`, `.csv`, `.js`/`.cjs`/`.mjs`)
- inputs: record&lt;string, string | number | boolean | null&gt;
- outputs: record&lt;string, string | number | boolean | null&gt;
- cache: number \| string (optional; duration like `5m`, epoch number, or date/time text containing `:`)
- steps: array of step (alias: `flow`)
- stages: array of { id, title?, steps, condition?, after? }
- step types: `call`, `http`, `check`, `assert`, `if`, `for`, `repeat`, `delay`, `js`, `print`, `set`, `var`, `const`, `let`, `setenv`, `data`, `run`

Notes:
- `flow` is accepted as a backward-compatible alias for `steps`.
- The YAML editor provides autocomplete for `call` step names, check/assert operators, and input references.
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer `description` / step `title` for structured docs that survive UI edits.

---
