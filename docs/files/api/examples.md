# Examples, validation, and UI

Define example inputs and (optional) expected outputs so you can run them as smoke tests. When examples exist, the Tests panel shows a dropdown; picking one pre‑fills the inputs, and you can document expected outputs per example.

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

- For `protocol: http`, `method` is required
- For `method: post|put|patch`, `body` is required
- Unknown fields are rejected (strict schema)
- YAML comments (`#`) are preserved when you format the file (Format Document). Prefer the `description` field for structured docs that survive UI edits.


## UI features

- **Method override button**: Temporarily change the HTTP method from the UI without editing the YAML. Useful for quick testing of the same endpoint with different methods.
- **Copyable outputs**: Output values in the response panel can be copied with a click.
- **Extract variable from output**: Click on a value in the response body to automatically create an output extraction path for that value.

---
