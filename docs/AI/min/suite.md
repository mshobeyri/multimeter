# Generate `type: suite` (min)

```yaml
type: suite
title: Smoke suite
items:
  - ./tests/login-smoke.mmt
  - ./tests/echo-smoke.mmt
```

## Essentials

- First line: `type: suite`
- `items` lists `.mmt` paths (tests, apis, suites)
- Use `then` between groups for sequencing; same group runs in parallel
- Optional: `servers` (starts with that suite, including nested). Root-only: `environment`, `export`

Request `pack: full` for nested suites, env export, and report options.
