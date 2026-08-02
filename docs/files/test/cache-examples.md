# Cache examples

Cached callee (returns a token; second call in the same root run can reuse it):

```yaml
type: test
title: Create session
cache: 5m
inputs:
  user: e:USER
  pass: e:PASS
outputs:
  token: ''
import:
  login_api: ./login_api.mmt
steps:
  - call: login_api
    id: auth
    inputs:
      username: i:user
      password: i:pass
  - js: |
      outputs.token = auth.token
```

Parent test (calls twice with the same inputs — second call is a cache hit):

```yaml
type: test
title: Use cached session
import:
  session: ./create_session.mmt
steps:
  - call: session
    id: a
    inputs:
      user: alice
      pass: secret
    expect:
      token: != null
  - call: session
    id: b
    inputs:
      user: alice
      pass: secret
    expect:
      token: == ${a.token}
```

Path resolution for imports (`./…`, `+/…`) and CSV/JSON/YAML data imports are documented under [import](./import.md) and [Data Imports](../../integration/data-imports.md).

See also: [cache](./cache.md) · [call](./steps/call.md) · [Inline expect](./steps/run-expect.md)
