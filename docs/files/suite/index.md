# Suite

Use `type: suite` to define a suite MMT file. A suite runs multiple items together — tests, APIs, HTTP/Bruno files, or other suites. Under the hood, Multimeter executes each file listed in the suite.

Example:

```yaml
type: suite
title: Smoke Tests
tags:
  - smoke
items:
  - test/login_and_get_user_info.mmt
  - test/create_session.mmt
  - test/get_user_info.mmt
```


## Elements

### title, description, tags
You can use these fields for documentation and to help with searching and filtering suites.

- `title`: The title of the suite.
- `description`: A short explanation of what the suite does.
- `tags`: An array of strings to categorize the suite.

### import
Suites support top-level data imports from `.json`, `.yaml`, `.yml`, and `.csv` files. Imported values can be referenced with `${alias.path}` in suite fields before the suite is run.

```yaml
type: suite
import:
  config: ./suite-config.yaml
title: ${config.title}
items:
  - ./tests/login.mmt
```

See [Data Imports](../integration/data-imports.md).

### items
The `items` property is an array of strings, where each string is a path to a `.mmt`, `.http`, `.https`, or `.bru` file. A suite can run any combination of APIs, tests, HTTP files, Bruno files, or other suites.

> **Legacy alias:** `tests` is still accepted as an alias for `items` in existing suite files.

Paths can be:
- **Relative** to the suite file's location (e.g., `../tests/login.mmt`)
- **Project root** paths using `+/` prefix (e.g., `+/tests/login.mmt`) — resolves relative to the directory containing `multimeter.mmt`

```yaml
items:
  - ../apis/login.mmt
  - ../tests/login_and_get_user_info.mmt
  - ../requests/profile.http
  - +/tests/shared/setup.mmt           # project root import
  - ../suites/smoke_tests.mmt
```

See [Environment — Project Root Marker](./env.md#project-root-marker) for details on setting up `multimeter.mmt`.

When converting larger Postman collections, Multimeter generates `multimeter.mmt` and uses `+/` paths in generated tests and suites so files can move within the generated project without breaking imports.


Next: [Execution](./execution.md) · [UI](./ui.md) · [CLI](./cli.md) · [Reference](./reference.md)
