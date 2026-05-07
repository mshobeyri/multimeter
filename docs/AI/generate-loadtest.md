This file tells the AI how to generate type: loadtest .mmt files.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be type: loadtest.
- Load tests should reference exactly one existing type: test file via the top-level test field.

---

## Schema (mental model for the AI)

Top-level keys and types:

```yaml
type: loadtest

title: string

tags:
  - string

description: string

environment:
  preset?: string
  file?: string
  variables?:
    <name>: <value>

threads: number
repeat: string | number
rampup: string

export:
  - path/to/report.mmt

test: path/to/test.mmt
```

Guidelines:
- Use test, not tests.
- Do not add servers; load tests do not support suite-level servers.
- Keep the referenced file a type: test document.

Example:

```yaml
type: loadtest
title: Login load test
tags: [load, auth]
threads: 100
repeat: 1m
rampup: 10s
test: ./tests/login.mmt
```
