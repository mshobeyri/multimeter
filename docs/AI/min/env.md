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
- Only **user knobs** and **API Send defaults** — see [Where values live](../../tasks/start-a-project.md#where-values-live-env-vs-json-vs-direct)
- Nested choices = one API-default concept (`city` → `e:city.latitude`); do not split paired fields + syncing preset
- Fixed catalogs (Berlin coords) → JSON for tests; scenario dates → literals in tests — not env
- `presets` optional; bind **independent** variables

Request `pack: full` for multi-group presets, nested-choice patterns, and UI details.
