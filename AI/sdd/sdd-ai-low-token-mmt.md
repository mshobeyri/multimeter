# SDD: Low-Token, High-Quality AI for `.mmt`

**Date:** 2026-09-05  
**Status:** Phase A shipped in tree (authoring rule + scaffold MCP/CLI + scaffold-first prompts); Phase B next  
**Related:** `AI/sdd/sdd-mcp-ai-assistant.md` (MCP foundation — largely shipped)

---

## Summary

Multimeter already has MCP tools, guides, and rules, but agents still burn large contexts by **guessing syntax, dumping whole APIs/specs, rewriting full files, and browsing the web**. Competing tools feel cheaper and sharper because they feed the model a **tiny always-on convention layer**, a **scaffold**, and a **local validate loop** — not documentation dumps.

This SDD defines the **highest-leverage changes** so Multimeter becomes the cheapest correct path for AI to create and consume `.mmt`, including **offline / no-MCP** environments via `testlight`.

**North star:** An agent should generate or fix a smoke test with **≤2–4 tool calls**, **no web search**, and **no full-file rewrite** unless asked.

---

## Problem

### What users experience

| Symptom | Typical cause |
|---------|----------------|
| High token burn generating a simple test | Model loads many docs / whole OpenAPI / invents YAML |
| Worse results than “known tools” | Those tools constrain output (scaffold + schema + patch) |
| Air-gapped / no MCP clients fail | Knowledge assumed to live on the web or MCP-only |
| Modify loops thrash | Full rewrite instead of surgical edit + validate |
| Inconsistent quality | Guides are long; always-on rules are weak or contradictory |

### Root causes (Multimeter-specific)

1. **Knowledge is verbose and optional** — `docs/AI/generate-*.md` are good but large; agents over-fetch or skip and guess.
2. **Scaffold exists in `core` but is not an AI-facing product surface** — `scaffoldTestFromApi` is not a first-class MCP/`testlight` command agents default to.
3. **`discover_api` can still be heavy** — agents may pull more than an “API card.”
4. **Rules tell agents “MCP first” but not “scaffold first / patch first / never web.”**
5. **Offline parity missing** — no `testlight docs|scaffold|validate` story for agents without MCP.
6. **Chat generation path is deprecated** without an equally sharp offline substitute.

### Competitive reality (why others feel better)

Successful AI coding / API tools share a pattern:

```
short rule → compact context card → scaffold → patch → local validate
```

They do **not** win by stuffing more prose into the prompt. Multimeter must productize that loop around `.mmt`.

---

## Goals

1. Cut typical generate/modify token cost by **~50–80%** vs current freeform behavior (directional metric below).
2. Raise first-pass `validate` success for smoke tests from APIs.
3. Work **offline**: same knowledge via MCP *or* `testlight` CLI.
4. Prefer **patch over rewrite**; prefer **scaffold over blank-page generation**.
5. Keep `core` as the single source of truth; MCP and CLI are thin adapters.

## Non-Goals

- Training or hosting a custom LLM.
- Replacing Cursor/Copilot as the agent host.
- Shipping a full JSON Schema IDE experience in v1 (optional later).
- Making every generate path “one click magic” without validation.
- Expanding chat-participant freeform generation (remains deprecated).

---

## Success metrics

| Metric | How to measure | Target (3 releases) |
|--------|----------------|---------------------|
| Tool calls per smoke-test generate | Manual / agent traces | ≤ 4 (docs OR card + scaffold + validate) |
| Chars of Multimeter docs loaded per generate | Trace `read_documentation` payloads | ≤ ~4–8 KB default |
| First-pass `validate` success (smoke from API) | Eval set of N APIs | ≥ 85% |
| Full-file rewrites on “modify” tasks | Trace | &lt; 20% of modify tasks |
| Offline generate without web | Air-gapped agent + `testlight`/`MCP` bundle | Works |

---

## Design principles

1. **Local knowledge beats web** — never instruct agents to open mmt.dev/GitHub for syntax when bundled guides exist.
2. **Machine context beats prose** — API card + scaffold YAML &gt; essay about tokens.
3. **Validate is the compiler** — wrong YAML is fixed by `validate` errors, not another generation.
4. **One authoring contract** — MCP and `testlight` expose the same verbs.
5. **Token budget is a product feature** — every guide has a max size; always-on rules stay tiny.

---

## Architecture (target loop)

```
┌─────────────────────────────────────────────────────────────┐
│ Host agent (Cursor / Copilot / other)                        │
│  always-on: mmt-authoring rule (≤ ~80 lines)                 │
└───────────────┬─────────────────────────────┬───────────────┘
                │ MCP (preferred)             │ CLI (offline /
                │                             │  no-MCP hosts)
                ▼                             ▼
        ┌───────────────┐             ┌─────────────────┐
        │ mmtmcp        │             │ testlight       │
        │ scaffold_test │◄────────────┤ scaffold / docs │
        │ api_card      │  shared     │ validate        │
        │ validate      │  core APIs  │                 │
        │ docs (slim)   │             └────────┬────────┘
        └───────┬───────┘                      │
                └──────────────┬───────────────┘
                               ▼
                        ┌─────────────┐
                        │ mmt-core    │
                        │ testScaffold│
                        │ parsers     │
                        └─────────────┘
```

---

## Highest-impact workstreams (ordered)

### P0 — Ship first (largest token/quality delta)

#### P0.1 Ultra-short always-on authoring rule

**Add** a dedicated always-applied (or `**/*.mmt` apply) rule, e.g. `rules/mmt-authoring.mdc`, **≤ ~80 lines**:

- File types one-liners
- Smoke-test skeleton (10 lines)
- Token cheat-sheet (`e:` / `i:` / `r:` / `c:` / `o:`)
- **Never web search for Multimeter syntax**
- **Modify = patch; do not rewrite whole file**
- **Generate = scaffold → fill → validate**
- Point to MCP/`testlight` for details

Keep existing `mmt-mcp.instructions.md` for tool order; do not merge into a giant always-on blob.

**Why first:** Always-on context is paid on every turn. Competitors win here by being ruthless about size.

#### P0.2 Expose `scaffold_test` as MCP tool + `testlight scaffold`

`core/src/testScaffold.ts` already builds a valid smoke test from `APIData`.

| Surface | API |
|---------|-----|
| MCP | `scaffold_test({ workspaceRoot, apiPath, strategy?: "smoke"\|"example", outPath? })` → returns YAML (+ optional write path suggestion) |
| CLI | `testlight scaffold test --from <api.mmt> [--strategy smoke]` |

**Agent contract change** (update prompts + `agent-workflow.md` + generate-test skill):

1. `api_card` or `discover_api` (compact)  
2. **`scaffold_test`** (required for new tests from APIs)  
3. Minimal edits (ids, asserts, inputs)  
4. `validate`

**Why:** Removes blank-page generation — the #1 token and quality sink.

#### P0.3 Compact `api_card` tool (or slim `discover_api` mode)

Return a fixed small JSON/YAML card:

```yaml
path: apis/login.mmt
title: Login
method: post
url: <<e:base_url>>/login
alias: login
inputs: { username: string, password: string }
outputs: { token: body.token }
examples: [default]
```

Rules for agents: **generate from the card, not the full `.mmt` / OpenAPI**, unless the user asks for deep detail.

**Why:** Spec dumps dominate context; cards are what good tools pass to models.

#### P0.4 Slim documentation packs with hard size budgets

Split / trim MCP `read_documentation` payloads:

| Topic pack | Max size (guideline) | Contents |
|------------|----------------------|----------|
| `test-min` | ~3–5 KB | Structure, steps, assert/check, tokens |
| `test-full` | existing | Rare; only when agent requests |
| `api-min` / `suite-min` | similarly | |

Default generate/modify workflows call **`test-min`**, not the full generate-* novels.

**Why:** On-demand docs only help if defaults are small.

#### P0.5 Skill / prompt hard rules (behavior, not more prose)

Update generate-test skill + MCP `generate_test` prompt:

1. No web search for Multimeter syntax  
2. New API tests **must** call `scaffold_test`  
3. Modify tasks: search_replace / partial edit only  
4. Stop when `validate` passes — no “polish” rewrite  
5. Prefer smoke unless user asks for more  

---

### P1 — Offline / no-MCP parity

#### P1.1 `testlight docs <topic>`

Print the **same slim packs** MCP serves (`test-min`, etc.) to stdout. Agents without MCP can `run_terminal_cmd` once instead of browsing.

#### P1.2 Document the offline agent profile

Add `docs/AI/offline-agent.md`:

- Prefer MCP when registered  
- Else: `testlight docs` → `testlight scaffold` → edit → `testlight validate` (or MCP validate if available)  
- Never use the public website for syntax  

#### P1.3 Bundle guarantee

Keep guides + examples inside the VSIX / `dist/mcp` (already started). CLI packs the same files from `docs/AI` or a generated `docs/AI/min/` folder.

---

### P2 — Quality multipliers (after P0/P1)

#### P2.1 Eval harness for AI workflows

Small fixed corpus: N API fixtures → scaffold → validate → optional run against `test.mmt.dev` or mocks.  
CI job (nightly / manual) records validate pass rate — not full LLM CI unless desired.

#### P2.2 Suggest-assertions from response shape

Optional MCP tool: given last response / outputs map, propose `assert`/`check` lines. Keeps generation small (patch asserts only).

#### P2.3 Optional JSON Schema for `type: test` / `type: api`

Expose via MCP resource for hosts that support structured output. Secondary to scaffold.

#### P2.4 Align React env editor presets with derived selection

(Related UX debt; not token-critical.)

---

## Concrete MCP / CLI surface (delta)

| Verb | MCP today | Target |
|------|-----------|--------|
| Docs | `read_documentation` (often large) | + `pack: min\|full`, default `min` |
| Discover | `discover_api` | + `api_card` or `mode: card` |
| Scaffold | via internal `testScaffold` only | **`scaffold_test`** |
| Validate | `validate` | unchanged (mandatory) |
| Format | `format` | unchanged |
| Run | `run` | unchanged |
| Examples | `list_examples` | keep; prefer 1–2 golden smoke examples |

CLI mirrors: `docs`, `scaffold test`, `validate` (validate may already exist under another name — align naming).

---

## Token budget policy (product rule)

| Layer | Budget |
|-------|--------|
| Always-on authoring rule | ≤ ~80 lines / ≤ ~3 KB |
| Default docs pack per generate | ≤ ~5 KB |
| API card | ≤ ~2 KB |
| Scaffold YAML | as produced by core (already minimal) |
| Full generate-*.md | only on explicit “deep docs” / troubleshooting |

Any new AI guide PR must state which pack it belongs to and the approximate size.

---

## Migration / compatibility

- Existing MCP clients keep working; new tools are additive.
- `read_documentation` without `pack` defaults to **`min`** after a short deprecation window (or `min` for generate prompts only if default change is too sharp).
- Chat freeform generation stays deprecated; point to scaffold+MCP/`testlight`.
- Update `rules/mmt-mcp.instructions.md` and `docs/AI/agent-workflow.md` in the same release as `scaffold_test`.

---

## Implementation plan

### Phase A (1 release) — P0.1 + P0.2 + skill/prompt updates

1. Add `rules/mmt-authoring.mdc` (tiny).  
2. MCP `scaffold_test` wrapping `scaffoldTestFromApi`.  
3. `testlight scaffold test --from …`.  
4. Rewrite generate-test skill + MCP generate prompt to **scaffold-first**.  
5. Unit tests: scaffold CLI/MCP handlers; golden YAML snapshots.

### Phase B (next release) — P0.3 + P0.4 + P1

1. `api_card` / compact discover mode.  
2. `docs/AI/min/*` packs + `read_documentation(pack: min)`.  
3. `testlight docs <topic>`.  
4. Offline agent guide.

### Phase C — P2 eval + suggest-assertions

1. Eval corpus + optional nightly.  
2. Assert suggestion helper.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Default `min` docs omit rare syntax | Agent can request `pack: full`; validate catches mistakes |
| Scaffold too simplistic | `strategy: example`; user can ask for expansion |
| Agents ignore rules | Strong MCP server instructions + skill; measure in eval |
| CLI vs MCP drift | Both call the same `core` functions only |
| Competitors still feel snappier | Focus on scaffold+card; do not chase prompt length |

---

## Open questions

1. Should `read_documentation` default globally to `min`, or only when called from generate prompts?  
2. Should `scaffold_test` write the file or only return YAML (safer: return + suggested path; agent writes)?  
3. Do we publish a public “AI eval” badge (validate pass rate) for marketing vs Bruno/Postbot?

---

## Decision ask

Approve **Phase A** as the immediate build: tiny always-on authoring rule + expose existing `testScaffold` via MCP/`testlight` + scaffold-first skills. That is the highest-effect gap versus tools that already feel cheaper and better.

---

## Appendix: Anti-patterns to ban in agent instructions

- “Search the web / GitHub for Multimeter YAML syntax.”  
- “Read all of `docs/AI` before generating.”  
- “Output a complete new file when the user asked to change one assert.”  
- “Invent Postman/`pm.` or collection JSON.”  
- “Skip validate because the YAML looks right.”  
