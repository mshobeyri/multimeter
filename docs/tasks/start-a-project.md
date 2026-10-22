# Start a Multimeter project

This is the **default guide** for starting a Multimeter project with **several APIs and tests** — whether you are setting one up yourself or an AI is scaffolding it for you. Use it as the mother doc for layout, where values live, imports, expects, and suites.

For a single smoke API or one test file, a flatter folder is fine. Adopt this layout once the project is big enough to need areas.

The rules below are **general**. YAML snippets, folder names, and field names in this page are **illustrative examples** of those rules — not required labels for every project. An optional worked sample ([open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/)) shows one concrete mapping; see [Optional worked sample](#optional-worked-sample).

## Default folder structure

```
my-project/
  multimeter.mmt          # type: env — project root marker + user-tunable values
  data.json               # optional — shared fixed fixtures (any name)
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
| Shared fixtures | Optional JSON/CSV/YAML at the project root (or under a data folder) for **fixed** reference data many tests reuse. |
| APIs | One file per endpoint (or coherent endpoint group) under `api/`. |
| Tests | `test/<area>/test_*.mmt` — prefix `test_`, not `*_test`, so `suite.mmt` sorts first in the folder. |
| Area suite | `test/<area>/suite.mmt` beside those tests (no separate top-level `suites/` folder). |
| Root suite | Project-root `suite.mmt` lists each `test/<area>/suite.mmt`. |

## Where values live (env vs JSON vs direct)

Put each value in **exactly one** place. Ask these questions in order:

1. **Does the user change this while running** (Environment panel / CLI `-e` / `--preset`), without editing tests?  
   → **`multimeter.mmt` (env)** — e.g. base URLs, secrets, feature flags, timezone, interactive API Send defaults.
2. **Is it a fixed shared reference** many tests reuse, and the meaning stays the same everywhere (the same Berlin coords, the same sample user id)?  
   → **JSON / CSV / YAML fixture** — import in tests (`+/cities.json`) and pass `${alias.path}`.
3. **Otherwise** (this test’s case: any date window, any horizon, a one-off payload field)?  
   → **Write it directly in that test** (`inputs:` / expects). Do not invent an env key or a fixture file just to hold it.

| Place | What belongs there | How tests/APIs read it | What does **not** belong |
|---|---|---|---|
| **Env** (`multimeter.mmt`) | User-tunable run config and **API Send defaults** | APIs: `e:name` / `e:name.field` / `<<e:…>>`. Tests may use `e:` only for true run config (e.g. host), never for the entity/case the test is about. | Case data that would make a “Berlin” test fail if the panel city is Tokyo |
| **JSON / CSV / YAML** | **Fixed** catalogs shared across tests (stable places, sample users, seed ids) | `import:` + `${alias.path}` in call `inputs:` / expects | Values that are arbitrary per scenario (most date ranges, `forecast_days` for one call) |
| **Direct in the test** | Scenario-specific inputs and expects | Literals in that file (`start_date: "2024-06-01"`, `forecast_days: "3"`) | User-tunable hosts/secrets; shared fixed coords that should stay in one catalog |

### Distinguishing “fixed catalog” vs “scenario value”

- **Fixed catalog (→ JSON):** Berlin’s lat/lon is always the same place. Many tests need that same place. Editing it once in `cities.json` should update every Berlin test. Same idea for a sample `user_id` reused everywhere.
- **Scenario value (→ direct in the test):** A history window can be any past days that still satisfy the API. Choosing June vs January does not define a reusable “the June window” product concept the way Berlin does — each test picks what it needs and asserts those same literals.
- **User knob (→ env):** Host URL, which city to use when **sending** an API interactively, timezone for Send. Changing it should not rewrite what a named test asserts.

Nested env choices (e.g. `city.berlin: {latitude, longitude}`) are for **API defaults** that must stay paired. Tests that care about a specific city still pass that city from JSON (or a local literal), not `e:city…`.

```yaml
# Example only — names are illustrative

# multimeter.mmt — user knobs + API Send defaults
# variables:
#   api_url: { local: "…", prod: "…" }
#   city: { berlin: { latitude: 52.52, longitude: 13.41 }, … }

# cities.json — fixed shared catalog
# { "berlin": { "latitude": 52.52, "longitude": 13.41 }, … }

# type: api — defaults from env
# inputs:
#   latitude: e:city.latitude

# type: test — catalog from JSON; scenario dates direct
import:
  cities: +/cities.json
  api: +/api/some_endpoint.mmt
steps:
  - call: api
    inputs:
      latitude: ${cities.berlin.latitude}
      longitude: ${cities.berlin.longitude}
      start_date: "2024-06-01"    # scenario — not env, not JSON
      end_date: "2024-06-03"
```

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
- User-tunable **Send defaults** from env (`e:` / nested `e:name.field`). Scenario defaults that are not user knobs can be literals on the API (`start_date: "2024-06-01"`).

## Test conventions

### Varied inputs

Do not smoke-call each API once. Cover **several inputs** (different entities, modes, time windows, edge cases) — multiple `test_*.mmt` files and/or several calls with different `inputs:`. Apply [Where values live](#where-values-live-env-vs-json-vs-direct) for each input.

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
      id: ${data.sample_user.id}
      start_date: "2024-06-01"
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
| Scenario past/future windows | Exact or `=^` against the **same literals** written in that test’s inputs |

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

[open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/) is one public application of those rules (Multimeter tree under [`multimeter/`](../../examples/real-projects/open-meteo-mmt/multimeter/)). Mapping — **examples only**:

| Where-values rule | In that sample |
|---|---|
| Env (user / API Send) | Hosts, `timezone`, `city:` choice map → API `e:city.latitude` |
| JSON (fixed catalog) | `cities.json` → `${cities.berlin.latitude}` in city-named tests |
| Direct in the test (scenario) | `start_date` / `end_date` / `forecast_days` literals |
| Layout | `multimeter/test/<area>/suite.mmt`, `multimeter/suite.mmt` |

For your own product, use the same decision rule with your areas, env keys, and catalogs.

## Learn more

- [Project root marker](../files/env/project-root.md)
- [import](../files/test/import.md) · [Data-driven tests](../features/data-driven-tests.md) · [Operators](../files/test/operators.md) · [Inline expect](../files/test/inline-expect.md)
- [Suite execution](../files/suite/execution.md)
