# items

### `title`, `description`, `tags`

You can use these fields for documentation and to help with searching and filtering suites.

- `title`: The title of the suite.
- `description`: A short explanation of what the suite does.
- `tags`: An array of strings to categorize the suite.

### `items`

The `items` property is an array of strings, where each string is a path to a `.mmt`, `.http`, `.https`, or `.bru` file. A suite can run any combination of APIs (`type: api`), tests, HTTP files, Bruno files, or other suites. API leaves run with **default inputs** + suite env (per-example asserts are edited in the API **Inputs** / **Examples** UI; suite behavior for example tests may expand later).

> **Legacy alias:** `tests` is still accepted as an alias for `items` in existing suite files.

Paths can be:

- **Project root** paths using `+/` prefix (e.g., `+/test/login.mmt`) — resolves relative to the directory containing `multimeter.mmt`. **Prefer this** when the suite is part of a project with a root marker.
- **Relative** to the suite file's location (e.g., `test_login.mmt` beside the suite, or `../test/login.mmt`) — fine for same-folder items

```yaml
items:
  - +/test/login.mmt                   # preferred — project root
  - +/test/login_and_get_user_info.mmt
  - +/requests/profile.http
  - test_smoke.mmt                     # same folder as this suite.mmt
```

See [Project Root Marker](../env/project-root.md) for details on setting up `multimeter.mmt`.

When converting larger Postman collections, Multimeter generates `multimeter.mmt` and uses `+/` paths in generated tests and suites so files can move within the generated project without breaking imports.

Use `then` in the `items` array to separate sequential execution stages. See [Execution](./execution.md).

---

See also: [import](./import.md) · [Edit Suite — Items tab](./edit.md#items) · [Reference](./reference.md)
