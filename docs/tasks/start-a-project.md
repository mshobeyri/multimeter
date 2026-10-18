# Start a Multimeter project

Use this layout when you have **several APIs and tests** (a real product surface, a `{product}-mmt` repo, or a multi-area regression suite). For a single smoke API or one test file, a flatter folder is fine — only adopt this when the project is big enough to need areas.

Reference example: [open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/).

## Default folder structure

```
my-project/
  multimeter.mmt          # type: env — project root marker + defaults
  suite.mmt               # root suite — calls each area suite
  README.md               # run-first (product owner voice for shared repos)
  api/                    # type: api definitions
    forecast_current.mmt
    …
  test/
    forecast/
      suite.mmt           # first in the folder — runs sibling tests
      test_current_berlin.mmt
      test_hourly_3day.mmt
      …
    geocoding/
      suite.mmt
      test_….mmt
```

| Piece | Rule |
|---|---|
| Env file | Name it **`multimeter.mmt`** at the project root (`type: env`). Prefer this over a bare `env.mmt` so `+/` imports and workspace env loading work. |
| APIs | One file per endpoint (or coherent endpoint group) under `api/`. |
| Tests | `test/<area>/test_*.mmt` — prefix `test_`, not `*_test`, so `suite.mmt` sorts first in the folder. |
| Area suite | `test/<area>/suite.mmt` beside those tests (no separate top-level `suites/` folder). |
| Root suite | Project-root `suite.mmt` lists each `test/<area>/suite.mmt`. |

## How to address files

| Context | Prefer |
|---|---|
| Test → API (or shared fixture) | `+/api/….mmt` (project root via `multimeter.mmt`) — not `../../api/….mmt` |
| Suite items in the **same** folder | Relative names (`test_foo.mmt`) — no `+/` needed |
| Root suite → area suites | Relative from root (`test/forecast/suite.mmt`) is fine |

```yaml
# test/forecast/test_current_berlin.mmt
import:
  api: +/api/forecast_current.mmt
```

See [Project root marker](../files/env/project-root.md) and [import](../files/test/import.md).

## API conventions

- Field order: **`url` → `query` → `method`**, then `format` / headers / body.
- Defaults and hosts live in `multimeter.mmt`; APIs read them with `e:` / `<<e:…>>`.

## Test conventions

### Varied inputs

Do not smoke-call each API once. Cover **several inputs** (cities, horizons, date windows) — either multiple `test_*.mmt` files or several calls with different `inputs:`.

### `expect` vs `check` / `assert`

- Put every check that depends on **one** call’s outputs on that call’s **`expect`** / **`require`** (list form for several ops on one field).
- Use standalone **`check`** / **`assert`** only when comparing **two different** values (e.g. `${a.max} >= ${a.min}`).
- Set **`report: all`** on the call (and on any remaining cross-output `check`) so Report shows every row, not only failures.

```yaml
steps:
  - call: api
    id: weather
    inputs:
      latitude: e:latitude
      longitude: e:longitude
    expect:
      observed_at: =1d~ <<c:datetime>>
      temperature:
        - >= -80
        - <= 60
      weather_code:
        - >= 0
        - <= 99
    report: all
  - check:
      actual: ${result.daily_max_0}
      operator: ">="
      expected: ${result.daily_min_0}
      report: all
```

Object-form `check` / `assert` field order: **`actual` → `operator` → `expected`**, then `title` / `details` / `report`.

### Operator expects stay unquoted

Write **all** operator expects unquoted. Never `'>=# 24'`, `"!= null"`, or `'=* …'`. Multimeter quotes YAML-unsafe ops for the parser. Quote only a **plain string value** when you must force a string (`== "200"`).

### Times: prefer time operators, not datetime regex

| Situation | Prefer |
|---|---|
| Live / near-now timestamps | `=1d~ <<c:datetime>>` or `=2d~ <<c:date>>` |
| Fixed archive / history / climate windows | Exact or `=^` against `e:` dates (`hourly_time_0: =^ e:history_start`) |

Do **not** use `<<c:time>>` against ISO datetimes — `c:time` is clock-only (`HH:MM:SS`). Prefer this over `=* ^[0-9]{4}-…` datetime regexes.

See [Prefer accurate expects](../files/test/operators.md#prefer-accurate-expects-not-only--null).

## Suite conventions

- Suite `items` run **in parallel by default**. Use `then` only when a stage must wait on the previous one — do not put `then` between every item by habit.
- Area suites list sibling `test_*.mmt` files; root suite lists area `suite.mmt` files.

## Run

```sh
npx testlight run suite.mmt --env-file multimeter.mmt
```

Or open `multimeter.mmt` in the Extension (Environment panel), then run `suite.mmt`.

One area:

```sh
npx testlight run test/forecast/suite.mmt --env-file multimeter.mmt
```

## Learn more

- [Project root marker](../files/env/project-root.md)
- [import](../files/test/import.md) · [Operators](../files/test/operators.md) · [Inline expect](../files/test/inline-expect.md)
- [Suite execution](../files/suite/execution.md)
- Example: [open-meteo-mmt](../../examples/real-projects/open-meteo-mmt/)
