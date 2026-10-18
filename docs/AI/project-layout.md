# Project layout (start a Multimeter project)

**Mother doc (users + AI):** [Start a Multimeter project](../tasks/start-a-project.md).

When the user wants to **start or scaffold a Multimeter project** with several APIs and tests, and does **not** ask for a different layout, follow that guide. This page is the short checklist for AI; do not invent a different structure.

Skip for a single smoke API or one test file unless the user asks for the full layout.

YAML names and trees in either doc are **examples of the general rules**. `examples/real-projects/open-meteo-mmt/` is an optional concrete sample of the same rules — not the target shape to copy blindly, and not limited to community sample repos. Scaffold the user’s product the same way.

## Structure

```
multimeter.mmt          # type: env at project root (not env.mmt)
*.json / data/…         # optional shared test fixtures
suite.mmt               # root → test/<area>/suite.mmt
api/*.mmt
test/<area>/
  suite.mmt             # first file alphabetically
  test_*.mmt            # prefix test_ — not *_test
```

No top-level `suites/` folder.

## Env vs shared data (general)

- **Env (`multimeter.mmt`)** — values the **user changes** (hosts, secrets, flags, interactive API defaults). Nested choice objects when fields must stay together (`e:city.latitude` on **APIs**). Presets only to bind **independent** variables.
- **JSON/CSV/YAML** — **common test data**. Import with `+/…` and `${alias.path}` in test call `inputs:`.
- **Local in the test** — one-off inputs for a single test.

**Do not** pass entity-specific test inputs from env. A “Berlin” / “user-42” test must use fixture or local values so changing the Environment panel does not change what the test asserts. Env on APIs is for Send defaults; env in tests is only for shared run config (hosts, tunable date windows), not the named case under test.

## Paths

- Tests import APIs/fixtures with `+/…` (needs `multimeter.mmt` at root).
- Same-folder suite items: relative (`test_foo.mmt`) — no `+/`.
- Do not invent `../../…` when a project root exists.

## API

- Order: `url` → `query` → `method` → rest.
- User-tunable defaults from env (`e:` / nested `e:name.field`).

## Tests

- Call `inputs:` from fixtures (`${alias…}`) or locals — not from env for the entity the test is about.
- Several input variants per API — not one smoke call.
- Single-output validations → call `expect` / `require` (list form OK). `report: all`.
- `check` / `assert` only for **two different** values. Object form: `actual` → `operator` → `expected`.
- **Never quote** operator expects: `>=# 24`, `!= null`, `=1d~ <<c:datetime>>` — not `'>=# 24'`.
- Live times: `=Ns~ <<c:datetime>>` / `<<c:date>>` (not `c:time`, not datetime regex).
- Fixed windows: exact / `=^` vs `e:` dates when those dates live in env as **tunable run config**.

## Suites

- Parallel by default; use `then` only when sequencing is required.
