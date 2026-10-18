# Project layout (multi-API / real projects)

When the user wants a **large** Multimeter project (several APIs + tests, `{product}-mmt`, real-project regression) and does **not** ask for a different layout, follow this. Skip for tiny single-file smoke work.

Full guide: [Start a Multimeter project](../tasks/start-a-project.md). Example: `examples/real-projects/open-meteo-mmt/`.

## Structure

```
multimeter.mmt          # type: env at project root (not env.mmt)
suite.mmt               # root → test/<area>/suite.mmt
api/*.mmt
test/<area>/
  suite.mmt             # first file alphabetically
  test_*.mmt            # prefix test_ — not *_test
```

No top-level `suites/` folder.

## Paths

- Tests import APIs with `+/api/….mmt` (needs `multimeter.mmt` at root).
- Same-folder suite items: relative (`test_foo.mmt`) — no `+/`.
- Do not invent `../../api/…` when a project root exists.

## API

- Order: `url` → `query` → `method` → rest.

## Tests

- Several input variants per API (locations, horizons, windows) — not one smoke call.
- Single-output validations → call `expect` / `require` (list form OK). `report: all`.
- `check` / `assert` only for **two different** values. Object form: `actual` → `operator` → `expected`.
- **Never quote** operator expects: `>=# 24`, `!= null`, `=1d~ <<c:datetime>>` — not `'>=# 24'`.
- Live times: `=Ns~ <<c:datetime>>` / `<<c:date>>` (not `c:time`, not datetime regex).
- Fixed past/future windows: exact / `=^` vs `e:` dates.

## Suites

- Parallel by default; use `then` only when sequencing is required.
