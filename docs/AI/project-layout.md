# Project layout (start a Multimeter project)

**Mother doc (users + AI):** [Start a Multimeter project](../tasks/start-a-project.md) — especially [Where values live (env vs JSON vs direct)](../tasks/start-a-project.md#where-values-live-env-vs-json-vs-direct).

When the user wants to **start or scaffold a Multimeter project** with several APIs and tests, and does **not** ask for a different layout, follow that guide. This page is the short checklist for AI; do not invent a different structure.

Skip for a single smoke API or one test file unless the user asks for the full layout.

YAML names and trees in either doc are **examples of the general rules**. `examples/real-projects/open-meteo-mmt/multimeter/` is an optional concrete sample — not required labels.

## Structure

```
multimeter.mmt          # type: env at project root (not env.mmt)
*.json / data/…         # optional fixed catalogs (not scenario dates)
suite.mmt               # root → test/<area>/suite.mmt
api/*.mmt
test/<area>/
  suite.mmt             # first file alphabetically
  test_*.mmt            # prefix test_ — not *_test
```

No top-level `suites/` folder.

## Where values live (summary)

Decide once per value — full rules in the mother doc:

| Place | Put here when… | Examples |
|---|---|---|
| **Env** | User changes it at run time; or API **Send** default | Hosts, secrets, `city` choice for interactive Send |
| **JSON/CSV/YAML** | Fixed shared catalog, same meaning in every test | City lat/lon, sample user ids |
| **Direct in the test** | Scenario-specific; any valid value works for that case | Date windows, `forecast_days`, one-off payloads |

- APIs may use `e:` / `e:name.field` for Send defaults.
- Tests: catalog → `${alias…}`; scenario → literals; **not** `e:city…` / `e:history_…` for the named case under test.

## Paths

- Tests import APIs/fixtures with `+/…` (needs `multimeter.mmt` at root).
- Same-folder suite items: relative (`test_foo.mmt`) — no `+/`.
- Do not invent `../../…` when a project root exists.

## API

- Order: `url` → `query` → `method` → rest.
- User-tunable Send defaults from env; scenario defaults may be literals on the API.

## Tests

- Apply the where-values table for every input.
- Several input variants per API — not one smoke call.
- Single-output validations → call `expect` / `require` (list form OK). `report: all`.
- `check` / `assert` only for **two different** values. Object form: `actual` → `operator` → `expected`.
- **Never quote** operator expects: `>=# 24`, `!= null`, `=1d~ <<c:datetime>>` — not `'>=# 24'`.
- Live times: `=Ns~ <<c:datetime>>` / `<<c:date>>` (not `c:time`, not datetime regex).
- Scenario windows: exact / `=^` against the **same literals** as that test’s inputs.

## Suites

- Parallel by default; use `then` only when sequencing is required.
