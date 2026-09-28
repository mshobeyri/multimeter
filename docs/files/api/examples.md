# Examples, validation, and UI

Define example inputs and (optional) expected outputs so you can run them as smoke tests.

## Running examples

**YAML editor** — Each example with an `id:` (or legacy `name:`) shows a {{btn:run}} glyph in the left margin on that line. Click it to run that example through core; Multimeter opens the log output.

**API tester** — On the **In / Out** tab, use the **Example** dropdown to pick **Select...** (API defaults) or an example. That selection pre-fills **Inputs** (and expected outputs for match icons) for the next {{btn:send:Send}}. Editing inputs auto-selects a matching example, or **Select...** when none match.

```yaml
examples:
  - id: happy-path
    title: Happy path
    description: Login with valid user
    inputs:
      username: alice
      password: secret
    outputs:
      status: 200
      token: "*"   # wildcard/placeholder documentation if exact value varies
    expect:
      status: 200
    require:
      status: == 200
  - id: invalid-pass
    title: Invalid password
    inputs:
      username: alice
      password: wrong
    outputs:
      status: 401
```

Prefer `id` (stable identifier) and `title` (display label). Deprecated `name` still works as a fallback for both — click the struck-through `name:` in the editor to expand to `id` + `title`. Duplicate ids fail validation.


## Validation and requirements

- For `protocol: http`, `method` is optional (defaults to `post` when `body` is set, otherwise `get`)
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.


## UI features

- **Example dropdown** (In / Out tab): Switch between **Select...** (API defaults) and examples; inputs update immediately. Editing inputs auto-selects a matching example when values match.
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values in the response panel can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
