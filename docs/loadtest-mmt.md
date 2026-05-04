# Load Test .mmt

type: loadtest runs one type: test file with load-oriented configuration.

## Shape

```yaml
type: loadtest
title: Login load test
description: Stress the login flow
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
test: ./tests/login.mmt
```

## Fields

- test: required path to a single type: test file.
- threads: target concurrency.
- repeat: duration or iteration limit, for example 1m or 1000.
- rampup: time to reach the target thread count.
- environment: optional env overlay, same shape as suite environment.
- export: optional report export paths.

## Differences From suite

- Uses test, not tests.
- Does not support servers.
- Targets one test file instead of an execution graph.

## Notes

- The referenced file should remain type: test.
- Functional test reports and load test reports may diverge in payload shape even though both are exported as type: report files.
