# Call cache

Reuse login and other setup in the **same run**, so those HTTP calls are not repeated for every case. The request under test still goes to the network.

Put `cache:` on an imported `type: test` file. The duration is yours to choose (`5m`, `1h`, `30s`, …). For example, `cache: 5m` means that calling this test again with the **same inputs** returns the **same results** until that TTL expires. The callee body, including its HTTP calls, does not run again. A call with different inputs runs normally and stores its own result. Caller checks still run.

```yaml
type: test
title: Create session
cache: 5m
inputs:
  user: alice
  pass: secret
outputs:
  token: ''
import:
  login: ./api/login.mmt
steps:
  - call: login
    id: auth
    inputs:
      username: i:user
      password: i:pass
  - js: |
      outputs.token = auth.token
```

```yaml
type: test
title: Use cached session
import:
  session: ./create_session.mmt
steps:
  - call: session
    id: first
    inputs:
      user: alice
      pass: secret
  # Same inputs within the TTL: same token, login is not called again.
  - call: session
    id: second
    inputs:
      user: alice
      pass: secret
    expect:
      token: == ${first.token}
```

This does not apply to `type: api` files. The cache is in memory for one top-level run (shared across suite siblings until the TTL expires). Direct Run of the cached file always executes the body.

Full rules: [cache on tests](../files/test/cache.md). A working copy is in [examples/intermediate/24_test_call_cache](../../examples/intermediate/24_test_call_cache).

See also: [call](../files/test/steps/call.md) · [Parallel runs](./parallel-runs.md) · [import](../files/test/import.md)
