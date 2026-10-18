# Start a Multimeter project

This is the **default guide** for starting a Multimeter project with **several APIs and tests** — whether you are setting one up yourself or an AI is scaffolding it for you. Use it as the mother doc for layout, env vs fixtures, imports, expects, and suites.

For a single smoke API or one test file, a flatter folder is fine. Adopt this layout once the project is big enough to need areas.

The rules below are **general**. YAML snippets, folder names, and field names in this page are **illustrative examples** of those rules — not required labels for every project. An optional worked sample ([open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/)) shows one concrete mapping; see [Optional worked sample](#optional-worked-sample).

## Default folder structure

```
my-project/
  multimeter.mmt          # type: env — project root marker + user-tunable values
  data.json               # optional — shared test fixtures (any name)
  suite.mmt               # root suite — calls each area suite
  README.md               # optional — run-first notes for the team
  api/                    # type: api definitions
  test/
    <area>/               # one folder per product area / concern
      suite.mmt           # first in the folder — runs sibling tests
      test_*.mmt
```

| Piece | Rule |
|---|---|
| Env file | Name it **`multimeter.mmt`** at the project root (`type: env`). Prefer this over a bare `env.mmt` so `+/` imports and workspace env loading work. |
| Shared test data | Keep **common fixtures** as JSON/CSV/YAML at the project root (or under a data folder); tests `import:` them with `+/…`. |
| APIs | One file per endpoint (or coherent endpoint group) under `api/`. |
| Tests | `test/<area>/test_*.mmt` — prefix `test_`, not `*_test`, so `suite.mmt` sorts first in the folder. |
| Area suite | `test/<area>/suite.mmt` beside those tests (no separate top-level `suites/` folder). |
| Root suite | Project-root `suite.mmt` lists each `test/<area>/suite.mmt`. |

### Env vs shared data files

General split:

| Put in… | Kind of value | Why |
|---|---|---|
| **`multimeter.mmt` (env)** | Things the **user changes** while running (base URLs, timeouts, secrets, feature flags, interactive API defaults) | Apply once in the Environment panel or CLI; wire them as **API `inputs:` / URL defaults** via `e:` / `<<e:…>>`. Nested choice objects when fields must stay together (e.g. `city` → `e:city.latitude`). Presets only to bind **independent** variables. |
| **JSON / CSV / YAML** | **Common test data** many tests reuse (sample entities, cities, ids, payload rows) | Import in tests (`+/data.json`) and pass `${alias.path}` in call `inputs:`. |
| **Local in the test** | One-off values used by a single test | Put them directly in that test’s `inputs:` — no env, no shared file. |

**Critical:** do **not** drive a city-/entity-specific test from env (`e:city…`) just because the API defaults come from env. A “Berlin” test must pass Berlin from JSON or local literals so the suite stays correct no matter which city the user picked in the Environment panel. Env is for API Send defaults and shared run config (hosts, date windows the user tunes); fixture/local data is for assertions about a known case.

Do **not** stuff every fixture into env just because it is a string.

## How to address files

| Context | Prefer |
|---|---|
| Test → API (or shared fixture) | `+/api/….mmt` or `+/data.json` (project root via `multimeter.mmt`) — not long `../../…` chains |
| Suite items in the **same** folder | Relative names (`test_foo.mmt`) — no `+/` needed |
| Root suite → area suites | Relative from root (`test/<area>/suite.mmt`) is fine |

```yaml
# Example only — paths and aliases are illustrative
import:
  api: +/api/some_endpoint.mmt
  data: +/data.json
```

See [Project root marker](../files/env/project-root.md) and [import](../files/test/import.md).

## API conventions

- Field order: **`url` → `query` → `method`**, then `format` / headers / body.
- Prefer **user-tunable** values from env as **API defaults** (hosts, default location/id for Send in the API tester, timeouts). Nested choice maps when fields must stay together (`latitude: e:city.latitude`).

## Test conventions

### Where test inputs come from

| Source | When |
|---|---|
| `${alias.path}` from imported JSON/CSV/YAML | Shared entities used by several tests (e.g. `${cities.berlin.latitude}`) |
| Literal / local in the test | One-off values for that test only |
| `e:` / `<<e:…>>` | Shared **run config** the user tunes (base URLs, archive date windows) — **not** the entity that names the test |

A test titled for Berlin/Tokyo/… must not read that place from env. Env city is only the interactive API default.

### Varied inputs

Do not smoke-call each API once. Cover **several inputs** (different entities, modes, time windows, edge cases) — multiple `test_*.mmt` files and/or several calls with different `inputs:`.

### `expect` vs `check` / `assert`

- Put every check that depends on **one** call’s outputs on that call’s **`expect`** / **`require`** (list form for several ops on one field).
- Use standalone **`check`** / **`assert`** only when comparing **two different** values.
- Set **`report: all`** on the call (and on any remaining cross-output `check`) so Report shows every row, not only failures.

```yaml
# Example only — field names are illustrative
import:
  api: +/api/some_endpoint.mmt
  data: +/data.json
steps:
  - call: api
    id: result
    inputs:
      id: ${data.sample_user.id}   # fixture — not e:default_id
    expect:
      status: 200
      created_at: =1d~ <<c:datetime>>
      score:
        - >= 0
        - <= 100
    report: all
  - check:
      actual: ${result.max}
      operator: ">="
      expected: ${result.min}
      report: all
```

Object-form `check` / `assert` field order: **`actual` → `operator` → `expected`**, then `title` / `details` / `report`.

### Operator expects stay unquoted

Write **all** operator expects unquoted. Never `'>=# 24'`, `"!= null"`, or `'=* …'`. Multimeter quotes YAML-unsafe ops for the parser. Quote only a **plain string value** when you must force a string (`== "200"`).

### Times: prefer time operators, not datetime regex

| Situation | Prefer |
|---|---|
| Live / near-now timestamps | `=Ns~` with `<<c:datetime>>` or `<<c:date>>` (e.g. `=1d~ <<c:datetime>>`) |
| Fixed past/future windows from env | Exact or `=^` against `e:` date variables |

Do **not** use `<<c:time>>` against ISO datetimes — `c:time` is clock-only (`HH:MM:SS`). Prefer time operators over datetime regexes when the value should be near now.

See [Prefer accurate expects](../files/test/operators.md#prefer-accurate-expects-not-only--null).

## Suite conventions

- Suite `items` run **in parallel by default**. Use `then` only when a stage must wait on the previous one — do not put `then` between every item by habit.
- Area suites list sibling `test_*.mmt` files; root suite lists area `suite.mmt` files.

## Run

```sh
npx testlight run suite.mmt --env-file multimeter.mmt
```

Or open `multimeter.mmt` in the Extension (Environment panel), then run `suite.mmt`.

One area (path is an example):

```sh
npx testlight run test/<area>/suite.mmt --env-file multimeter.mmt
```

## Optional worked sample

You do **not** need a sample repo to start. The rules above are enough.

[open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/) is one public application of those rules (useful if you want to see a full tree). Mapping — **examples only**:

| General concept | In that sample |
|---|---|
| `test/<area>/` | `test/forecast/`, `test/geocoding/`, … |
| Env as API default (one concept) | `city:` choice map → API `e:city.latitude` / `e:city.longitude` (interactive Send) |
| Test entity data | `cities.json` → `${cities.berlin.latitude}` in every city-named test (never `e:city` for that) |
| Root + area suites | `suite.mmt` → each area’s `suite.mmt` |

For your own product, use the same split and layout with your areas, env keys, and fixture files.

## Learn more

- [Project root marker](../files/env/project-root.md)
- [import](../files/test/import.md) · [Data-driven tests](../features/data-driven-tests.md) · [Operators](../files/test/operators.md) · [Inline expect](../files/test/inline-expect.md)
- [Suite execution](../files/suite/execution.md)
