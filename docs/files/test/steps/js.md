# js

### js
Run inline JavaScript for custom logic, logging, or checks that are easier to express in code.

```yaml
- js: |
    const t = Date.now();
    console.log('ts', t);
```

`js` steps run in the same scope as the rest of the test. **Import aliases** from `import:` (APIs, tests, CSV/JSON/YAML data, JS helper modules) and **variables** from earlier `set` / `var` / `const` / `let` steps are available. To import a reusable `.js` module, declare it under `import:` — see [import](../import.md#js-helper-modules).

Example: [JavaScript helpers example](../../../../examples/intermediate/14_javascript_helpers/README.md).

## Runner globals

The following globals are available inside `js` steps:

| Global | Description |
|--------|-------------|
| `console` | Custom console with `log`, `warn`, `error`, `debug`, `trace` (writes to the Log panel) |
| `send_(request)` | Send an HTTP request directly (same shape as API `send_`) |
| `sendGrpc_(request)` | Send a gRPC request directly |
| `extractOutputs_(response, outputMap)` | Extract values from an HTTP/gRPC response using an outputs map |
| `report_(stepType, comparison, title, details, passed)` | Emit a check or assert result to the log (`stepType`: `'check'` or `'assert'`) |
| `setenv_(name, value)` | Set an environment variable at runtime (visible to later `e:` tokens and steps) |
| `importJsModule_(path)` | Load a `.js` / `.cjs` / `.mjs` file at runtime (prefer `import:` for helpers loaded once per run) |
| `readBinaryFile_(path)` | Read a binary file relative to the test file (when a binary file loader is available) |
| `Random.*` | Random token helpers — e.g. `Random.randomUUID()`, `Random.randomInt()`, `Random.randomEmail()` |
| `__mmt_random(name)` | Resolve a random token by name (e.g. `__mmt_random('uuid')`) |
| `__mmt_current(name)` | Resolve a current token by name (e.g. `__mmt_current('date')`) |
| `equals_()`, `less_()`, `greater_()`, `contains_()`, `matches_()`, … | Comparison helpers matching [check/assert operators](./assert-operators.md) |

Use `report_()` when you need a custom pass/fail line in the log; use the comparison helpers when you want the same semantics as YAML `check` / `assert` inside JavaScript.

See also: [Variables](./variables.md) · [import](../import.md) · [Assert operators](./assert-operators.md)
