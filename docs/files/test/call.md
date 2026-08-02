# call

### call
Invoke an imported API or another test; give it an id to reference its outputs later. The `call` field must be the first key in the step.
```yaml
# call an API named login
- call: login
  id: doLogin
  inputs:
    username: i:user
    password: i:pass

# call another test named getUser
- call: getUser
  id: profile
  inputs:
    token: ${doLogin.token}
```

Pass unquoted `omit` to drop a field from the request the called API builds — the
field is removed instead of being sent with a value. Use `"omit"` (quoted) to
send the literal string:
```yaml
- call: echo
  id: result
  inputs:
    message: omit
```
