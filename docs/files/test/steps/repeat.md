# repeat

`repeat` runs the inner `steps:` a fixed number of times, for a duration, or indefinitely.

```yaml
# repeat N times
- repeat: 3
  steps:
    - call: poll
    - delay: 2s

# repeat for a duration
- repeat: 30s
  steps:
    - call: healthCheck

# other time units: ns, ms, s, m, h
- repeat: 5m
  steps:
    - call: poll

# combined durations
- repeat: 1h5m
  steps:
    - call: poll
- repeat: 5m3s
  steps:
    - call: poll

# repeat indefinitely (until manually stopped)
- repeat: inf
  steps:
    - call: monitor
    - delay: 1s
```

---

See also: [for](./for.md) · [if](./if.md) · [delay](./delay.md) · [call](./call.md)
