# print

Write a message to the log output. Useful for progress notes and debugging during a run.

```yaml
- print: "Starting flow"
- print: "status=${doLogin.status}"
```

Messages support `${...}` interpolation for step results and variables. Log level for print depends on whether the test is running directly or imported — see [Test logging](../../../features/logging/test-logging.md#print-steps).

---

See also: [var, const, let](./variables.md) · [js](./js.md) · [Logging](../../../features/logging.md)
