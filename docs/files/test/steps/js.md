# js

### `js`
Run inline JavaScript for custom logic, logging, or checks that are easier to express in code.

```yaml
- js: |
    const t = Date.now();
    console.log('ts', t);
```

`js` steps run in the same scope as the rest of the test. **Import aliases** from `import:` (APIs, tests, CSV/JSON/YAML data, [JS helper modules](#js-helper-modules)) and **variables** from earlier `set` / `var` / `const` / `let` steps are available.

Example: [JavaScript helpers example](../../../../examples/intermediate/14_javascript_helpers/README.md).

## JS helper modules

Declare reusable `.js`, `.cjs`, or `.mjs` files under `import:` (paths are relative to the current `.mmt` file, or start with `+/` for the project root — same rules as [import](../import.md)):

```yaml
import:
  helpers: ./helpers/xxx.js
```

Files are loaded once per run via the runner's `fileLoader`, then cached. Write plain top-level functions (or `const` / `let` / `var` function bindings); Multimeter auto-exports them on the import `alias:`

```js
// xxx.js
function add(a, b) {
  return a + b;
}

const double = (x) => x * 2;
```

```yaml
type: test
import:
  helpers: ./helpers/xxx.js
steps:
  - js: |
      const sum = helpers.add(1, 2)
      console.log('sum', sum, helpers.double(sum))
```

`module.exports = { ... }` still works when you need a custom export shape.

Example: [JavaScript helpers](../../../../examples/intermediate/14_javascript_helpers/js_test.mmt).

## Runner globals

The following globals are available inside `js` `steps:`

| Global | Description |
|--------|-------------|
| `console` | Custom console with `log`, `warn`, `error`, `debug`, `trace` (writes to the Log panel) |
| `send_(request)` | Send an HTTP request directly (same shape as API `send_`) |
| `sendGrpc_(request)` | Send a gRPC request directly |
| `extractOutputs_(response, outputMap)` | Extract values from an HTTP/gRPC response using an outputs map |
| `report_(stepType, comparison, title, details, passed)` | Emit a check or assert result to the log (`stepType`: `'check'` or `'assert'`) |
| `setenv_(vars)` | Set environment variables at runtime from an object (visible to later `e:` tokens and steps) |
| `importJsModule_(path)` | Load a `.js` / `.cjs` / `.mjs` file at runtime (prefer `import:` for helpers loaded once per run) |
| `readBinaryFile_(path)` | Read a binary file relative to the test file (when a binary file loader is available) |
| `Random.*` | Random token helpers — e.g. `Random.randomUUID()`, `Random.randomInt()`, `Random.randomEmail()` |
| `__mmt_random(name)` | Resolve a random token by name (e.g. `__mmt_random('uuid')`) |
| `__mmt_current(name)` | Resolve a current token by name (e.g. `__mmt_current('date')`) |
| `equals_()`, `less_()`, `greater_()`, `contains_()`, `matches_()`, … | Comparison helpers matching [check operators](./check.md#operators) |

Use `report_()` when you need a custom pass/fail line in the log; use the comparison helpers when you want the same semantics as YAML `check` / `assert` inside JavaScript.

See also: [Variables](./variables.md) · [import](../import.md) · [check](./check.md)
