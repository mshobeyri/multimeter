# Test Call Cache

Advanced example: a session-style test declares `cache: 5m` so repeated `call:`s with the same title + inputs reuse outputs within one root run (second call skips nested HTTP).

Design: `AI/sdd/sdd-test-call-cache.md`. User docs: [Test `.mmt` — cache](../../../docs/files/test/cache.md).

## Files

| File | Description |
|------|-------------|
| `api/login_echo.mmt` | Stand-in “login” API (echo) that returns a token-like field |
| `create_session.mmt` | Cached test (`cache: 5m`) that calls the API and exports `token` |
| `use_session_cache.mmt` | Parent: two identical session calls (cache hit) + one different user (miss) |

## How to use

### In VS Code

1. Open `use_session_cache.mmt` and **Run**.
2. First `call: session` performs HTTP; the second identical call should be served from cache (database icon next to pass/fail once the feature is wired in the UI).
3. The third call uses different inputs → cache miss → HTTP again.

### With the CLI

```sh
npx testlight run examples/intermediate/24_test_call_cache/use_session_cache.mmt
```

## Key concepts

- **`cache` on the callee test** — scalar duration / epoch / date-time; not on `type: api` in phase 1.
- **Key = title + inputs** — same session title and same inputs → same outputs.
- **Bypass body only** — nested server/HTTP in the callee is skipped on hit; caller expects still run.
- **Same root run only** — no disk; cleared when the run ends.
