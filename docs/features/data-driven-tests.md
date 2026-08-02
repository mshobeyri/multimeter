# Data-driven tests

Run the same test flow against many rows of external data. Import a CSV, JSON, or YAML file, then loop over rows or substitute values with `${alias.path}`.

This is the primary guide for **data-driven testing in `type: test` files**. For data imports in other file types (API, env, suite, server, doc, loadtest), see [Data imports](./data-imports.md).

## Import data files

Add entries under `import:` in your test file. Each key is an **alias**; the value is a path relative to the current `.mmt` file, or a project-root path starting with `+/` (relative to the folder containing `multimeter.mmt`).

```yaml
type: test
import:
  messages: messages.csv       # CSV rows
  fixture: ./data/user.json    # JSON object
  config: +/shared/config.yaml # YAML from project root
```

See [import](../files/test/import.md) for all importable file types and path rules.

## CSV — loop over rows

CSV files are parsed into an array of row objects. The first row is the header; each column becomes a field on the row.

```csv
message,expected_method
hello world,POST
goodbye,POST
```

Import the CSV, then iterate with `for`:

```yaml
import:
  echo: echo_api.mmt
  messages: messages.csv
steps:
  - for: row of messages
    steps:
      - call: echo
        id: result
        title: ${row.message}
        inputs:
          message: ${row.message}
        expect:
          status: 200
          echoed_message: ${row.message}
          request_method: ${row.expected_method}
```

Notes:
- Unquoted numbers and booleans in CSV are coerced (`42` → number, `true` → boolean); quoted values stay strings.
- The `for` expression is standard JavaScript — `const row of messages`, `let i = 0; i < messages.length; i++`, and similar headers all work.
- Use `${row.field}` in inputs, checks, and asserts to reference the current row.

Optional: a `data` step can bind an imported CSV alias explicitly before loops. See [data](../files/test/steps/variables.md#data).

## JSON / YAML — substitute values

JSON and YAML imports load as objects or arrays. Reference nested values with `${alias.path}` dot notation:

```yaml
import:
  fixture: ./data/user.json
steps:
  - call: createUser
    inputs:
      name: ${fixture.payload.name}
      active: ${fixture.payload.active}
```

When a field value is **exactly** `${alias.path}`, Multimeter keeps the imported type (object, array, number, boolean). Inline use inside longer strings is converted to text.

## Key steps and tokens

| Mechanism | Use for |
|-----------|---------|
| `import:` | Load CSV, JSON, or YAML by alias |
| `for` | Iterate CSV rows (or any JS iterable) |
| `data` | Bind an imported CSV alias into scope |
| `${alias.field}` | Row field or nested path from imported data |

Full references: [Control flow — for/repeat](../files/test/steps/control-flow.md#for-repeat) · [Variables — data](../files/test/steps/variables.md#data) · [import](../files/test/import.md)

## Examples

| Format | Example |
|--------|---------|
| CSV data-driven loop | [CSV data-driven test](../../examples/intermediate/09_csv_data_driven_test/README.md) |
| JSON / YAML substitution | Inline fixtures in [Data imports](./data-imports.md) (no dedicated test example yet) |

Run the CSV example:

```sh
npx testlight run examples/intermediate/09_csv_data_driven_test/echo_csv_test.mmt
```

---

## See also
- [import](../files/test/import.md) — all importable file types
- [Data imports](./data-imports.md) — JSON/YAML/CSV in API, env, suite, and other file types
- [Control flow](../files/test/steps/control-flow.md) — `for`, `repeat`, `if`
- [Variables](../files/test/steps/variables.md) — `data`, `set`, `setenv`
- [Browse examples](/docs/examples) — sample Multimeter projects
