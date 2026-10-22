# Cache

View-only mirror of in-run Multimeter caches in the Multimeter activity bar.

Use the **Cache** panel ({{btn:database:Cache}}) to see active `cache:` entries while a test, suite, or live-env read is running. The panel does not change cache policy: when the run ends (or TTL expires), the list empties.

## What you can use it for

- Confirm a cached test call was stored (title, inputs, outputs, time left)
- Watch live-env file reads that honor `cache:` on the target
- Open the source `.mmt` from the row title without hunting in the explorer
- Inspect JSON inputs/outputs without changing runtime behavior

## What appears

| Kind | Badge | Source | What the row shows |
|---|---|---|---|
| **test call** | `test` | Imported `type: test` with `cache:` (call cache) | Test title; **in** / **out**; remaining TTL |
| **live env** | `live` | File-backed env `./….mmt` after an `e:` read when the target has `cache:` | Env var name; **in** (defaults) / **out** (cached value); remaining TTL |

See [Test cache](../files/test/cache.md), [Call cache](../features/call-cache.md), and [Live variables](../files/env/live-variables.md).

## Row layout

Each row:

| Element | What it shows |
|---|---|
| **Title** (left) | Test title, or live-env variable name. Link-styled when a source file path is known |
| **Type badge** (right) | `test` or `live` |
| **Time remaining** (right) | TTL left (`12s`, `4m 3s`, …) — updates about once per second while the panel is visible |
| **in** | One-line JSON preview of inputs (empty object for live env) |
| **out** | One-line JSON preview of outputs (test) or cached value (live env) |

## Interactions

| Action | Result |
|---|---|
| Click the **title** | Opens the source `.mmt` in the Multimeter editor (test file or live-env target) |
| Click **in** or **out** | Expand or collapse pretty-printed JSON |
| {{btn:refresh:Refresh}} (toolbar) | Re-read the in-memory snapshot immediately |

Expand/collapse state is kept across the 1s refresh while the same entries remain.

## Behavior

- Refresh runs about once per second **only while the panel is visible**
- No clear / edit / TTL override — observation only
- Empty between runs (same keep policy as the runtime caches: in-memory for one top-level run)
- CLI-only or core-only processes outside the extension host do not populate this panel — it mirrors caches in the VS Code extension run

## Notes and limits

- A **test** row appears after a cache miss stores outputs (imported call, or a direct Run of a cached test that seeds the cache). Hits reuse that entry until expiry.
- A **live** row appears after an `e:` read of a file-backed env var whose target declares `cache:` and the TTL has not expired.
- Titles without a resolvable `filePath` are not clickable (plain text, not link-colored).

---

## See also

- [Panels](./index.md) — all sidebar and bottom panels
- [Connections](./connections.md) — live HTTP keep-alive and WebSocket sessions
- [Test cache](../files/test/cache.md) · [Call cache](../features/call-cache.md)
- [Live variables](../files/env/live-variables.md)
