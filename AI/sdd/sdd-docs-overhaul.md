# SDD: Documentation Overhaul

**Date:** 2026-02-23
**Scope:** All user-facing files under `docs/`
**Goal:** Bring every document up to date with the current codebase, fix formatting/accuracy issues, and document all undocumented features so users can discover and use them.
**Status:** ✅ **COMPLETED** — All 70 items have been implemented across all doc files.

---

## Summary

An audit of the `docs/` folder against the codebase and recent commit history (v1.5 → v1.9.3) revealed **70 actionable items**: features completely missing from documentation, features that are poorly explained, factual errors, broken formatting, structural problems, and undocumented VS Code settings. This SDD groups them by document and priority.

### Completion summary

| Phase | Priority | Items | Status |
|-------|----------|-------|--------|
| Phase 1 | P0 — Broken/Incorrect | #7, #11-13, #28, #39, #49, #52-55, #58 | ✅ Done |
| Phase 2 | P1 — Missing features | #1-6, #14-24, #29, #31-32, #36-38, #40-42, #45-48, #50-51, #56, #60-68 | ✅ Done |
| Phase 3 | P2 — Poorly documented | #8-10, #25-27, #30, #33-35, #43-44, #69 | ✅ Done |
| Phase 4 | P3 — Polish | #57, #59, #70 | ✅ Done |

### Files modified
- `api-mmt.md` — removed r:image, added 9 missing tokens, token normalization, JSONPath $, headers/cookies extraction, import section, Markdown in description, UI features (method override, copyable outputs, extract variable), cross-links
- `test-mmt.md` — fixed broken set/var/const/let + setenv section, fixed call YAML indentation, added setenv to reference, expanded for/repeat (time-based, inf), added metrics section, stage condition, JS globals table, CSV import behavior, =@ clarification, autocomplete note, flow alias, cross-links
- `environment-mmt.md` — fixed false e:{VAR} claim, added env syntax table, type:var docs, VS Code settings table, cross-links
- `mmt-overview.md` — fixed headers list→map, set indentation, triple backticks, typos, added connections panel, project root section, expanded suite section, full cross-links
- `doc-mmt.md` — fixed services YAML indentation, added `<<i:param>>`/`<<o:param>>` annotations, Markdown in descriptions, logo field, description field in Elements and Reference
- `mock-server.md` — restructured (overview first, TLS last), fixed `<e:API_URL>` → `<<e:API_URL>>`, added request history section
- `suite-mmt.md` — added +/ project root imports, missing/cycle node types, nested suite cycle detection, CLI execution, reference types, cross-links
- `testlight.md` — added --example, --log-level, --md flags with examples
- `convertor.md` — added Postman variable mapping, formdata/urlencoded, example extraction, OpenAPI XML
- `certificates-mmt.md` — added self-signed auto-retry behavior
- `demos.md` — replaced broken GIF links with available screenshots or TODO placeholders, added missing See also links

Priority levels:
- **P0 — Broken / Incorrect**: factual errors, broken formatting that makes content unreadable, broken links/images.
- **P1 — Missing feature docs**: features that exist in the codebase and are useful to users but have zero documentation.
- **P2 — Poorly documented**: features that are mentioned but lack examples, explanation, or are buried in a reference line.
- **P3 — Quality / Polish**: grammar, spelling, structural improvements, cross-references.

---

## 1. `api-mmt.md` — API Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 1 | **Document `import` field for API files** | `APIData.import` (`Record<string, string>`) is listed in the reference section but has no explanatory section, no examples, and no description of what you can import or why. Add a section under "Reuse and compose" explaining how APIs can import other files. |
| 2 | **Complete the random token list** | The following tokens exist in `RANDOM_TOKEN_MAP` but are not listed in the docs: `r:latitude`, `r:longitude`, `r:hex_color`, `r:weekday`, `r:date_future`, `r:date_past`, `r:date_recent`, `r:month`, `r:phone_number` (alias for `r:phone`). Replace the loose prose list with a complete, tabular reference of all random tokens. |
| 3 | **Enumerate `c:` current tokens accurately** | The complete list is: `time`, `date`, `day`, `month`, `year`, `epoch`, `epoch_ms`, `city`, `country`. Present as a table matching the random token table format. |
| 4 | **Document JSONPath `$` extraction syntax** | `outputExtractor.ts` supports `$[body][user][id]`, `$body[user]`, etc. as an alternative to `body[...]`. Completely missing from the outputs section. |
| 5 | **Add examples for `headers[...]` and `cookies[...]` extraction** | The outputs section mentions these in passing but provides no examples. Add concrete examples. |
| 6 | **Document protocol auto-detection from URL** | Since v1.7+, `protocol` is optional — the system infers `ws` from `ws://`/`wss://` URLs and `http` for everything else (via `protocolResolver.ts`). The current docs mention this but it should be more prominent, since `protocol` is no longer required. |

### P0 — Incorrect content

| # | Item | Details |
|---|------|---------|
| 7 | **Remove `r:image`** | The docs list `r:image` ("small SVG data URI") but this token **does not exist** in `RANDOM_TOKEN_MAP`. Remove it. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 8 | **Token name normalization** | Users don't know that `r:firstName`, `r:first-name`, and `r:first_name` all resolve to the same token via `normalizeTokenName`. Add a note. |
| 9 | **Cross-link to environment and test docs** | No links to `environment-mmt.md` or `test-mmt.md` despite heavy use of `e:VAR` and test references. Add "See also" links. |
| 10 | **Document Markdown support in `description` field** | Since v1.9.3 (commit `44ec66d`), the `description` field in API files supports Markdown formatting (bold, italic, code, lists, headings, tables) which renders in both the editor UI and doc generation. This is a new feature and should be highlighted. |

---

## 2. `test-mmt.md` — Test Documentation

### P0 — Broken formatting

| # | Item | Details |
|---|------|---------|
| 11 | **Fix `set/var/const/let` + `setenv` section interleaving** | Lines ~262–288 are severely broken. The `set` code block is opened but never closed before the `### setenv` heading appears, causing the setenv section to render as literal text inside the code fence. The remaining `var`/`const`/`let` examples appear as orphaned content. Fix: close the `set` code block, make `### setenv` its own properly separated section, and restore the full `set`/`var`/`const`/`let` example with correct indentation. |
| 12 | **Fix broken `call` YAML indentation** | Around line 140, `token: doLogin.token` is at the same level as `inputs:` instead of nested under it. Fix the indentation. |
| 13 | **Fix broken `set` YAML indentation** | `token: doLogin.token` should be indented under `set:` (needs 2 more spaces). |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 14 | **Document `metrics` field properly** | The `metrics` field (`repeat`, `threads`, `duration`, `rampup`) enables load/performance testing. Currently only a one-liner in the reference types. Needs its own section with explanation and examples of how to configure load tests. |
| 15 | **Document time-based `repeat`** | `repeat: 30s`, `repeat: 5m`, `repeat: 1h` — loops until duration expires rather than counting iterations. The docs only show count-based. Also document `repeat: inf` for infinite looping. |
| 16 | **Document `inf` duration** | `Timestr` type accepts `'inf'` for infinite duration in metrics. Not documented. |
| 17 | **Document stage `condition` field** | Stages support a `condition` expression that skips the stage if false. Listed in reference but no explanation or examples. |
| 18 | **Document `setenv` in step types reference** | `setenv` is explained in the body but missing from the reference list at the bottom (`call, check, assert, if, for, repeat, delay, js, print, set, var, const, let, data`). |
| 19 | **Document JS step available globals** | JS steps have access to: all `Random.*` functions (e.g., `randomUUID()`, `randomInt(max)`, `randomEmail()`), all `testHelper` exports (`less_()`, `equals_()`, `matches_()`, `report_()`, `setenv_()`, etc.), `send_()`, `extractOutputs_()`, `importJsModule_()`, a custom `console` object, `__mmt_random(name)`, `__mmt_current(name)`. None of this is documented. |
| 20 | **Document `for` loop accepts any JS for-header** | Clarify that the `for` expression is passed directly to JavaScript, so `let i = 0; i < 10; i++`, `const [k, v] of Object.entries(obj)`, etc. all work. |
| 21 | **Document legacy `flow` alias for `steps`** | `flow` is accepted as backward-compatible alias for `steps`. Not mentioned. |
| 22 | **Document `report` field on check/assert** | The `report` field (values: `all`, `fails`, `none`; object form with `internal`/`external`) was added in v1.6+ (commit `a19cc63`). It is documented in the current text but the section could use a clearer example showing the difference between running a test directly vs. when it's imported into a suite. |
| 23 | **Document `call.outputs`** | Per-call output extraction overrides exist on both `TestFlowCallTest` and `TestFlowCallAPI`. Not documented. These are defined in the TypeScript types and wired through the test runner. |
| 24 | **Document autocomplete features** | Since v1.9+ (commits `f0f19e3`, `bdd9bc2`, `155399d`), the YAML editor provides autocomplete for `call` step names, check/assert operators, and input references. Not mentioned in any doc. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 25 | **Explain `set` vs `var` vs `const` vs `let` differences** | The section says "set mutates; var/const/let follow JS scoping" but doesn't illustrate when to use each. Add examples showing the practical difference. |
| 26 | **Clarify `=@` (contains) operator direction** | The implementation checks `b.includes(a)` (right side contains left side). The docs say "contains" which is ambiguous. Clarify which side contains which. |
| 27 | **Remove stale API `import` references** | API files no longer support a top-level `import` block. Any remaining API docs or generated copies that mention `import: record<string, string>` should be removed so only test import behavior is documented. |

---

## 3. `environment-mmt.md` — Environment Documentation

### P0 — Incorrect content

| # | Item | Details |
|---|------|---------|
| 28 | **Fix false claim about `e:{VAR}` and clarify supported syntaxes** | The docs state "`e:{VAR}` and `{{VAR}}` are not supported." The `{{VAR}}` part is correct. But regarding `e:{VAR}`: verify whether this is intentionally unsupported (in which case the code in `variableReplacer.ts` should be cleaned up) or accidentally omitted. **Decision from project owner: only `<<e:VAR>>` and `e:VAR` are the supported syntaxes going forward.** Update the docs to clearly state these two forms only and remove mention of `e:{VAR}` and `<e:VAR>` as they are not intended to be user-facing. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 29 | **Document `type: var` file type** | `CommonData.ts` lists `type: "var"` as a valid file type (alongside `env`). It appears to be treated similarly to `env` but is a distinct type. The overview and environment docs mention `type: env` and `type: var` in the AGENTS.md but the user-facing docs never explain `type: var`. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 30 | **Add clear env-token syntax table** | Create a clear table with the two supported forms: `<<e:VAR>>` (inline substitution inside strings) and `e:VAR` (standalone value after `: `, preserves type). Include when to use each and type-preservation rules. |

---

## 4. `suite-mmt.md` — Suite Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 31 | **Document `+/` project root imports in `tests` array** | Suite `tests` entries support `+/` paths (e.g., `+/tests/login.mmt`). Not mentioned. Added in v1.7 (commit `9390dd9`). |
| 32 | **Document `missing` and `cycle` node types** | When a test file can't be found, the suite shows a `missing` node. Circular references show a `cycle` node. Neither is documented. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 33 | **Explain nested suite behavior and cycle detection** | The docs briefly mention "nested suite" with an icon, but don't explain that suites can recursively include other suites, or that the system detects and prevents circular references. |
| 34 | **Document suite execution in CLI** | How to run a suite using `testlight run suite.mmt` and what behavior to expect (sequential stages, parallel execution within stages). |
| 35 | **Add reference types section** | Suite doc lacks a structured reference section listing all supported fields (`type`, `title`, `description`, `tags`, `tests`). |

---

## 5. `testlight.md` — CLI Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 36 | **Document `--example <name|#n>` flag** | Both `run` and `print-js` support `--example happy-path` or `--example #1` to run a specific named example or numeric index. Completely missing. |
| 37 | **Document `--log-level <level>` global option** | Global option `--log-level` (error/warn/info/debug/trace) controls verbosity. Completely missing. |
| 38 | **Document `doc --md` flag** | The `doc` command supports `--md` for Markdown output (instead of default HTML). Only HTML is mentioned. |

---

## 6. `doc-mmt.md` — Doc Generation Documentation

### P0 — Broken formatting

| # | Item | Details |
|---|------|---------|
| 39 | **Fix `services` YAML indentation** | In the "Group by services" example (~line 32), `description:` is at the wrong indent level. It should be inside `- name: Accounts` block, not at the same level. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 40 | **Document `<<i:param>>` and `<<o:param>>` description annotations** | API descriptions support `<<i:param_name>> description text` and `<<o:param_name>> description text` annotations that are parsed and displayed as parameter description columns in the doc output (both HTML and Markdown). Completely undocumented. Added in v1.9.1 (commit `ec35acd`). |
| 41 | **Document inline Markdown in API descriptions** | API descriptions in doc output support a subset of Markdown: `> headings`, `**bold**`, `*italic*`, `` `code` ``, bullet/numbered lists (`-`/`*`/`1.`), and pipe tables (`|...|`). Added in v1.9.3 (commit `44ec66d`). |
| 42 | **Document `description` field in Elements** | The `description` field at the doc level is rendered as a subtitle/intro paragraph. Missing from the Elements section (only listed in reference). |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 43 | **Document `logo` field properly** | The `logo` field is supported (path or URL to logo image) and rendered in the HTML header. Introduced in commit `8e0fe36`. It's mentioned in passing ("logo (if configured)") but not listed in Elements or the Reference types section. Add to both. |
| 44 | **Add `logo` and `description` to Reference types** | Reference section lists `type, title, sources, services, html, env` but omits `logo` and `description`. |

---

## 7. `convertor.md` — Convertor Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 45 | **Document Postman dynamic variable mapping** | The convertor automatically maps Postman dynamic variables (`{{$guid}}`, `{{$randomEmail}}`, etc.) to Multimeter `r:` tokens. Not mentioned. |
| 46 | **Document Postman formdata/urlencoded support** | The convertor handles `formdata` and `urlencoded` body modes from Postman collections. Not mentioned. |
| 47 | **Document Postman example extraction** | When Postman items have saved response examples with `originalRequest`, the convertor auto-generates inputs, header input placeholders, and example overrides. Not mentioned. |
| 48 | **Document OpenAPI XML body generation** | OpenAPI convertor generates XML bodies from XML content types. Not mentioned. |

---

## 8. `mock-server.md` — Mock Server Documentation

### P0 — Structural issue

| # | Item | Details |
|---|------|---------|
| 49 | **Restructure document order** | The document opens with the advanced HTTPS/TLS/mTLS section, then after a `---` divider introduces basic purpose ("A lightweight mock server..."). The general overview should come **first**, with TLS details in a later section. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 50 | **Document mock server history** | Since v1.7 (commit `bcbdc36`), the mock server tracks request history. Not documented. |
| 51 | **Document CORS proxy for mock server** | CORS support was added alongside the "try" feature in v1.8.1 (commit `59a253a`). The mock server can be used with CORS headers for browser-based testing. |

### P2 — Inconsistency

| # | Item | Details |
|---|------|---------|
| 52 | **Fix `<e:API_URL>` reference** | Line 76 uses `<e:API_URL>` — should use the standard `<<e:API_URL>>` syntax consistently with all other docs. |

---

## 9. `mmt-overview.md` — Overview Documentation

### P0 — Broken formatting / incorrect content

| # | Item | Details |
|---|------|---------|
| 53 | **Fix `headers` as list instead of map** | The API example writes `headers:` as a YAML list (`- content-type: ...`) but headers are `record<string, string>` (a map). Should be `headers:\n  content-type: application/json`. |
| 54 | **Fix `set` step indentation** | Same broken indentation as test-mmt.md: `token:` should be nested under `set:`. |
| 55 | **Fix triple backticks used as inline code** | Line 85 uses `` ``` `` for inline code markers where single backticks should be used. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 56 | **Add `type: suite` to the overview** | The overview now lists Suite at the bottom, but the section is minimal. Expand to match the depth of the API/Test/Env sections. |

### P3 — Grammar/spelling

| # | Item | Details |
|---|------|---------|
| 57 | **Fix typos and grammar** | "calling **loging**" → "calling **login**"; "two **urls**" → "two **URLs**"; "filter some **of** tests" → "filter some tests"; "two presets as **environmets**" → "two presets as **environments**". |

---

## 10. `demos.md` — Demos Page

### P0 — Broken links

| # | Item | Details |
|---|------|---------|
| 58 | **All 10 demo GIF references are broken** | The `demos/` directory does not exist. All image references (`../demos/api.gif`, `../demos/doc.gif`, `../demos/env.gif`, etc.) are broken. Either create the demo GIFs or replace with screenshots from the existing `screenshots/` directory, or mark as TODO/placeholder. |

### P3 — Missing cross-references

| # | Item | Details |
|---|------|---------|
| 59 | **Add missing "See also" links** | Several demos have no link: Postman Import → link to `convertor.md`; WebSocket Testing → link to `api-mmt.md`; XML Handling → link to `api-mmt.md`; UI Overview → link to `mmt-overview.md`. |

---

## 11. `certificates-mmt.md` — Certificates Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 60 | **Document self-signed certificate auto-retry behavior** | When `allowSelfSigned` is enabled, the system auto-retries failed HTTPS requests with validation disabled if the error matches specific TLS error codes (`SELF_SIGNED_CERT_IN_CHAIN`, `DEPTH_ZERO_SELF_SIGNED_CERT`). This behavior is not explained. |

---

## 12. Cross-cutting / General

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 61 | **Document CSV import behavior** | CSV imports auto-coerce unquoted numeric strings to numbers and `true`/`false` to booleans. Quoted fields stay as strings. Also handles BOM characters and RFC 4180 quoted fields. None of this is documented in test-mmt.md or a dedicated section. |
| 62 | **Document default HTTP timeout** | The default request timeout is 30 seconds (configurable via `multimeter.network.timeout` VS Code setting). Users should know this, especially for slow APIs. Not documented anywhere. |
| 63 | **Document VS Code settings** | The following VS Code settings exist in `package.json` but are not documented in any user-facing doc: `multimeter.network.timeout` (default 30000ms), `multimeter.body.auto.format` (auto-format responses), `multimeter.editor.fontSize` (YAML editor font size, 8–40), `multimeter.editor.defaultPanel` (yaml-ui/yaml/ui), `multimeter.editor.collapseDescription` (auto-collapse multi-line descriptions), `multimeter.workspaceEnvFile` (workspace env file path). Consider adding a "VS Code Settings" section to the overview or a dedicated doc. |
| 64 | **Document the connection panel** | Since v1.7.2 (commit `97a578a`), a Connections panel shows active HTTP keep-alive and WebSocket connections with lifecycle states (`connecting`, `open`, `idle`, `closing`). The panel allows closing connections manually. Not documented. |
| 65 | **Document the method override button** | Since v1.9.3 (commit `6586e8e`), the API UI has a button to temporarily modify the HTTP method without editing the YAML. Not documented. |
| 66 | **Document copyable outputs** | Since v1.9.3 (commit `6f98d45`), API output values are copyable from the UI. Not documented. |
| 67 | **Document auto-collapse description setting** | Since v1.9.3 (commit `e1515ad`), multi-line description fields can be auto-collapsed when opening MMT files (controlled by `multimeter.editor.collapseDescription`). Not documented. |
| 68 | **Document extract variable from output** | Since v1.9.3 (commit `e48bbeb`), users can extract variables from response output directly in the UI (click on a value in the response body to create an output extraction path). Not documented. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 69 | **Improve description of Markdown support in API descriptions** | The description Markdown feature (rendering bold, italic, code, lists, headings, tables inside `description` fields) is now supported in both the editor UI and doc generation. This should be documented in both `api-mmt.md` and `doc-mmt.md`, since it affects how users write descriptions in API files. |

### P3 — Quality

| # | Item | Details |
|---|------|---------|
| 70 | **Add a "What's new" or changelog summary to docs** | Many features from v1.5–v1.9.3 are not discoverable. Consider adding a concise "What's new" section or linking to the CHANGELOG from the overview doc. |

---

## Execution Plan

### Phase 1 — Fix broken content (P0) — Items: 7, 11, 12, 13, 28, 39, 49, 53, 54, 55, 58
Fix factual errors, broken YAML/Markdown formatting, incorrect claims, broken image links, and structural issues. This is the highest priority since broken content actively misleads users.

### Phase 2 — Document missing features (P1) — Items: 1–6, 14–24, 29, 31–32, 36–38, 40–42, 45–48, 50–51, 56, 60–68
Add new sections and examples for all undocumented features. Group by document and work through each file.

### Phase 3 — Improve existing docs (P2) — Items: 8–10, 25–27, 30, 33–35, 43–44, 52, 69
Expand poorly-documented features, fix inconsistencies, and add better examples.

### Phase 4 — Polish (P3) — Items: 57, 59, 70
Fix typos, grammar, add cross-references, improve readability.

---

## Out of Scope

- Internal-only features (e.g., `abortSignal`, `isExternal`, reporter event shape) — these are for extension/CLI developers, not end users.
- `keep-alive` / agent pooling — transparent to users, no config knobs.
- `autoFormat` network setting — UI-internal (covered by VS Code setting).
- `call` override fields (`url`, `headers`, `body` on `TestFlowCallAPI`) — these exist as TypeScript types but are **not wired** in the code generator (`callToJSfunc` only uses `call`, `id`, and `inputs`). Do not document until implemented.
- `e:{VAR}` and `<e:VAR>` syntax — present in `variableReplacer.ts` but **not intended as user-facing**. Only `<<e:VAR>>` and `e:VAR` are the supported forms going forward.
