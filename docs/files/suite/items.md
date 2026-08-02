# items

### `title`, `description`, `tags`

You can use these fields for documentation and to help with searching and filtering suites.

- `title`: The title of the suite.
- `description`: A short explanation of what the suite does.
- `tags`: An array of strings to categorize the suite.

### `items`

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

See [Project Root Marker](../env/project-root.md) for details on setting up `multimeter.mmt`.

When converting larger Postman collections, Multimeter generates `multimeter.mmt` and uses `+/` paths in generated tests and suites so files can move within the generated project without breaking imports.

Use `then` in the `items` array to separate sequential execution stages. See [Execution](./execution.md).

---

See also: [import](./import.md) · [Edit Suite — Items tab](./edit.md#items) · [Reference](./reference.md)
