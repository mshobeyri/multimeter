# Examples, validation, and UI

Define example inputs and soft **expect** checks so you can run them as smoke tests from the **Examples** tab.

## Running examples

**YAML editor** — Each example with an `id:` (or legacy `name:`) shows a {{btn:run}} glyph in the left margin on that line. Click it to run that example through core; Multimeter opens the log output.

**API tester** — On the **Inputs** tab, use the **Example** dropdown to pick **Select...** (API default inputs) or an example (`id - title`). Request-side **Inputs** pre-fill for the next {{btn:send:Send}}. Response **Outputs** shows extracted values and soft **Expect** check rows for the selected example; response **Expect** is a separate read-only status / headers / body snapshot. After Send, soft expect rows and matching outputs show pass/fail. Use **+** to add a new test from the current inputs (and extracted values / response snapshot as expect). Editing inputs while an example is selected writes to that example. Pencil on **Inputs** / **Outputs** edits declared defaults and extraction paths.

```yaml
examples:
  - id: happy-path
    title: Happy path
    description: Login with valid user
    inputs:
      username: alice
      password: secret
    expect:
      status: 200
      body:
        token: "…"
  - id: invalid-pass
    title: Invalid password
    inputs:
      username: alice
      password: wrong
    expect:
      status: 401
```

Prefer `id` + `title`. Example `id` should use only ASCII letters, digits, `_`, and `-` (no spaces); the editor warns otherwise. Deprecated `name` still works as a fallback for both — click struck-through `name:` to expand (`id` gets spaces replaced with `_`, `title` keeps the original). Deprecated example `outputs:` is an alias for soft `expect` — click to rename. Duplicate ids fail validation.


## Validation and requirements

- For `protocol: http`, `method` is optional (defaults to `post` when `body` is set, otherwise `get`)
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.


## UI features

- **Example dropdown** (**Inputs** tab): Switch between **Select...** (API default inputs) and examples (`id - title`); inputs update immediately. Soft **Expect** checks are edited on the response **Outputs** tab (under Outputs); the response **Expect** tab shows expected status / headers / body. Pencil on Inputs/Outputs edits declarations.
- **Input options menu** (⋯): When `description` annotates an input with `[...]` allowed values (for example `<<i:role>> [admin, editor, viewer]`), that field on the **Inputs** tab shows a ⋯ control to pick a value — see [Documentation](./documentation.md).
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values on the Examples response pane can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
