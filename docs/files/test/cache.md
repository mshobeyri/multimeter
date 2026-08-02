# cache

Optional. Declared on a `type: test` file immediately before `steps` (or `stages`). When this test is **imported and called** again in the **same root run** with the same `title` + inputs, Multimeter returns the previous outputs instead of re-running the callee body (no nested server/HTTP work for that invocation). Caller `expect` / `check` / `assert` still run as usual. Report UIs replace the pass/fail icon with a dedicated cached icon (`db_pass` / `db_error`) when a step was served from cache.

`cache` is a single scalar. Detection:

| Value | How it is detected | Expiry |
|-------|--------------------|--------|
| `1s`, `5m`, `1h`, `1h5m`, … | Same duration grammar as `repeat` / `delay` | `now + duration` |
| Text containing `:` (e.g. `2026-12-31T23:59:59Z`) | Standard date/time | Absolute wall-clock |
| Bare number (e.g. `1735689600`) | No unit and no `:` | Unix epoch (seconds if `< 1e12`, else milliseconds) |

Notes:
- Phase 1 applies only to **`type: test`** callees (not `type: api`).
- Cache lives for one root run only (one editor Run / one CLI invocation).
- Direct Run of the cached file always executes the body (so you can debug it).
- See `examples/intermediate/24_test_call_cache` and design notes in `AI/sdd/sdd-test-call-cache.md`.

Worked examples: [Cache examples](./cache-examples.md).

Next: [Cache examples](./cache-examples.md) · [import](./import.md) · [call](./call.md)
