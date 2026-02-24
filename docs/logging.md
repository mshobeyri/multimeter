# Logging

Multimeter logs detailed information when running `.mmt` files. Logs are organized by **level** so you can control how much detail you see.

## Log levels

| Level   | Meaning |
|---------|---------|
| `trace` | Lowest detail — network request/response summaries during test runs, check results when reporting is off |
| `debug` | Network request/response for API runs, environment variables, imported check passes, imported print output |
| `info`  | Inputs, outputs, check passes (direct run), print output, run lifecycle messages |
| `warn`  | Non-fatal issues (e.g. example not found) |
| `error` | Check/assert failures, runtime exceptions |

A run is marked as **failed** if any `error`-level message is logged.

## Where logs appear

| Entry point | Log destination |
|-------------|----------------|
| **Editor** (run glyph / UI button) | VS Code Output panel → **Multimeter** channel |
| **CLI** (`testlight`) | Terminal stdout |
| **AI assistant** (`@multimeter /run`) | VS Code Output panel → **Multimeter** channel |

In VS Code, open the Output panel (`View → Output`) and select **Multimeter** from the dropdown. The Output panel's built-in log level filter controls which levels are shown.

The CLI prints all levels to stdout. Use `--quiet` to suppress non-error output.

## Test logging

### Checks and asserts

The log level for each check/assert result follows the [report configuration](./test-mmt.md#report-configuration):

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
      actual: statusCode_
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

When a test calls an API via a `call` step, the request and response are logged at `trace` level. Lower the log level to `trace` to see full network details during test runs.

## API logging

When running an API `.mmt` file directly:

| What | Level |
|------|-------|
| Inputs | `info` |
| Outputs | `info` |
| Request (url, method, headers, body) | `debug` |
| Response (status, headers, body) | `debug` |
| Environment variables | `debug` |

## Suite logging

Suite runs apply the same test and API policies above to each child item. Additional suite-level messages:

| What | Level |
|------|-------|
| Starting a suite item | `info` |
| Suite item failure | `error` |
| Suite cancelled | `warn` |

Since child tests run with the `external` report config by default, check passes log at `debug` and only failures appear at `error`. Use the report config on individual checks to override this.

## Tips

- **See more detail**: In VS Code, set the Multimeter output channel log level to `Trace` or `Debug`.
- **See less detail**: Set it to `Info` or `Warning`.
- **CLI**: Use `--quiet` to only see errors, or `--log-level` to set the threshold.
- **Debugging test failures**: Lower the log level to `trace` to see the full request/response for each API call in your test flow.

---

## See also
- [Test](./test-mmt.md) — test file format, check/assert steps and report configuration
- [API](./api-mmt.md) — API file format, inputs, outputs, and examples
- [Suite](./suite-mmt.md) — suite file format and execution
- [Environment](./environment-mmt.md) — variables and presets
- [Testlight CLI](./testlight.md) — running from the command line
