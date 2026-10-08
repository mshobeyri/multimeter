# Variables and data

## `print`
Write a message to the log output.
```yaml
- print: "Starting flow"
```

## set, var, const, or let
Create or change variables for later steps. `set` mutates existing (or creates new); `var`/`const`/`let` follow JS scoping.

```yaml
- set:
    token: ${doLogin.token}   # mutable
    o:token: ${doLogin.token} # writes outputs.token
    o:user.name: "alice"      # nested outputs field

- var:
    attempt: 1

- const:
    role: "admin"

- let:
    note: "temp"
```

Use `o:name` (or nested `o:user.name`) as a **`set` key** to assign the test’s `outputs` object. Read the same fields anywhere with `o:name`, `<<o:name>>`, or `${outputs.name}` — see [Dynamic values](../../../features/dynamic-values/index.md).

When to use which:
- `set`: creates or updates a variable in the current scope (mutable). Use for values that change across steps.
- `var`: function-scoped variable (hoisted). Rarely needed; prefer `let`.
- `const`: block-scoped, cannot be reassigned. Use for values that shouldn't change.
- `let`: block-scoped, can be reassigned. Use for loop counters or temporary values.

## `setenv`
Set environment variables at runtime. See [setenv](./setenv.md).
