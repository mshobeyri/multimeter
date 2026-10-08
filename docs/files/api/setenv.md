# setenv

### `setenv`
Promote values from the response into the runtime environment after an API run.

In the API tester, **Setenv** lives on the response **Outputs** tab: view mode shows which env variables were set to what after Send; the pencil opens edit mode for the extraction expressions (same editor formerly under Settings).

Values use the **same extraction expressions as `outputs`** (paths, regex, keywords):
```yaml
outputs:
  token: body.access_token
setenv:
  token: body.access_token
  user_id: body.user.id
```

These become available immediately to subsequent steps, imported tests and later suite items as environment variables (`e:token`, `<<e:token>>`). This applies to a test calling the API, to the API tester, and to `testlight`. Values live in memory for the run (they are not written to env files) and win over `-e` values for later items.

Example: [setenv chain](../../../examples/intermediate/31_setenv_chain/README.md).

See [Environment](../env/index.md) for defining variables, presets, and how `e:` / `<<e:…>>` resolve at runtime.

Example (Vault / OpenBao over HTTP + setenv): [professional Vault HTTP setenv](../../../examples/professional/10_vault_http_setenv/README.md).

Deprecated: referencing an `outputs` key by name still works for compatibility:
```yaml
setenv:
  token: token   # deprecated — prefer body.access_token
```
In the YAML editor, deprecated values are struck through; click to replace them with the output’s extraction expression.
