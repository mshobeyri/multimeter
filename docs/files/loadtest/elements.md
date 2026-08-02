# Load test elements

Fields for `type: loadtest` files. See [Load Test](./index.md) for an overview example.

### title, description, tags

- `title`: Shown in the UI and reports.
- `description`: Short explanation of what the load test measures.
- `tags`: Array such as `load`, `perf`, `smoke`, or `api`.

### `import`

Top-level data imports from `.json`, `.yaml`, `.yml`, and `.csv`. Use `${alias.path}` to feed load settings from a shared fixture.

```yaml
type: loadtest
import:
  perf: ./perf.json
threads: ${perf.threads}
repeat: ${perf.repeat}
test: ./tests/login.mmt
```

See [Data Imports](../../integration/data-imports.md).

### `test`

Required path to a single `type: test` file — the scenario each virtual user/iteration runs.

- **Relative** to the load test file (e.g. `./tests/login.mmt`)
- **Project root** with `+/` (e.g. `+/tests/login.mmt`)

Keep the referenced file a normal functional test; put load settings only in the `type: loadtest` wrapper.

### threads

Optional target concurrency; defaults to `1`.

```yaml
threads: 25
```

### `repeat`

Required. Controls when the load test stops.

```yaml
repeat: 10s     # duration
repeat: 1m      # duration
repeat: 1000    # total iterations across all threads
```

- Numeric (`repeat: 1000`): exactly that many total iterations across all threads.
- Duration (`repeat: 1m`): keep starting iterations until the duration expires.

With `threads` > 1, numeric repeat is still a **total** count, not per-thread.

### rampup

Optional; defaults to `0s`. How long Multimeter takes to reach the target thread count.

```yaml
rampup: 30s
```

With `threads: 100` and `rampup: 10s`, workers start gradually over 10 seconds.

See also: [Load Test](./index.md) · [Environment & export](./environment.md) · [Reference](./reference.md)
