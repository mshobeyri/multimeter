# Generate `type: loadtest` (min)

```yaml
type: loadtest
test: ./echo_test.mmt
threads: 10
repeat: 30s
rampup: 5s
```

## Essentials

- First line: `type: loadtest`
- Points at a `type: test` file
- `threads`, `repeat`, optional `rampup` / `duration`

Request `pack: full` for metrics and advanced timing.
