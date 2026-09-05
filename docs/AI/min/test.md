# Generate `type: test` (min)

Prefer `scaffold_test` / `testlight scaffold test --from` for new API tests.

```yaml
type: test
title: Login smoke
tags: [smoke]
import:
  login: ../apis/login.mmt
inputs:
  username: i:username
  password: i:password
steps:
  - call: login
    id: iLogin
    inputs:
      username: i:username
      password: i:password
    expect:
      status: 200
```

## Essentials

- First line: `type: test`
- Use `steps` **or** `stages`, not both
- Every `call` needs unique `id`
- Import aliases before calling them
- Assert with `expect` on call, or `assert` / `check` steps
- No YAML comments (`#`)
- Tokens: `e:`, `i:`, `r:`, `c:` (snake_case)

## Common steps

- `call: <alias>` — invoke imported API/test
- `http: <url>` — inline HTTP
- `assert: ${id.status} == 200`
- `check:` map of path → expected
- `js: |` — small helper script when needed

Request `pack: full` for stages, loops, CSV, cache, and advanced expect ops.
