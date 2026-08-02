# Load Test quick start

Minimal load test that runs one test file with concurrency:

```yaml
type: loadtest
title: Echo Load Test
threads: 5
repeat: 10s
rampup: 2s
test: ./echo_test.mmt
```

Open the file in VS Code and click {{btn:play:Run load test}} in the load test panel. Watch live load metrics while the run is active.

More: [Edit Load Test](./edit.md) · [Load config](./load-config.md) · [CLI](./cli.md)
