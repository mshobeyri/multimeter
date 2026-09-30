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

These become available to subsequent steps/tests as environment variables (`e:token`, `<<e:token>>`).

See [Environment](../env/index.md) for defining variables, presets, and how `e:` / `<<e:…>>` resolve at runtime.

Example (Vault / OpenBao over HTTP + setenv): [professional Vault HTTP setenv](../../../examples/professional/10_vault_http_setenv/README.md).

Deprecated: referencing an `outputs` key by name still works for compatibility:
```yaml
setenv:
  token: token   # deprecated — prefer body.access_token
```
In the YAML editor, deprecated values are struck through; click to replace them with the output’s extraction expression.
