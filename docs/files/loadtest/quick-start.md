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

Open the file in VS Code to get the **load test panel** on the right. Click {{btn:play:Run load test}} to start the run and watch live metrics.

More: [Edit Load Test](./edit.md) · [Elements](./elements.md) · [Running](./running.md) · [CLI](./cli.md)
