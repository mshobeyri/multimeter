# Load Test

Use `type: loadtest` to define a load test MMT file. A load test runs one `type: test` file repeatedly with concurrency, ramp-up, duration or iteration limits, and load-oriented reporting.

> **Beta:** Load testing is currently supported in beta mode. The file shape and report schema are stable enough for local and CI use, but advanced distributed load execution and deeper threshold controls may still evolve.

Example:

```yaml
type: loadtest
title: Login Load Test
description: Run the login flow with 100 virtual users for one minute.
tags:
  - load
  - auth
environment:
  preset: perf
threads: 100
repeat: 1m
rampup: 10s
export:
  - ./reports/login-load.mmt
  - ./reports/login-load.html
test: ./tests/login.mmt
```

Field-by-field details (`title`, `import`, `test`, `threads`, `repeat`, `rampup`): [Load test elements](./elements.md).

Next: [Elements](./elements.md) · [Environment & export](./environment.md) · [Running](./running.md) · [Reports](./reports.md) · [Reference](./reference.md)
