# Golden smoke pair (AI)

Canonical low-token example. Mirror this shape; prefer `scaffold_test` over inventing YAML.

## API — `examples/ai/golden_smoke/apis/echo.mmt`

```yaml
type: api
title: Echo message
description: Golden smoke API for AI agents — minimal POST with outputs
method: post
url: https://test.mmt.dev/echo
format: json
inputs:
  message: hello
outputs:
  echoed: body.message
body:
  message: i:message
```

## Test — `examples/ai/golden_smoke/tests/echo-smoke.mmt`

Produced by `scaffold_test` / `testlight scaffold test --from` (do not hand-author from scratch):

```yaml
type: test
title: Echo message smoke test
description: Smoke test for API "Echo message".
tags:
  - smoke
  - post
import:
  echo: ../apis/echo.mmt
inputs:
  message: i:message
steps:
  - call: echo
    id: iEcho
    inputs:
      message: i:message
    expect:
      status: 200
      echoed: != null
```

## Agent rules

1. New API test → `scaffold_test` first.
2. Then `validate` → `format`.
3. Modify → patch only (never full-file rewrite unless the user asks).
4. After a run, to tighten asserts → `suggest_assertions` → patch → `validate` → `format`.
