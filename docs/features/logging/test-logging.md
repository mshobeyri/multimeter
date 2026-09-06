# Test logging

### Checks and asserts

The log level for each check/assert result follows the [report configuration](../../files/test/steps/assert.md#report-configuration):

| Report level | On fail | On pass |
|-------------|---------|---------|
| `all`       | `error` | `info`  |
| `fails`     | `error` | `debug` |
| `none`      | `debug` | `trace` |

Default report levels:

- **Direct run** (`internal`): `all` — failures log at `error`, passes at `info`
- **Imported or in suite** (`external`): `fails` — failures log at `error`, passes at `debug`

This means during a direct test run you see all check results prominently, while imported test checks only surface failures unless you lower the log level.

```yaml
# Example: custom report levels per check
steps:
  - call: myAPI
  - check:
      actual: _.status
      expected: 200
      report:
        internal: all    # direct run: pass=info, fail=error
        external: none   # imported: pass=trace, fail=debug
```

### Print steps

| Context | Level |
|---------|-------|
| Direct run | `info` |
| Imported or in suite | `debug` |

### Network requests (call steps)

When a test calls an API via a `call` step or a `judge` step, the request and response (headers, body) are logged at `trace` level. Auth headers (`Authorization`, `x-api-key`, …) are redacted. Lower the log level to `trace` to see full network details during test runs.

Judge panel **Refresh status** (list-models) also writes the same trace lines to the Multimeter Output channel.
