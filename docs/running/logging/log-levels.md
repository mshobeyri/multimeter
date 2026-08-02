# Log levels

| Level   | Meaning |
|---------|---------|
| `trace` | Lowest detail — network request/response summaries during test runs, check results when reporting is off |
| `debug` | Network request/response for API runs, environment variables, imported check passes, imported print output |
| `info`  | Inputs, outputs, check passes (direct run), print output, run lifecycle messages |
| `warn`  | Non-fatal issues (e.g. example not found) |
| `error` | Check/assert failures, runtime exceptions |

A run is marked as **failed** if any `error`-level message is logged.
