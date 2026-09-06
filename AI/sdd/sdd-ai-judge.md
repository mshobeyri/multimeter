# SDD: MMT AI Judge (`type: judge` + `judge` step)

**Date:** 2026-09-05  
**Status:** Phase 1–3 largely implemented (core + Ollama + docs/example + schema/autocomplete/UI icon); cloud engines pending  
**Related:** product positioning (API workflows with non-deterministic responses); not an AI-eval platform

---

## Summary

Add **AI-based evaluation** to Multimeter without making AI the product identity.

- Deterministic validation stays on `check` / `assert` / `expect` / operators.
- New **`type: judge`** resource defines *who* judges (engine, model, connection).
- New **`judge`** step defines *what* to judge (`context` + soft **`expect`** / hard **`require`**).
- Editor: **`law`** icon (judge/scales), `JudgeSchema` + step schema, autocomplete, UI add menu.
- Users bring **their own** model subscription (OpenAI / Anthropic / Gemini / Azure) or run **local Ollama** — Multimeter does not host or resell AI.

**North star line:** *Test APIs even when the response isn’t exact — with the AI you already use.*

**Primary use case:** Evaluating non-deterministic / AI-generated (or otherwise fuzzy) responses **inside normal API/service workflows** (auth → call → side effects → judge).

---

## Goals

1. First-class mid-run judgment with **one report box** (batched like call `expect`).
2. Reusable Judge resources, thin test steps (same mental model as `api` + `call`).
3. Engine adapter architecture (Ollama first, then cloud / Azure-compatible).
4. Docs + examples + test editor UX (autocomplete, validation, report).
5. CLI parity via `testlight` (same `runner` path).

## Non-goals (v1–v2)

- Buffering / batching multiple judgments into one LLM request.
- Becoming Promptfoo/DeepEval (dataset matrices, arena A/B, hosted eval dashboards).
- Multimeter-hosted models or bundled API keys.
- Replacing deterministic operators with AI.
- Full RAG metric zoo on day one (faithfulness, context precision, …) — optional later as metrics under `check`/`assert`.
- Hard free-text criteria under `assert` (v1: `criteria` are always soft).

---

## Field review (suggested schema)

Overall shape is **good**. Issues / refinements before locking YAML:

| Field / idea | Verdict | Issue / change |
|--------------|---------|----------------|
| Separate `type: judge` vs `judge` step | Keep | Matches `api`/`call`. |
| Flexible `inputs:` map | Keep | Do **not** hard-code only `actual`/`expected`. Document **conventions** (`actual` recommended; `expected`, `policy`, `retrievedContext`, `question`, `history` as common keys). |
| Flat `check` / `assert` maps | Keep | Metric name → threshold (no nested `checks:`). |
| Top-level soft `criteria` | Keep | Free-text rules always continue on fail. |
| `semanticSimilarity: 0.80` | Refine | Bare number is **v1 shorthand** = threshold only; canonical form is object: `{ threshold: 0.80 }`. |
| Embedding metrics on a chat `engine` | Risk | `semanticSimilarity` may need embeddings, not the chat model. Adapter must either support embeddings for that engine or reject unsupported checks with a clear error. |
| `engine` / `model` / `config` / `options` | Keep | Right split; each adapter validates its own `config`. |
| `config.apiKey` with shell-style `${VAR}` | Fix | Use Multimeter env tokens with **lowercase** names: `e:openai_api_key` or `<<e:openai_api_key>>` — never uppercase `e:OPENAI_API_KEY`. |
| `timeout: 30s` | Keep | Align with existing `Timestr` (`30s`, `2m`, …). |
| Soft vs hard fail | Flat maps | Soft **`check:`** metrics + soft **`criteria:`**; hard **`assert:`** metrics only — not nested `checks`/`criteria` under blocks. |
| UI / autocomplete | Required | `JudgeSchema`, TestSchema judge step, Autocomplete (`judge` step + file), add menu creates `judge` (not print), **`law`** codicon. |
| No `id` / `title` / `report` | Add | Match other steps for reporting and `${id...}` access to judge outputs. |
| `criteria` as string list only | OK for v1 | Later allow `{ text, id }` for stable report keys. |
| Defaults only on step | Optional | Allow optional `defaults.checks` / `defaults.criteria` on the Judge file; step merges/overrides. |
| Buffering on Judge | Drop | Not needed; one execution → one judge invocation. |
| Judge as raw `type: api` call | Avoid in v1 | Prefer engine adapters; optional `engine: http` escape hatch later. |

### Required step keys (v1)

- Discriminator: **`judge`** (import alias) — required  
- `inputs` — required, non-empty; **recommend** `actual` for chat criteria  
- At least one of **`check`** / **`assert`** / **`criteria`** — required  

### Soft vs hard (resolved)

```yaml
- judge: localJudge
  id: j1
  title: Return-policy reply quality
  context:
    actual: ${reply}
    expected: ${expected}
    policy: ${policy}
  expect:                              # soft — continue on fail
    semanticSimilarity: 0.90
    criteria:
      - The response should answer whether a return is allowed.
      - The response should be concise.
  require:                             # hard — stop on fail
    semanticSimilarity: 0.50
```

One model call scores each metric once; **each level applies its own threshold** (same metric may fail `expect` and pass `require`). One report box; stop only if a **`require:`** item fails.

### Recommended Judge file keys (v1)

- `type: judge`, `engine`, `model`, `url` — required  
- `auth` — optional (same shape as API `auth`; e.g. OpenAI bearer)  
- `options` — optional (`temperature`, `timeout`, …)  
- `title` — optional  

**Env token convention:** Multimeter env names are always **lowercase** (`e:ollama_url`, `e:openai_api_key`). Do not use uppercase shell-style names in `.mmt` files.

---

## YAML shapes (locked for implementation)

### Judge resource

```yaml
type: judge
title: Local quality judge
engine: ollama          # ollama | openai | anthropic | google | azure-openai
model: qwen3:4b
url: e:ollama_url

options:
  temperature: 0
  timeout: 30s

# optional defaults merged into steps (step wins on conflict)
defaults:
  checks:
    semanticSimilarity:
      threshold: 0.80
```

**OpenAI**

```yaml
type: judge
engine: openai
model: gpt-4o-mini
url: https://api.openai.com/v1
auth:
  type: bearer
  token: e:openai_api_key
options:
  temperature: 0
  timeout: 30s
```

**Azure OpenAI**

```yaml
type: judge
engine: azure-openai
model: my-deployment-name
url: e:azure_openai_endpoint
auth:
  type: bearer
  token: e:azure_openai_api_key
options:
  apiVersion: "2024-10-21"
```

### Judge step (soft `expect` / hard `require`)

| Field | On failure | Behavior |
|-------|------------|----------|
| `expect:` | Soft fail | Report, **continue** |
| `require:` | Hard fail | Report, **stop** |

```yaml
type: test
import:
  chat: ./apis/chat.mmt
  localQualityJudge: ./judges/local.mmt

steps:
  - call: chat
    id: response
    inputs:
      question: "Can I return a product after 20 days?"

  - judge: localQualityJudge
    id: j1
    title: Return-policy reply quality
    report: all
    context:
      actual: ${response.body.message}
      expected: "The customer can return the product within 30 days."
      policy: ${returnPolicy}
    expect:
      semanticSimilarity: 0.90
      criteria:
        - The response should answer the customer's question directly.
        - The response should be concise.
    require:
      semanticSimilarity: 0.50
```

Icon: **`law`** (scales of justice — closest Codicon to a judge’s gavel/hammer).

### Result model (runtime + report)

```ts
interface JudgeCheckResult {
  name: string;           // e.g. semanticSimilarity
  passed: boolean;
  score?: number;
  threshold?: number;
  details?: string;
}

interface JudgeCriterionResult {
  index: number;
  text: string;
  passed: boolean;
  reason?: string;
  score?: number;
}

interface JudgeResult {
  passed: boolean;        // all checks + criteria passed
  checks: JudgeCheckResult[];
  criteria: JudgeCriterionResult[];
  raw?: unknown;          // optional adapter debug payload
}
```

Report via `checkExpects_`: **one** batched box with metric + criterion items.  
Throws only when an **`assert:`** metric fails.  
Step `id` exposes outputs, e.g. `${j1.passed}`, `${j1.checks}`, `${j1.criteria}`.

---

## Architecture

```
test step (judge)
  → resolve import alias → JudgeData
  → build JudgeRequest from expect + require (union metrics; score once)
  → JudgeEngineRegistry.get(engine).evaluate(request)
  → JudgeResult scores
  → apply each level's own thresholds → one checkExpects_ box
       require fail → type assert (stop)
       otherwise → type check (continue)
```

### Engine adapter interface (`core`)

```ts
interface JudgeEngine {
  readonly id: string;
  validate(judge: JudgeData): string[]; // empty = ok
  evaluate(req: JudgeRequest): Promise<JudgeResult>;
}
```

- **Ollama** — first adapter (local, no paid key).
- **openai** — chat completions + JSON verdict for criteria; embeddings if similarity check supported.
- **anthropic** / **google** / **azure-openai** — follow same contract; share helpers where APIs are compatible.
- Adapters own prompt templates for criteria; core owns merge of defaults, thresholds, and pass/fail aggregation.
- Network: prefer injected HTTP (same DI spirit as `core`) — no `fs` in core; keys from already-resolved env values.

### Checks vs criteria (engine responsibility)

| Kind | Who interprets | v1 |
|------|----------------|----|
| `criteria[]` | LLM (chat) | Required path for Ollama/OpenAI |
| `semanticSimilarity` | Embeddings or LLM-score | Optional; error if engine can’t |
| Future checks | Mix | Promote from common criteria when structured reporting is needed |

**Rule of thumb (product):**  
If MMT must autocomplete / validate / report a named metric → **check**.  
If only the LLM interprets the requirement → **criteria**.

---

## UI / editor

### Test file (`type: test`)

- Step autocomplete: `judge` alongside `call`, `check`, `assert`, …
- After `judge:`, complete **import aliases** that resolve to `type: judge`.
- Key completion: `inputs`, `check`, `assert`, `title`, `report`, `id`.
- Inside `check:` / `assert:`: `checks`, `criteria` (judge-eval context).
- Validation: `JudgeSchema` + TestSchema judge step (no “Invalid property” on engine/model/config).
- Add menu: creates a real `judge` step (not print).
- Icon: **`law`** for judge file + step.
- Results: soft rows as `check`, hard rows as `assert`.

### Judge file (`type: judge`)

- Register `type: judge` in `fileType` / `CommonData.Type` / new-file samples / icons.
- **v1 UI:** YAML editor + light form or read-only “Judge” side panel (engine, model, config summary, Test connection).
- **v2 UI:** fuller Edit Judge panel (like API/Env) if demand exists.
- Do **not** block v1 on a full custom editor — YAML + validate + Test connection is enough.

### Extension / runner wiring

- Import resolution treats `.mmt` with `type: judge` as a Judge resource (not callable via `call`).
- `runner` / `JSerTestFlow` compiles `judge` to `judge_(alias, { inputs, check, assert }, …)`.
- Abort: honor `checkAbort_()` like other steps.
- Secrets: never log full `apiKey`; redact in logs.

---

## Documentation

| Doc | Action |
|-----|--------|
| `docs/files/judge/index.md` | New — Judge file type, engines, config tables |
| `docs/files/judge/engines.md` | Ollama / OpenAI / Anthropic / Google / Azure |
| `docs/files/test/steps/judge.md` | New — `judge` step with `check` / `assert` blocks |
| `docs/files/test/steps/index.md` | Link `judge` |
| `docs/files/test/import.md` | Importable `type: judge` |
| `docs/files/test/steps/check.md` | Short “vs judge” note |
| `docs/AI/*` / MCP guides | Optional later: when to suggest `judge` |
| Example | `examples/intermediate/NN_ai_judge/` — Ollama local + one cloud sample (docs-only if no key) |
| CHANGELOG | Only at release time |

Website nav / docs index: add Judge under Files.

---

## Implementation phases

### Phase 0 — Spec lock (this SDD)

- [x] Agree field refinements (flat check/assert/criteria, one report box, tokens, no buffer).
- [x] Freeze v1 engine list: **ollama** (+ **openai** if time).

### Phase 1 — Core data + parse + Ollama criteria (MVP)

**Deliver**

- [x] `JudgeData.ts`, extend `Type` with `"judge"`.
- [x] `fileType` / parse pack / format key order / validate unknown keys.
- [x] `TestFlowJudge` in `TestData` + `testParsePack` + `JSerTestFlow` → `judge_`.
- [x] `JudgeEngine` registry + **Ollama** adapter (criteria → JSON verdict).
- [x] Unit tests: parse, merge defaults, pass/fail aggregation, continue vs stop, Ollama adapter mocked HTTP.
- [x] **No UI panel required** beyond not crashing on `type: judge` (notype sample + typeOptions).

**Exit criteria:** `.mmt` test with imported Ollama judge + `criteria` runs in Jest (mocked) and manually with local Ollama.

### Phase 2 — Reports, docs, example

**Deliver**

- [x] Report rows via `check` / `assert` types from nested blocks; step `id` outputs.
- [x] Schema + autocomplete + UI add + `law` icon (Phase 3 polish).
- [x] Docs: `docs/files/judge/*`, `docs/files/test/steps/judge.md`, import + steps index (integrity with `check`/`assert` called out).
- [x] Example under `examples/intermediate/27_ai_judge/`.
- [x] `testlight` path works automatically via `runner` / `jsRunner` HTTP inject (smoke in docs).

**Exit criteria:** User can copy example, set `ollama_url`, run from CLI/extension, see which criterion failed.

### Phase 3 — Test editor UX

**Deliver**

- Autocomplete + validation for `judge` step and judge imports.
- Flowchart / step list icon for `judge`.
- Results UI: score + reasons.
- New-file template: `type: judge` (Ollama stub).

**Exit criteria:** Authoring a judge step without memorizing YAML is comfortable.

### Phase 4 — Cloud engines + first structured check

**Deliver**

- Engines: `openai`, then `azure-openai` (shared shapes), then `anthropic` / `google`.
- First structured check: `semanticSimilarity` (threshold shorthand) where embeddings available; clear error otherwise.
- Docs engine pages + env var tables.
- Redaction + timeout behavior hardened.

**Exit criteria:** BYO OpenAI key path documented and tested; similarity check works on at least one engine.

### Phase 5 — Judge side panel + polish (optional)

**Deliver**

- Edit Judge / Test connection panel.
- Optional `defaults` UX; criterion object form `{ id, text }`.
- MCP/`testlight` helpers only if agents need them (not required for product MVP).
- Consider more checks (toxicity, jsonValid) only with clear local/ deterministic implementations.

---

## Testing strategy

| Layer | What |
|-------|------|
| Unit | Parse/format, step codegen, result aggregation, each adapter with mocked fetch |
| Integration | Example test against Ollama when `ollama_url` set (skip if missing) |
| UI | Autocomplete/validator unit tests in `mmtview` |
| Manual | Extension run: call → judge → report |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Flaky CI | Prefer soft `check:` in CI samples; docs: pin `temperature: 0`; optional retry later |
| Cost on cloud | BYO keys; prefer Ollama in examples; log token usage later if easy |
| Embedding vs chat confusion | Per-engine supported-checks list; validate at parse/run |
| Scope creep into eval platform | Non-goals enforced; metrics only via `checks` promotion |
| Secret leakage | Redact keys in logs; never write keys into report details |

---

## Success metrics

| Metric | Target |
|--------|--------|
| Time to first successful local judge | &lt; 15 min with Ollama example |
| Author can explain check vs criteria | From one docs page |
| Deterministic tests unchanged | No behavior change to `check`/`assert` |
| Attractiveness | Users with AI APIs or fuzzy text responses adopt without leaving Multimeter for a second tool *for in-flow checks* |

---

## Open questions (resolve in Phase 0)

1. ~~Default soft vs hard~~ → **Resolved:** nested `check` / `assert` on a single `judge` step.  
2. Is `actual` required in `inputs` when `criteria` present, or only warned?  
3. Phase 1 OpenAI in parallel with Ollama, or Ollama-only MVP?  
4. Judge side panel in Phase 3 vs Phase 5?

**Recommendations:** (2) warn, don’t hard-fail parse (3) Ollama-only Phase 1 (4) Phase 5.

---

## Appendix — Competitive positioning (short)

| | Promptfoo / DeepEval | Multimeter Judge |
|--|----------------------|------------------|
| Focus | Prompt/dataset eval | In-flow API/service tests |
| Reuse | Metrics + providers | `type: judge` + `judge` step (`check`/`assert` blocks) |
| BYO model | Yes | Yes (explicit product line) |
| Deterministic API asserts | Secondary | Primary + judge beside them |

Multimeter wins by **workflow integration**, not by metric count.
