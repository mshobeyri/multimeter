# Open-Meteo Multimeter suites

Executable [Multimeter](https://mmt.dev) / `testlight` suites for the public [Open-Meteo](https://open-meteo.com/) weather APIs.

Free non-commercial endpoints need **no API key** and **no account**.

## Run

```sh
npx testlight run suite.mmt --env-file multimeter.mmt
```

Or open `multimeter.mmt` in the Multimeter extension (project root marker — loads into the Environment panel), then open `suite.mmt` and Run.

One area only (suite lives next to its tests):

```sh
npx testlight run test/forecast/suite.mmt --env-file multimeter.mmt
```

## What’s covered

Each area folder under `test/` has its own `suite.mmt` (first in the folder) that runs every `test_*.mmt` beside it. Root `suite.mmt` calls those area suites.

| Area suite | APIs |
|---|---|
| `test/forecast/suite.mmt` | Current + hourly/daily forecast (several locations / horizons) |
| `test/historical/suite.mmt` | Archive, historical forecast, previous runs |
| `test/air_quality/suite.mmt` | Air quality |
| `test/marine/suite.mmt` | Marine / waves |
| `test/flood/suite.mmt` | River discharge |
| `test/climate/suite.mmt` | Climate projections |
| `test/ensemble/suite.mmt` | Ensemble forecast |
| `test/elevation/suite.mmt` | Elevation |
| `test/satellite/suite.mmt` | Satellite shortwave radiation |
| `test/seasonal/suite.mmt` | Seasonal monthly means |
| `test/geocoding/suite.mmt` | Geocode search / get + city→forecast |
| `test/models/suite.mmt` | GFS, ICON, ECMWF, Météo-France, JMA, MET Norway, GEM, BOM, CMA |

Tests call each API with **varied inputs** (cities, date windows, `forecast_days`) and assert accurate expects (near-now times via `=Ns~`, coordinate bands, series lengths) — not only `!= null`.

## Environment

Edit `multimeter.mmt` (or pass `-e` / `--env-file` overrides):

| Variables | Use |
|---|---|
| `*_base_url` | Host per product (defaults are the public Open-Meteo hosts) |
| `city` | Choice map for **API Send defaults** (berlin, paris, tokyo, …). Each choice is `{latitude, longitude}` — pick one city in the Environment panel. APIs default to `e:city.latitude` / `e:city.longitude`. Tests do **not** use `e:city`; they import `cities.json`. |
| `timezone` | `UTC` so time assertions stay stable |

**Where values live** (env vs JSON vs direct — same decision rule as Multimeter’s start-a-project guide):

| Place | In this project |
|---|---|
| **Env** | Hosts, `timezone`, `city` for API **Send** defaults |
| **JSON** | `cities.json` — fixed place catalog (`${cities.berlin.latitude}`) |
| **Direct in the test** | Date windows, `forecast_days` — any valid scenario values, written as literals |

Keep `cities.json` in sync with the env `city` map when you change a sample point.

Self-hosted Open-Meteo: change the relevant `*_base_url` values.

## Layout

```
multimeter.mmt          # project root marker + env (hosts, city, timezone)
cities.json             # city lat/lon for tests
suite.mmt               # root — calls each test/<area>/suite.mmt
api/                    # API definitions (defaults: e:city…; dates local on API)
test/<area>/
  suite.mmt             # first — runs all tests in that folder
  test_*.mmt            # +/api/… + cities.json; dates inlined
```

## Upstream

- https://open-meteo.com/en/docs  
- Respect Open-Meteo fair-use and CC BY attribution for non-commercial use.

## License

MIT
