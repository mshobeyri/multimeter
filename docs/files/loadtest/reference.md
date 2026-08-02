# Reference (types)

- `type:` `loadtest`
- `title:` string
- `description:` string (supports Markdown)
- `tags:` string[]
- `import:` record&lt;string, string&gt; — see [Data imports](../../features/data-imports.md)
- `test:` string — required; path to a `type: test` `.mmt` file
- `threads:` number (default `1`)
- `repeat:` string | number — required; duration (e.g. `1m`, `10s`) or total iteration count
- `rampup:` string (default `0s`; e.g. `10s`, `30s`)
- `environment:` object — same shape as suite environment
  - `preset:` string
  - `file:` string
  - `variables:` object
- `export:` string[] (paths to report files — see [Exports](./exports.md))

Notes:
- Numeric `repeat` is a **total** iteration count across all threads, not per-thread.
- Duration `repeat` keeps starting iterations until the duration expires.
- `environment` and `export` only take effect when the load test is the root entry point (run directly).

---
