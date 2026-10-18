# Real projects

Sample Multimeter suites that hit **real public APIs** (not the Multimeter echo server). Each folder is meant to stand alone as a `{product}-mmt` test project.

| Project | API | Notes |
|---|---|---|
| [open-meteo-mmt](./open-meteo-mmt/) | [Open-Meteo](https://open-meteo.com/) | Weather, air quality, marine, climate, models, … — no API key |

Pedagogical Multimeter tutorials stay under `basic/`, `intermediate/`, and `professional/`.

## Run

```sh
npx testlight run examples/real-projects/open-meteo-mmt/multimeter/suite.mmt \
  --env-file examples/real-projects/open-meteo-mmt/multimeter/multimeter.mmt
```

Or open that project’s `suite.mmt` in the Multimeter extension after applying its `multimeter.mmt`.
