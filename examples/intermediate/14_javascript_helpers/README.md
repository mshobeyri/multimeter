# JavaScript Helpers

Demonstrates **`js` steps**, **imported JS helpers**, and **runner globals** like `Random.*`, `setenv_()`, and `report_()`.

## Structure

```
14_javascript_helpers/
├── helpers/
│   └── helpers.js               # Plain JS functions (auto-exported)
├── api/
│   └── echo.mmt                 # Simple echo API
├── js_test.mmt                  # Test using js steps and imported helpers
└── README.md
```

## Files

| File | Description |
|---|---|
| `helpers/helpers.js` | Top-level functions `greet()`, `sum()`, and `formatDate()` |
| `api/echo.mmt` | Echo API used for validation |
| `js_test.mmt` | Test that imports the JS file and uses runner globals in `js` steps |

## Key concepts

- **JS helper import** — import `.js`/`.cjs`/`.mjs` files in the `import` section. They are loaded once per run.
  ```yaml
  import:
    helpers: ./helpers/helpers.js
  ```
- **Plain functions** — write normal top-level functions (or `const fn = () => {}`). Multimeter exposes them on the import alias automatically. `module.exports = { ... }` still works if you prefer it.
- **`js` step** — inline JavaScript block. Has access to all imports and runner globals.
  ```yaml
  - js: |
      const greeting = helpers.greet('World');
  ```
- **Runner globals** available in `js` steps:

  | Global | Description |
  |--------|-------------|
  | `Random.*` | `randomUUID()`, `randomEmail()`, `randomInt()`, etc. |
  | `setenv_(name, value)` | Set an environment variable at runtime |
  | `report_(type, comparison, title, details, passed)` | Emit a check/assert result |
  | `console.log/warn/error` | Log to the output panel |
  | `send_(request)` | Send an HTTP request directly |

## How to use

### In VS Code

1. Open `js_test.mmt` and click **Run**.
2. The Log panel shows `console.log` output and the custom `report_` check result.

### With the CLI

```sh
npx testlight run examples/intermediate/14_javascript_helpers/js_test.mmt
```
