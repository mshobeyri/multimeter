# Suite logging

Suite runs apply the same test and API policies above to each child item. Additional suite-level messages:

| What | Level |
|------|-------|
| Starting a suite item | `info` |
| Suite item failure | `error` |
| Suite cancelled | `warn` |

Since child tests run with the `external` report config by default, check passes log at `debug` and only failures appear at `error`. Use the report config on individual checks to override this.
