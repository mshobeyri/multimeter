# Reference (types)
- `type:` `suite`
- `title:` string
- `description:` string (supports Markdown)
- `tags:` string[]
- `filter:` object (or a list, treated as `only`)
  - `only:` string[] — run only tests/suites that have at least one of these tags (OR). Empty = all.
  - `skip:` string[] — do not run tests/suites that have any of these tags (OR). Empty = none.
  - Combined: `run iff matches only && !matches skip`. Nested running suites AND `only` lists and OR `skip` lists.
- `servers:` string[] (paths to `type: server` `.mmt` files — started before tests, kept running for the suite; nested suites apply this when that suite runs)
- `export:` string[] (root-only, paths to report files)
- `items:` string[] (paths to `.mmt` files; use `then` to separate sequential stages; `tests` is a legacy alias)
- `environment:` object (root-only)
  - `preset:` string
  - `file:` string
  - `variables:` object

---
