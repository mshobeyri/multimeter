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
- In VS Code, `setenv` from API, test, and suite runs is also written to the Environment panel (workspace storage) so later manual Sends can reuse the values. Suite runs coalesce keys and refresh the panel once when the suite finishes (not on every step). `testlight` has no durable env store — CLI stays run-scoped only.

To promote values from an API response automatically, use the API-level [`setenv`](../../api/setenv.md) field instead.

Example: [setenv chain](../../../../examples/intermediate/31_setenv_chain/README.md).
