# Generate `type: env` (min)

```yaml
type: env
variables:
  api_url:
    dev: http://localhost:8080
    prod: https://test.mmt.dev
  mode:
    - debug
    - info
presets:
  runner:
    dev:
      api_url: http://localhost:8080
      mode: debug
```

## Essentials

- First line: `type: env`
- `variables` required; each var is a map of choices or a list of allowed values
- `presets` optional; values must match variable choices
- APIs/tests consume via `e:api_url` / `<<e:api_url>>`

Request `pack: full` for multi-group presets and UI details.
