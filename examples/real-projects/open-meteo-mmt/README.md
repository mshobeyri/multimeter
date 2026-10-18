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
| `archive_start` / `archive_end` | Past window for ERA5 archive (keep the end date older than Open-Meteo’s ~5-day delay) |
| `history_start` / `history_end` | Past window for historical forecast, previous runs, satellite |
| `climate_start` / `climate_end` | Future climate projection window |
| `timezone` | `UTC` so time assertions stay stable |
| `forecast_days` / `forecast_days_short` | Forecast horizon |

All city-specific tests import `cities.json` (`cities: +/cities.json`) and pass `${cities.berlin.latitude}` / `${cities.tokyo.latitude}` etc. Keep coords in sync with the `city` map in `multimeter.mmt` when you change a sample point (env = interactive default; JSON = test data).

Self-hosted Open-Meteo: change the relevant `*_base_url` values.

## Layout

```
multimeter.mmt          # project root marker + env (city choice map)
cities.json             # city lat/lon for tests (not e:city)
suite.mmt               # root — calls each test/<area>/suite.mmt
api/                    # API definitions (defaults: e:city.latitude / e:city.longitude)
test/<area>/
  suite.mmt             # first — runs all tests in that folder
  test_*.mmt            # +/api/… and optional +/cities.json
```

## Upstream

- https://open-meteo.com/en/docs  
- Respect Open-Meteo fair-use and CC BY attribution for non-commercial use.

## License

MIT
