# js

### js
Run inline JavaScript for custom logic or logging.
```yaml
- js: |
    const t = Date.now();
    console.log('ts', t);
```

The following globals are available inside `js` steps:

| Global | Description |
|--------|-------------|
| `console` | Custom console with `log`, `warn`, `error`, `debug`, `trace` |
| `send_(request)` | Send an HTTP request directly |
| `extractOutputs_(response, outputMap)` | Extract values from a response |
| `report_(stepType, comparison, title, details, passed)` | Emit a check/assert result to the log |
| `setenv_(name, value)` | Set an environment variable at runtime |
| `importJsModule_(path)` | Load a JS module at runtime |
| `Random.*` | All random token functions (e.g., `Random.randomUUID()`, `Random.randomInt()`, `Random.randomEmail()`) |
| `__mmt_random(name)` | Resolve a random token by name (e.g., `__mmt_random('uuid')`) |
| `__mmt_current(name)` | Resolve a current token by name (e.g., `__mmt_current('date')`) |
| `equals_()`, `less_()`, `greater_()`, etc. | Comparison helpers matching check/assert operators |
