# var, const, let

Create or change variables for later steps. `set` mutates existing values (or creates new ones); `var` / `const` / `let` follow JavaScript scoping.

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

| Step | Behavior |
|------|----------|
| `set` | Creates or updates a variable in the current scope (mutable). Use for values that change across steps. |
| `var` | Function-scoped variable (hoisted). Rarely needed; prefer `let`. |
| `const` | Block-scoped, cannot be reassigned. Use for values that should not change. |
| `let` | Block-scoped, can be reassigned. Use for loop counters or temporary values. |

For log messages, use [print](./print.md). For environment variables at runtime, use [setenv](./setenv.md).

---

See also: [print](./print.md) · [setenv](./setenv.md) · [js](./js.md) · [for](./for.md) · [Dynamic values](../../../features/dynamic-values/index.md)
