# Imports

Demonstrates the different ways to import and call API and test files in `.mmt`.

## Files

| File | Description |
|---|---|
| `multimeter.mmt` | Project root marker — enables `+/` imports |
| `apis/echo_api.mmt` | Echo API definition used as an import target |
| `apis/greet_api.mmt` | Greet API definition in the same folder |
| `tests/test_api.mmt` | Test that imports APIs using relative paths and calls each one |
| `test_relative.mmt` | Imports `tests/test_api.mmt` using a relative path |
| `test_root_import.mmt` | Imports `tests/test_api.mmt` using a `+/` project root path |

## Import path styles

`.mmt` files support three styles of import paths:

```yaml
import:
  # 1. Relative path — resolved from the current file's directory
  echo: ../apis/echo_api.mmt
  greet: ./apis/greet_api.mmt

  # 2. Project root path (+/) — resolved from the directory containing multimeter.mmt
  shared: +/tests/test_api.mmt

  # 3. Absolute path — used as-is (rarely needed)
  abs: /full/path/to/file.mmt
```

### When to use each style

| Style | Best for |
|---|---|
| Relative (`echo_api.mmt`, `../apis/greet.mmt`) | Files near the current file. Simple, no setup needed. |
| Project root (`+/path/file.mmt`) | Shared files across different folders. Requires a `multimeter.mmt` marker file at the project root. |
| Absolute (`/full/path/file.mmt`) | Rare cases where files live outside the project. |

## What you can import

| Type | Extension | Used with |
|---|---|---|
| API definition | `.mmt` (`type: api`) | `call` step |
| Test flow | `.mmt` (`type: test`) | `call` step (runs as a nested test) |
| CSV data | `.csv` | `data` + `for` steps |
| JavaScript module | `.js` / `.cjs` / `.mjs` | `js` steps |
| Mock server | `.mmt` (`type: server`) | `run` step |

## How to use

### In VS Code

1. Open `test_relative.mmt` to see a test imported with a relative path.
2. Open `test_root_import.mmt` to see the same test imported with a `+/` project root path.
3. Click **Run** on either file — the imported test calls two APIs and checks the responses.

### With the CLI

Run using relative import:

```sh
npx testlight run examples/10_imports/test_relative.mmt --env-file examples/10_imports/multimeter.mmt
```

Run using project root import:

```sh
npx testlight run examples/10_imports/test_root_import.mmt --env-file examples/10_imports/multimeter.mmt
```

Run the inner API test directly:

```sh
npx testlight run examples/10_imports/tests/test_api.mmt --env-file examples/10_imports/multimeter.mmt
```

## Key concepts

- **`import`** — declares aliases for external files. The alias becomes a callable reference.
- **`call`** — invokes an imported API or test by its alias. Must be the first field in the step. Outputs from the call are stored in the `id` variable.
- **`+/` prefix** — resolves the path from the nearest parent directory containing `multimeter.mmt`. This lets files in different folders share imports without fragile relative paths.
- **Nested test calls** — when a test imports and calls another test, the child test's steps run inline. Checks and outputs propagate to the parent.
- **`multimeter.mmt`** — a `type: env` file that marks the project root. It can also define shared variables and presets.
- **`|-` for multiline descriptions** — use `|-` (literal block, strip trailing newline) for multiline description fields.

## Next steps

- See [6_simple_test/](../6_simple_test/) for a basic test-calls-API example.
- See [7_csv_data_driven_test/](../7_csv_data_driven_test/) for CSV data imports.
- See [2_api_environment_variables/](../2_api_environment_variables/) for environment presets in `multimeter.mmt`.
