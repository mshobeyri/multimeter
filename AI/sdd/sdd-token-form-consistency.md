# SDD: Token Form Consistency (YAML ↔ UI)

**Date:** 2026-10-02  
**Status:** Phases 1–4 done  
**Supersedes / extends:** [sdd-api-tester-token-display-save.md](./sdd-api-tester-token-display-save.md) (display integrity decisions stay; this SDD fixes where implementation drifted and where type/quoting rules are inconsistent)  
**Scope:** Display helpers (`bodyRuntimeTokens`, `runtimeTokenUi`, `literalToken`), API tester field preview, JSON body quoting, docs. **Not** a change to JSer / runner resolution semantics beyond accepting the same token shapes already supported.

### Implementation progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Correctness | **Done** | `c:day`/`c:month` quoted; field idle preview keeps `r:`/`c:` as `{{…}}` |
| Phase 2 — Type metadata | **Done** | `randomTokenValueType` / `currentTokenValueType`; allowlists removed |
| Phase 3 — DX / docs | **Done** | Docs + YAML editor warning for bare embedded tokens |
| Phase 4 — `{{}}` YAML alias | **Done** | `normalizeCurlyTokensInYamlSource` before parse (quote-aware); Option C read-compat |

---

## Summary

Token handling today has **multiple conflicting rule systems**:

1. Idle preview for headers/body maps keeps `r:`/`c:` as `{{…}}`, but `TokenFieldInput` expands them to concrete values.
2. JSON quoting for `r:`/`c:` uses static name allowlists that disagree with real return types (`c:day`, `c:month` are strings but treated as non-string).
3. Bare-token embedding rules differ by prefix (`e:` can resolve mid-string in some paths; `i:`/`r:`/`c:` do not).
4. UI uses `{{}}` while YAML uses `<<>>` / bare — necessary conversion, but easy to mis-implement when policies diverge.

This SDD locks **one coherent rule set**, a phased fix plan, and a decision on whether YAML should switch from `<<>>` to `{{}}`.

---

## Problem statement

| # | Issue | Symptom | Root cause |
|---|--------|---------|------------|
| P1 | Dual idle-preview policies | Headers keep `{{r:uuid}}`; some fields show a frozen UUID | `displayRuntimeString` ≠ `projectTokenFieldPreview` |
| P2 | Wrong JSON quote types | `{{c:day}}` / `{{c:month}}` emitted unquoted | `NON_STRING_CURRENT_TOKENS` includes string-returning names |
| P3 | Allowlist ≠ reality | Adding a new number token forgets the set → wrong quotes | Static `NON_STRING_*` sets instead of type metadata |
| P4 | Asymmetric bare rules | `Bearer e:token` sometimes works; `Bearer i:x` never | Env word-boundary paths vs whole-value-only for others |
| P5 | Mental-model split | Users learn `{{}}` in UI and `<<>>` in YAML | Intentional UI layer, but undocumented edge cases amplify confusion |

P1–P3 are correctness bugs. P4–P5 are consistency / DX debt.

---

## Locked decisions (target model)

### L1 — Three surface forms, one meaning

| Surface | Form | Role |
|---------|------|------|
| **YAML / runner** | Bare `prefix:name` **or** `<<prefix:name>>` | Source of truth on disk and at execution |
| **UI (preview + edit)** | Always `{{prefix:name}}` | Display / edit buffer only |
| **Literal** | YAML-quoted `"prefix:name"` | Never resolves (`__MMT_LITERAL__:` marker) |

Prefixes: `e:` (env), `i:` (input), `r:` (random), `c:` (current), `o:` (outputs, tests only — no API-tester dual-mode).

**Recognition vs validity:** any well-formed `r:name` / `c:name` (whole value or `<<…>>`) is a token in UI/YAML tooling — same shape rule as `i:` / `e:`. Built-in generator membership is a **warning** (`Unknown random/current token "…"`), not a gate on `{{}}` display or highlight.

### L2 — Bare vs embedded (all prefixes)

| Context | Rule |
|---------|------|
| Whole scalar only | Bare `i:x` / `e:x` / `r:uuid` / `c:epoch` is a token |
| Mixed with other text | Must use `<<prefix:…>>` (YAML) or `{{prefix:…}}` (UI) |
| YAML-quoted | `"r:uuid"` / `"<<e:x>>"` stay literal text |

**Follow-up (docs + soft DX):** document that bare mid-string `e:` is legacy/unsupported for new content; prefer `<<e:…>>`. Do **not** change runner behavior in v1 of this SDD (avoid silent break). Optional later: lint/warning in the YAML editor.

### L3 — Idle preview (one policy everywhere)

| Prefix | Idle preview | Edit buffer |
|--------|--------------|-------------|
| `i:` / `e:` | **Resolved** value | `{{i:…}}` / `{{e:…}}` |
| `r:` / `c:` | Stay as `{{r:…}}` / `{{c:…}}` | Same |

Applies to: headers, query, cookies, URL, auth fields, body projection, and `TokenFieldInput` (`projectTokenFieldPreview`).

**Rationale:** expanding `r:` in idle freezes a sample that will not match Send. Already locked in the prior display SDD; this SDD makes field preview obey it.

### L4 — JSON body quoting from types, not name lists

A token leaf in JSON body UI is:

- **Unquoted** when the value type is `number` | `boolean` | `null`
- **Quoted** when the value type is `string` | object | array | unknown

Type source:

| Prefix | Type source |
|--------|-------------|
| `r:` / `c:` | Generator **return-type metadata** on `RANDOM_TOKEN_MAP` / `CURRENT_TOKEN_MAP` (or a parallel map keyed by generator name) |
| `i:` / `e:` | `typeof` of the active inputs/env value after accessors; if missing → treat as **string** (quoted) |

Delete (or stop using as source of truth) `NON_STRING_RANDOM_TOKENS` / `NON_STRING_CURRENT_TOKENS`.

Immediate correctness: remove `day` and `month` from any non-string set (they return weekday/month **names**).

### L5 — Accessors and args are suffixes, not separate UI fields

- Accessors: `.field`, `[n]`, `[a:b]`, `[:n]`, `[n:]` on all prefixes  
- Args: `r:int(1,100)`, `c:date(+1d)` as today  
- UI form mirrors: `{{r:int(1,100)}}`, `{{e:user.name}}`

### L6 — Runners / JSer unchanged

`variableReplacer`, JSer, CLI, suite execution keep resolving `<<…>>` and bare forms. UI converts `{{}}` → resolvable forms only at Save / Send prep boundaries (already true).

### L7 — YAML grammar stays `<<>>` + bare (not `{{}}`)

See [Decision: `{{}}` in YAML?](#decision--in-yaml) below. **Rejected for this SDD.** UI remains the only place that uses `{{}}` as the primary token syntax.

---

## Decision: `{{}}` in YAML?

### Option A — Keep YAML as `<<>>` + bare; UI as `{{}}` (recommended)

| Pros | Cons |
|------|------|
| No breaking change for existing `.mmt` files, docs, examples | Users still learn two spellings |
| Bare `r:int` / `c:epoch` naturally preserve YAML scalar type without quote games | Conversion helpers remain (`peerStringToYaml`, revive, etc.) |
| `<<>>` is rare in URLs and JSON → fewer accidental collisions | — |
| Prior display SDD already chose this boundary | — |

### Option B — Switch YAML embedded form to `{{}}`

| Pros | Cons |
|------|------|
| One spelling UI ↔ file | **Breaking** for all existing files and docs |
| Deletes some UI↔YAML rewrite | Dual-accept period still needed (`<<>>` + `{{}}`) → **more** code short-term |
| Familiar from Postman / Mustache | In YAML, `{` starts flow maps; unquoted `{{r:int}}` is usually a plain string but is easier to confuse next to `{ key: … }` |
| — | Type preservation: today bare `r:int` is an unquoted YAML scalar that resolves to a number. Whole-value `{{r:int}}` is still a **string** in the YAML model unless we special-case parse — recreating today’s JSON-quote problem in YAML |
| — | Literal `{{` in bodies / templates becomes ambiguous with tokens |
| — | Does **not** fix P1–P3 by itself; those are preview/type bugs |

### Option C — Accept `{{}}` in YAML as an alias; always save as `<<>>` / bare

| Pros | Cons |
|------|------|
| Paste-from-UI / Postman-ish habits work | Three input shapes forever |
| Soft migration path | Still two canonical outputs |

### Recommendation

**Option A for this SDD.** Switching YAML to `{{}}` feels simpler but:

1. Does not fix the real inconsistencies (preview + type quoting).  
2. Trades a conversion layer for a **migration + ambiguity** layer.  
3. Weakens the clean type story that bare `r:int` / `c:epoch` already give in YAML.

**Optional later (out of scope):** Option C read-compat only — if the YAML editor or packer sees whole/embedded `{{i|e|r|c:…}}`, normalize to bare / `<<>>` on save. Do not make `{{}}` the on-disk canonical form.

---

## Target behavior tables

### Forms

| Kind | YAML | UI | Notes |
|------|------|-----|------|
| Env | `e:x` / `<<e:x>>` / `<e:x>` / `e:{x}` | `{{e:x}}` | Extra env forms remain for compat |
| Input | `i:x` / `<<i:x>>` | `{{i:x}}` | |
| Random | `r:name` / `<<r:name>>` | `{{r:name}}` | |
| Current | `c:name` / `<<c:name>>` | `{{c:name}}` | |
| Literal | `"r:uuid"` | shown with quotes | No resolve |

### JSON body leaf (UI)

| Token | Resolved type | UI JSON |
|-------|---------------|---------|
| `r:int`, `r:bool`, `r:epoch*`, … | number / boolean | unquoted `{{r:int}}` |
| `r:uuid`, `r:email`, … | string | `"{{r:uuid}}"` |
| `c:epoch`, `c:year`, `c:weekday_number` | number | unquoted |
| `c:day`, `c:month`, `c:date`, … | string | **quoted** `"{{c:day}}"` |
| `i:n` when input is `10` | number | unquoted `{{i:n}}` |
| `i:name` when input is `"alice"` | string | quoted |
| missing `i:`/`e:` | unknown | quoted (safe default) |

### Field types (headers / query / cookies / URL)

Always strings. Tokens appear as `{{…}}` in UI; no JSON quote logic. Save packs to bare / `<<>>` per L2.

---

## Implementation plan

### Phase 0 — Spec lock (this SDD)

- Agree L1–L7.  
- Explicitly reject YAML `{{}}` as canonical (Option A).

### Phase 1 — Correctness (small, ship first)

1. Remove `day` and `month` from `NON_STRING_CURRENT_TOKENS`.  
2. Change `projectTokenFieldPreview` so `r:`/`c:` stay as `{{…}}` (do not call `lookupRuntimeResolvedValue` for idle expansion).  
3. Update tests in `bodyRuntimeTokens.test.ts` that expect UUID expansion in field preview.  
4. Add regression tests: `c:day` / `c:month` → quoted in `stringifyJsonWithRuntimeTokens`.

### Phase 2 — Type metadata

1. Add return-type metadata next to generators, e.g.  
   `RANDOM_TOKEN_TYPES: Record<string, 'string'|'number'|'boolean'>`  
   (and current equivalents; aliases inherit base type).  
2. Implement `runtimeTokenEmitsJsonString` from metadata + `i:`/`e:` typeof.  
3. Delete allowlist sets once tests pass.  
4. Document types in `docs/features/dynamic-values/random.md` and `current.md` remain aligned with metadata (generate or assert in tests).

### Phase 3 — DX / docs

1. Docs: one “Forms” page stating L1–L3; mark bare mid-string `e:` as discouraged.  
2. YAML editor: optional warning when bare `e:`/`i:`/`r:`/`c:` appears inside a larger unquoted scalar (not whole-value).  
3. Ensure CONTRIBUTING / AGENTS note: UI `{{}}` only; YAML `<<>>` + bare.

### Phase 4 — Optional (separate SDD if pursued)

- Option C: parse `{{}}` in YAML as alias → normalize on save.  
- Lint rule in `mmt-mcp` / validate.

**Out of scope:** changing Examples-tab dual-mode, Edit API page, or `o:` tester UX.

---

## File touch list (expected)

| Area | Files |
|------|--------|
| Core display / quote | `core/src/bodyRuntimeTokens.ts`, `bodyRuntimeTokens.test.ts` |
| Types | `core/src/Random.ts`, `core/src/Current.ts` (metadata) |
| UI consumer | `mmtview/src/components/TokenFieldInput.tsx` (behavior via core; may need no change) |
| Docs | `docs/features/dynamic-values/syntax.md`, `random.md`, `current.md` |
| Prior SDD | Cross-link from `sdd-api-tester-token-display-save.md` |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Users liked seeing sample UUIDs in field preview | Hover tooltip can still show a **sample** without replacing the buffer; idle text stays `{{r:uuid}}` |
| Metadata drifts from generators | Unit test: for each map key, `typeof generator()` ∈ declared type (sample call) |
| Docs still show old dual preview | Phase 3 doc pass |
| “Just use `{{}}` in YAML” pressure | This SDD’s Option A section; revisit only with a migration SDD |

---

## Success criteria

- [x] Idle preview: `i:`/`e:` resolved; `r:`/`c:` always `{{…}}` in **all** tester string fields and body.  
- [x] `stringifyJsonWithRuntimeTokens` quotes `c:day` / `c:month`; unquotes true number/bool tokens.  
- [x] No `NON_STRING_*` allowlists as source of truth (metadata instead).  
- [x] Tests cover field preview + JSON quote matrix for representative `r:`/`c:`/`i:`/`e:`.  
- [x] Docs state one form table; YAML canonical remains `<<>>` + bare.  
- [x] `npm run compile` and targeted Jest suites green.  
- [x] No intentional change to runner resolution of existing `<<>>` / bare YAML.  
- [x] Phase 4: unquoted `{{i|e|r|c:…}}` accepted via source rewrite; quoted curly stays literal.

---

## Appendix: why bare YAML tokens still matter

```yaml
body:
  id: r:int          # YAML scalar → resolves to number
  flag: r:bool       # → boolean
  name: r:uuid       # → string
  greet: "hi <<e:x>>"  # embedded must be angle-wrapped
```

If embedded YAML used only `{{r:int}}`, the structured YAML value is still a **string** until a special parser rewrites it. The UI already needs type-aware quoting for JSON text; pushing `{{}}` into YAML duplicates that problem on disk instead of keeping bare tokens as the typed whole-value form.

---

## Open questions (resolve before Phase 2)

1. Should hover on idle `{{r:uuid}}` show a one-shot sample value, or only the token name?  
2. Phase 3 warning for bare mid-string `e:`: warning-only vs future hard lint?  
3. Is Option C (read `{{}}` from YAML, save as `<<>>`) desired as a fast-follow, or explicitly deferred?
