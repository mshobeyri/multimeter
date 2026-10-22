# Cache

View-only mirror of in-run Multimeter caches in the Multimeter activity bar.

Use the **Cache** panel ({{btn:database:Cache}}) to see active `cache:` entries while a test, suite, or live-env read is running. The panel does not change cache policy: when the run ends (or TTL expires), the list empties.

## What appears

| Kind | Source | Key fields |
|---|---|---|
| **test** | Imported `type: test` with `cache:` (call cache) | Title, inputs, outputs, time remaining |
| **live env** | File-backed env `./….mmt` after an `e:` read with target `cache:` | Env name, file path, value, time remaining |

See [Test cache](../files/test/cache.md) and [Live variables](../files/env/live-variables.md).

## Behavior

- Each row: **title** (left) with **type** badge and **time remaining** (right); **in** and **out** on the next two lines
- Click the title to open the source `.mmt` file; click **in** / **out** to expand or collapse the JSON
- Refresh runs about once per second **only while the panel is visible**
- No clear / edit actions — observation only
- Empty between runs (same keep policy as the runtime caches)

## Toolbar

| Control | What it does |
|---|---|
| {{btn:refresh:Refresh}} | Re-read the current in-memory cache snapshot immediately |

---

See also: [Panels](./index.md) · [Connections](./connections.md)
