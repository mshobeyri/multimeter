# Examples, validation, and UI

Define example inputs and (optional) expected outputs so you can run them as smoke tests.

## Running examples

**YAML editor** — Each named example shows a {{btn:run}} glyph in the left margin on its `name:` line. Click it to run that example through core; Multimeter opens the log output.

**API tester** — On the **In / Out** tab, use the **Example** dropdown to pick **Select...** (API defaults) or a named example. That selection pre-fills **Inputs** (and expected outputs for match icons) for the next {{btn:send:Send}}. Editing inputs auto-selects a matching example, or **Select...** when none match.

```yaml
examples:
  - name: happy-path
    description: Login with valid user
    inputs:
      username: alice
      password: secret
    outputs:
      status: 200
      token: "*"   # wildcard/placeholder documentation if exact value varies
  - name: invalid-pass
    inputs:
      username: alice
      password: wrong
    outputs:
      status: 401
```


## Validation and requirements

- For `protocol: http`, `method` is optional (defaults to `post` when `body` is set, otherwise `get`)
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.


## UI features

- **Example dropdown** (In / Out tab): Switch between **Select...** (API defaults) and named examples; inputs update immediately. Editing inputs auto-selects a matching example when values match.
- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values in the response panel can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
