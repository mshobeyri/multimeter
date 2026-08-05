# cache

Optional. Declared on a `type: test` file immediately before `steps` (or `stages`). When this test is **imported and called** again in the **same top-level run** (a single test, suite, or suite-of-suites hierarchy) with the same `title` + inputs, Multimeter returns the previous outputs instead of re-running the callee body (no nested server/HTTP work for that invocation). Caller `expect` / `check` / `assert` still run as usual. Report UIs replace the pass/fail icon with a dedicated cached icon (`db_pass` / `db_error`) when a step was served from cache.

`cache` is a single scalar. Detection:

| Value | How it is detected | Expiry |
|-------|--------------------|--------|
| `1s`, `5m`, `1h`, `1h5m`, … | Same duration grammar as `repeat` / `delay` | `now + duration` |
| Text containing `:` (e.g. `2026-12-31T23:59:59Z`) | Standard date/time | Absolute wall-clock |
| Bare number (e.g. `1735689600`) | No unit and no `:` | Unix epoch (seconds if `< 1e12`, else milliseconds) |

Notes:
- Applies only to **`type: test`** callees (not `type: api`).
- Cache lives for one top-level run: shared across suite siblings and nested suites until TTL expires or that run finishes. No disk; not kept across separate editor/CLI Runs.
- Direct Run of the cached file always executes the body (so you can debug it), and still seeds the in-run cache for later callers in the same hierarchy.
- See `examples/intermediate/24_test_call_cache` and design notes in `AI/sdd/sdd-test-call-cache.md`.

## Examples

Cached callee (returns a token; second call in the same root run can reuse it):

```yaml
type: test
title: Create session
cache: 5m
inputs:
  user: e:user
  pass: e:pass
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

See also: [import](./import.md) · [call](./steps/call.md) · [Inline expect](./steps/run-expect.md)
