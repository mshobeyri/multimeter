# judge

AI judgment for non-deterministic responses. Uses **`context`** plus soft **`expect`** / hard **`require`** — same soft-inline idea as call `expect`. Reporting is **one box** (batched like call `expect`).

Import a [`type: judge`](../../judge/index.md) file, pass context, then evaluate.

## Example

```yaml
type: test
import:
  chat: ./apis/chat.mmt
  localJudge: ./judges/local.mmt

steps:
  - call: chat
    id: response
    inputs:
      question: "Can I return a product after 20 days?"

  - judge: localJudge
    id: j1
    title: Return-policy reply quality
    context:
      actual: ${response.body.message}
      expected: "The customer can return the product within 30 days."
      policy: ${returnPolicy}
    expect:
      answerRelevance: 0.80
      semanticSimilarity: 0.90
      criteria:
        - The response should answer the customer's question directly.
        - The response should be concise.
    require:
      contextFaithfulness: 0.50
      semanticSimilarity: 0.50
```

| Field | On failure | Behavior |
|-------|------------|----------|
| `expect:` | Soft fail | Report and **continue** |
| `require:` | Hard fail | Report and **stop** |

At least one of `expect` / `require` is required. One model call scores metrics once; **each level applies its own threshold**. The same metric (e.g. `semanticSimilarity`) can appear in both — a mid-range score can fail `expect` and still pass `require`.

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `judge` | yes | Import alias of a `type: judge` file |
| `context` | yes | Key/value map for the judge (not limited to `actual`/`expected`) |
| `expect` | one of expect/require | Soft metrics + optional `criteria` |
| `require` | one of expect/require | Hard metrics + optional `criteria` |
| `id` | no | Capture result (`passed`, `checks`, `criteria`, …) |
| `title` | no | Report label |
| `report` | no | Same as check/assert |

Inside `expect` / `require`:

| Key | Description |
|-----|-------------|
| *(built-in check id)* | Named metric — see [Built-in checks](#built-in-checks) |
| `<otherMetric>` | Custom named metric (model scores 0..1) |
| `criteria` | Free-text rules (list of strings) |

Bare numbers are threshold shorthand (`semanticSimilarity: 0.8` ≡ `{ threshold: 0.8 }`).

### Built-in checks

Prefer these named checks for common cases so you do not rewrite the same `criteria` every time. Keep `criteria` for one-off rules.

| Check | Typical context | Suggested threshold | Use when |
|-------|-----------------|---------------------|----------|
| `semanticSimilarity` | `actual`, `expected` | `0.8` | You have a reference / golden answer |
| `answerRelevance` | `actual`, `question` | `0.8` | Q&A / chat / support replies |
| `contextFaithfulness` | `actual`, `policy`, `retrievedContext` | `0.7` | Anti-hallucination / RAG / policy |
| `factuality` | `actual`, `expected`, `policy` | `0.7` | Correctness vs known facts |

| Check | What the model scores |
|-------|------------------------|
| `semanticSimilarity` | Meaning similarity of `actual` vs `expected` (not exact wording) |
| `answerRelevance` | Whether `actual` answers `question` / the implied user request |
| `contextFaithfulness` | Whether `actual` stays grounded in `policy` / `retrievedContext` |
| `factuality` | Factual consistency of `actual` vs `expected` and other ground-truth fields |

You can still invent custom metric names; the model scores them 0..1 from the name and context.

Common `context` keys: `actual`, `expected`, `policy`, `question`, `retrievedContext`, `history`.

## Reporting

One batched report listing each expect/require item. The step stops only if a **`require:`** item fails; soft `expect` failures keep the test running. Overall step `id` holds the full result.

## Related

- [Judge files](../../judge/index.md)
- [check](./check.md) · [assert](./assert.md) · [call expect / require](./call.md#expect)
