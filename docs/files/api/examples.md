# Examples, validation, and UI

Define example inputs and soft/hard checks so you can run them as smoke tests from the **Tests** tab.

## Running examples

**YAML editor** — Each example with an `id:` (or legacy `name:`) shows a {{btn:run}} glyph in the left margin on that line. Click it to run that example through core; Multimeter opens the log output.

**API tester** — On the **Tests** tab, use the **Example** dropdown to pick **Select...** (API defaults) or an example. Request-side **Inputs** pre-fill for the next {{btn:send:Send}}. Response-side **Expect** / **Require** edit soft and hard checks. Use **+** to add a new test from the current inputs (and extracted values as expect). Editing inputs while an example is selected writes to that example.

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

- **Example dropdown** (Tests tab): Switch between **Select...** (API defaults) and examples; inputs update immediately.
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values in the response panel can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
