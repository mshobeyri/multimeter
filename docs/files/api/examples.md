# Examples, validation, and UI

Define example inputs and soft/hard checks so you can run them as smoke tests from the **Examples** tab.

## Running examples

**YAML editor** — Each example with an `id:` (or legacy `name:`) shows a {{btn:run}} glyph in the left margin on that line. Click it to run that example through core; Multimeter opens the log output.

**API tester** — On the **Examples** tab, use the **Example** dropdown to pick **Defaults** (API default inputs) or an example. Request-side **Inputs** pre-fill for the next {{btn:send:Send}}. Response-side shows extracted **Outputs**; with an example selected you can edit soft **Expect** / hard **Require** (field pickers include declared outputs). Use **+** to add a new test from the current inputs (and extracted values as expect). Editing inputs while an example is selected writes to that example.

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
    require:
      status: == 200
  - id: invalid-pass
    title: Invalid password
    inputs:
      username: alice
      password: wrong
    expect:
      status: 401
```

Prefer `id` + `title`. Deprecated `name` still works as a fallback for both — click struck-through `name:` to expand. Deprecated example `outputs:` is an alias for soft `expect` — click to rename. Duplicate ids fail validation.


## Validation and requirements

- For `protocol: http`, `method` is optional (defaults to `post` when `body` is set, otherwise `get`)
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.


## UI features

- **Example dropdown** (Examples tab): Switch between **Defaults** (API default inputs) and examples; inputs update immediately. **Defaults** shows outputs only (no expect/require editing).
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values on the Examples response pane can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
