# Generate `type: env` (min)

```yaml
type: env
variables:
  api_url:
    dev: http://localhost:8080
    prod: https://test.mmt.dev
  city:
    berlin:
      latitude: 52.52
      longitude: 13.41
  mode:
    - debug
    - info
presets:
  runner:
    dev:
      api_url: dev
      mode: debug
```

## Essentials

- First line: `type: env`
- `variables` required; each var is a **choice map** (scalar or nested object/array values) or a **list of scalars**
- Nested choices = one concept for **API defaults** (`city.berlin: {latitude, longitude}`) → API `e:city.latitude` — do **not** split into paired maps + a syncing preset
- **Tests** for a named entity use JSON/local inputs (`${cities.berlin.latitude}`), not `e:city…`
- `presets` optional; bind **independent** variables; choice keys must match the map (or list values)
- APIs consume defaults via `e:api_url` / `e:city.latitude`; tests use fixtures for case data

Request `pack: full` for multi-group presets, nested-choice patterns, and UI details.
