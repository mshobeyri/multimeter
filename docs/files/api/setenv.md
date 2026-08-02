# setenv

### setenv
Promote values from the response into the runtime environment after an API run.

Values use the **same extraction expressions as `outputs`** (paths, regex, keywords):
```yaml
outputs:
  token: body.access_token
setenv:
  TOKEN: body.access_token
  USER_ID: body.user.id
```

These become available to subsequent steps/tests as environment variables (`e:TOKEN`, `<<e:TOKEN>>`).

See [Environment](../env/index.md) for defining variables, presets, and how `e:` / `<<e:…>>` resolve at runtime.

Deprecated: referencing an `outputs` key by name still works for compatibility:
```yaml
setenv:
  TOKEN: token   # deprecated — prefer body.access_token
```
In the YAML editor, deprecated values are struck through; click to replace them with the output’s extraction expression.
