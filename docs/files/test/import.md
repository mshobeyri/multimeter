# import

### import
The `import` section brings external files into a test. Each entry is an **alias** (key) and a **path** (value). Paths are relative to the current `.mmt` file, or start with `+/` to resolve from the project root (the folder containing `multimeter.mmt`).

## Importable file types

| File type | Extensions | Use with | Example |
|-----------|------------|----------|---------|
| API definition | `.mmt` (`type: api`) | `call` | [Imports — API calls](../../../examples/intermediate/06_imports/tests/test_api.mmt) |
| Test flow | `.mmt` (`type: test`) | `call` (nested test) | [Imports — relative / `+/` paths](../../../examples/intermediate/06_imports/README.md) |
| Mock server | `.mmt` (`type: server`) | `run` | [Simple mock server — health test](../../../examples/intermediate/18_simple_mock_server/test/health_test.mmt) |
| HTTP Client file | `.http`, `.https` | `call` (converted to a test flow) | [Import HTTP in test](../../../examples/intermediate/15_http_files/import_http_in_test.mmt) |
| Bruno request | `.bru`, `.bruno` | `call` (converted to a test flow) | [Import Bruno in test](../../../examples/intermediate/16_bruno_files/import_bruno_in_test.mmt) |
| CSV data | `.csv` | `data`, `for`, `${alias.field}` | [CSV data-driven test](../../../examples/intermediate/09_csv_data_driven_test/echo_csv_test.mmt) |
| JSON / YAML data | `.json`, `.yaml`, `.yml` | `${alias.path}` substitution | [Data imports](../../integration/data-imports.md) |
| JS helper module | `.js`, `.cjs`, `.mjs` | `js` steps (functions on the alias) | [JavaScript helpers](../../../examples/intermediate/14_javascript_helpers/js_test.mmt) |

```yaml
import:
  login: login.mmt           # relative to current file
  requests: requests.http    # HTTP Client file, converted to a test flow
  profile: profile.bru       # Bruno request file, converted to a test flow
  users: ../data/users.csv   # relative path
  fixture: ../data/user.json # data source used as ${fixture.path}
  api: +/apis/userApi.mmt    # project root path
  helpers: ./helpers/xxx.js  # JS helper module
```

HTTP and Bruno files imported this way are converted internally to test flows and can be called like normal test imports:

```yaml
steps:
  - call: requests
```

## JS helper modules

Files ending in `.js`, `.cjs`, or `.mjs` are loaded once per run via the runner's `fileLoader`, then cached. Write plain top-level functions (or `const` / `let` / `var` function bindings); Multimeter auto-exports them on the import alias:

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

**Runner globals** inside `js` steps (`send_`, `Random.*`, `report_`, comparison helpers, …): see [js step — Runner globals](./steps/js.md#runner-globals).

See also: [Cache](./cache.md) · [Data imports](../../integration/data-imports.md) · [Imports example](../../../examples/intermediate/06_imports/README.md)
