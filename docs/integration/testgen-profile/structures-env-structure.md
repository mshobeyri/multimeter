# Env structure

Global variables and optional presets.

```yaml
type: env                    # literal
variables: record<string, object (choices) | array (allowed)>
presets: record<string, record<string, record<string, primitive>>>
```

Example:
```yaml
type: env
variables:
  api_url:
    local: http://localhost:3000
    prod: https://test.mmt.dev
  token:
    - your-token
presets:
  runner:
    dev:
      api_url: local
    prod:
      api_url: prod
```

Usage
- Use `e:var` as a standalone token (type-preserving) or `<<e:var>>` inline in strings.
- Omit empty `presets`/`variables` entries when there is nothing to declare; blank sections are optional

See also: docs/files/env/index.md
