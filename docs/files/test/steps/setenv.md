# setenv

Set environment variables during a run. Later steps, imported tests and later suite items read them as `e:name` or `<<e:name>>`.

```yaml
- setenv:
    token: "${doLogin.token}"
    user_id: "${me.id}"
```

All keys in one `setenv` step are applied together (one atomic update to the runtime environment).

Notes:
- Values can be strings (template strings supported) or non-string literals.
- Values live in memory for the run (they are not written to env files) and win over `-e` values for later items.
- When running a suite, setenv events are still emitted but may be scoped to the top-level run behavior.

To promote values from an API response automatically, use the API-level [`setenv`](../../api/setenv.md) field instead.

Example: [setenv chain](../../../../examples/intermediate/31_setenv_chain/README.md).
