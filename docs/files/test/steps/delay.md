# delay

Pause the flow for a duration.

```yaml
- delay: 500    # ms
- delay: 2s     # units: ns|ms|s|m|h
- delay: 1h5m   # combined duration
- delay: 5m3s   # combined duration
```

Often used inside [repeat](./repeat.md) or between [call](./call.md) / [http](./http.md) steps.

---

See also: [repeat](./repeat.md) · [for](./for.md) · [if](./if.md)
