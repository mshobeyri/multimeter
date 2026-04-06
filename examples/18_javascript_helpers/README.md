# JavaScript Helpers

Demonstrates **`js` steps**, **imported JS modules**, and **runner globals** like `Random.*`, `setenv_()`, and `report_()`.

## Structure

```
16_javascript_helpers/
├── helpers/
│   └── helpers.js               # CommonJS module with utility functions
├── api/
│   └── echo.mmt                 # Simple echo API
├── js_test.mmt                  # Test using js steps and imported module
└── README.md
```

## Files

| File | Description |
|---|---|
| `helpers/helpers.js` | CommonJS module exporting `greet()`, `sum()`, and `formatDate()` |
| `api/echo.mmt` | Echo API used for validation |
| `js_test.mmt` | Test that imports the JS module and uses runner globals in `js` steps |

## Key concepts

- **JS module import** — import `.js`/`.cjs`/`.mjs` files in the `import` section. They are loaded once per run.
  ```yaml
  import:
    helpers: ./helpers/helpers.js
  ```
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

- **CommonJS format** — use `module.exports = { ... }` in helper files.

## How to use

### In VS Code

1. Open `js_test.mmt` and click **Run**.
2. The Log panel shows `console.log` output and the custom `report_` check result.

### With the CLI

```sh
npx testlight run examples/18_javascript_helpers/js_test.mmt
```
