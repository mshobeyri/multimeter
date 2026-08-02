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

- var:
    attempt: 1

- const:
    role: "admin"

- let:
    note: "temp"
```

When to use which:
- `set`: creates or updates a variable in the current scope (mutable). Use for values that change across steps.
- `var`: function-scoped variable (hoisted). Rarely needed; prefer `let`.
- `const`: block-scoped, cannot be reassigned. Use for values that shouldn't change.
- `let`: block-scoped, can be reassigned. Use for loop counters or temporary values.

## `setenv`
Set environment variables during a run. This is mainly useful when you run a test directly (not as an imported sub-test), because it updates the runtime environment for subsequent calls.

```yaml
- setenv:
    token: "${doLogin.token}"
    user_id: "${me.id}"
```

Notes:
- Values can be strings (template strings supported) or non-string literals.
- When running a suite, setenv events are still emitted but may be scoped to the top-level run behavior.

## `data`
Bind an imported CSV alias (from the test's import section) into scope for use in loops and steps.
```yaml
- data: users   # where import:
                #   users: ./users.csv
```

See [Data-driven tests](../../../features/data-driven-tests.md) for a full CSV loop example.
