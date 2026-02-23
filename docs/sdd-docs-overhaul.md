# SDD: Documentation Overhaul

**Date:** 2026-02-23
**Scope:** All user-facing files under `docs/`
**Goal:** Bring every document up to date with the current codebase, fix formatting/accuracy issues, and document all undocumented features so users can discover and use them.

---

## Summary

An audit of the `docs/` folder against the codebase revealed **65 actionable items**: features that are completely missing from documentation, features that are poorly explained, factual errors, broken formatting, and structural problems. This SDD groups them by document and priority so they can be tackled systematically.

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
| 2 | **Document `r:latitude`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 3 | **Document `r:longitude`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 4 | **Document `r:hex_color`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 5 | **Document `r:weekday`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 6 | **Document `r:date_future`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 7 | **Document `r:date_past`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 8 | **Document `r:date_recent`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 9 | **Document `r:month`** | Random token exists in `RANDOM_TOKEN_MAP` but not listed in docs. |
| 10 | **Document `r:phone_number`** | Alias for `r:phone`; both should be listed. |
| 11 | **Document `c:` current tokens complete list** | The current list (`time`, `date`, `day`, `month`, `year`, `epoch`, `epoch_ms`, `city`, `country`) should be accurately enumerated. The docs currently list them but some are vague. |
| 12 | **Document JSONPath `$` extraction syntax** | `outputExtractor.ts` supports `$[body][user][id]`, `$body[user]`, etc. as an alternative to `body[...]`. Completely missing from the outputs section. |
| 13 | **Document `headers[...]` and `cookies[...]` extraction** | The outputs section mentions these in passing ("you can also use `headers[...]` or `cookies[...]`") but provides no examples. Add examples. |

### P0 — Incorrect content

| # | Item | Details |
|---|------|---------|
| 14 | **Remove `r:image`** | The docs list `r:image` ("small SVG data URI") but this token **does not exist** in `RANDOM_TOKEN_MAP`. Remove it or implement it. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 15 | **Token name normalization** | Users don't know that `r:firstName`, `r:first-name`, and `r:first_name` all resolve to the same token via `normalizeTokenName`. Add a note. |
| 16 | **Cross-link to environment and test docs** | No links to `environment-mmt.md` or `test-mmt.md` despite heavy use of `e:VAR` and test references. Add "See also" links. |

---

## 2. `test-mmt.md` — Test Documentation

### P0 — Broken formatting

| # | Item | Details |
|---|------|---------|
| 17 | **Fix `set/var/const/let` + `setenv` section interleaving** | Lines ~262–288 are severely broken. The `set` code block is opened but never closed before the `### setenv` heading appears, causing the setenv section to render as literal text inside the code fence. The remaining `var`/`const`/`let` examples appear as orphaned content. Fix: close the `set` code block, make `### setenv` its own properly separated section, and restore the full `set`/`var`/`const`/`let` example with correct indentation. |
| 18 | **Fix broken `call` YAML indentation** | Around line 140, `token: doLogin.token` is at the same level as `inputs:` instead of nested under it. Fix the indentation. |
| 19 | **Fix broken `set` YAML indentation** | `token: doLogin.token` should be indented under `set:` (needs 2 more spaces). |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 20 | **Document `call` override fields: `url`, `headers`, `body`** | `TestFlowCallAPI` supports `url`, `headers`, and `body` fields to override the imported API's values on a per-call basis. Completely undocumented. |
| 21 | **Document `call.outputs`** | Per-call output extraction overrides exist on both `TestFlowCallTest` and `TestFlowCallAPI`. Not documented. |
| 22 | **Document `metrics` field properly** | The `metrics` field (`repeat`, `threads`, `duration`, `rampup`) enables load/performance testing. Currently only a one-liner in the reference types. Needs its own section with explanation and examples of how to configure load tests. |
| 23 | **Document time-based `repeat`** | `repeat: 30s`, `repeat: 5m`, `repeat: 1h` — loops until duration expires rather than counting iterations. The docs only show count-based. Also document `repeat: inf` for infinite looping. |
| 24 | **Document `inf` duration** | `Timestr` type accepts `'inf'` for infinite duration in metrics. Not documented. |
| 25 | **Document stage `condition` field** | Stages support a `condition` expression that skips the stage if false. Listed in reference but no explanation or examples. |
| 26 | **Document `setenv` in step types reference** | `setenv` is explained in the body but missing from the reference list at the bottom (`call, check, assert, if, for, repeat, delay, js, print, set, var, const, let, data`). |
| 27 | **Document JS step available globals** | JS steps have access to: all `Random.*` functions (e.g., `randomUUID()`, `randomInt(max)`, `randomEmail()`), all `testHelper` exports (`less_()`, `equals_()`, `matches_()`, `report_()`, `setenv_()`, etc.), `send_()`, `extractOutputs_()`, `importJsModule_()`, a custom `console` object, `__mmt_random(name)`, `__mmt_current(name)`. None of this is documented. |
| 28 | **Document `for` loop accepts any JS for-header** | Clarify that the `for` expression is passed directly to JavaScript, so `let i = 0; i < 10; i++`, `const [k, v] of Object.entries(obj)`, etc. all work. |
| 29 | **Document legacy `flow` alias for `steps`** | `flow` is accepted as backward-compatible alias for `steps`. Not mentioned. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 30 | **Explain `set` vs `var` vs `const` vs `let` differences** | The section says "set mutates; var/const/let follow JS scoping" but doesn't illustrate when to use each. Add examples showing the practical difference. |
| 31 | **Clarify `=@` (contains) operator direction** | The implementation checks `b.includes(a)` (right side contains left side). The docs say "contains" which is ambiguous. Clarify that `actual =@ expected` means "expected contains actual". |
| 32 | **`import` annotation `(CSV)` is misleading** | The reference says `import: record<string, string> (CSV)`. The `(CSV)` is misleading — imports support `.mmt` (APIs, tests), `.csv`, and `.js`/`.cjs`/`.mjs`. Fix to `(mmt/csv/js)` or remove the annotation. |

---

## 3. `environment-mmt.md` — Environment Documentation

### P0 — Incorrect content

| # | Item | Details |
|---|------|---------|
| 33 | **Fix false claim about `e:{VAR}`** | The docs state `e:{VAR}` and `{{VAR}}` are "not supported". In reality, `e:{VAR}` **is** supported — `variableReplacer.ts` explicitly handles it with a regex `\be:\{([A-Za-z_][A-Za-z0-9_]*)\}`. Remove the false claim and document `e:{VAR}` as a supported syntax. `{{VAR}}` is correctly listed as unsupported. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 34 | **Document `<e:VAR>` single-angle-bracket syntax** | `variableReplacer.ts` supports `<e:VAR>` (single angle brackets) in addition to `<<e:VAR>>`. The docs only mention the double-angle form. |
| 35 | **Document `type: var` file type** | `CommonData.ts` lists `type: "var"` as a valid file type (alongside `env`). It appears to be treated similarly to `env` but is a distinct type. The overview and environment docs mention `type: env` and `type: var` in the AGENTS.md but the user-facing docs never explain `type: var`. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 36 | **Add complete env-token syntax table** | Create a clear table of all four supported forms: `<<e:VAR>>`, `<e:VAR>`, `e:{VAR}`, `e:VAR` — with when to use each and type-preservation rules. |

---

## 4. `suite-mmt.md` — Suite Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 37 | **Document `+/` project root imports in `tests` array** | Suite `tests` entries support `+/` paths (e.g., `+/tests/login.mmt`). Not mentioned. |
| 38 | **Document `missing` and `cycle` node types** | When a test file can't be found, the suite shows a `missing` node. Circular references show a `cycle` node. Neither is documented. |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 39 | **Explain nested suite behavior and cycle detection** | The docs briefly mention "nested suite" with an icon, but don't explain that suites can recursively include other suites, or that the system detects and prevents circular references. |
| 40 | **Document suite execution in CLI** | How to run a suite using `testlight run suite.mmt` and what behavior to expect (sequential stages, parallel execution within stages). |
| 41 | **Add reference types section** | Suite doc lacks a structured reference section listing all supported fields (`type`, `title`, `description`, `tags`, `tests`). |

---

## 5. `testlight.md` — CLI Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 42 | **Document `--example <name|#n>` flag** | Both `run` and `print-js` support `--example happy-path` or `--example #1` to run a specific named example or numeric index. Completely missing. |
| 43 | **Document `--log-level <level>` global option** | Global option `--log-level` (error/warn/info/debug/trace) controls verbosity. Completely missing. |
| 44 | **Document `doc --md` flag** | The `doc` command supports `--md` for Markdown output (instead of default HTML). Only HTML is mentioned. |

---

## 6. `doc-mmt.md` — Doc Generation Documentation

### P0 — Broken formatting

| # | Item | Details |
|---|------|---------|
| 45 | **Fix `services` YAML indentation** | In the "Group by services" example (~line 32), `description:` is at the wrong indent level. It should be inside `- name: Accounts` block, not at the same level. |

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 46 | **Document `<<i:param>>` and `<<o:param>>` description annotations** | API descriptions support `<<i:param_name>> description text` and `<<o:param_name>> description text` annotations that are parsed and displayed as parameter tables in doc output. Completely undocumented. |
| 47 | **Document inline Markdown in API descriptions** | API descriptions in doc output support: `> headings`, `**bold**`, `*italic*`, `` `code` ``, bullet/numbered lists, and pipe tables. Not documented. |
| 48 | **Document `description` field** | The `description` field at the doc level is rendered as a subtitle/intro paragraph. Missing from the Elements section (only in reference). |

### P2 — Poorly documented

| # | Item | Details |
|---|------|---------|
| 49 | **Document `logo` field properly** | The `logo` field is supported (path or URL to logo image) and rendered in the HTML header. It's mentioned in passing ("logo (if configured)") but not listed in Elements or the Reference types section. Add to both. |
| 50 | **Add `logo` and `description` to Reference types** | Reference section lists `type, title, sources, services, html, env` but omits `logo` and `description`. |

---

## 7. `convertor.md` — Convertor Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 51 | **Document Postman dynamic variable mapping** | The convertor automatically maps Postman dynamic variables (`{{$guid}}`, `{{$randomEmail}}`, etc.) to Multimeter `r:` tokens. Not mentioned. |
| 52 | **Document Postman formdata/urlencoded support** | The convertor handles `formdata` and `urlencoded` body modes from Postman collections. Not mentioned. |
| 53 | **Document Postman example extraction** | When Postman items have saved response examples with `originalRequest`, the convertor auto-generates inputs, header input placeholders, and example overrides. Not mentioned. |
| 54 | **Document OpenAPI XML body generation** | OpenAPI convertor generates XML bodies from XML content types. Not mentioned. |

---

## 8. `mock-server.md` — Mock Server Documentation

### P0 — Structural issue

| # | Item | Details |
|---|------|---------|
| 55 | **Restructure document order** | The document opens with the advanced HTTPS/TLS/mTLS section, then after a `---` divider introduces basic purpose ("A lightweight mock server..."). The general overview should come **first**, with TLS details in a later section. |

### P2 — Inconsistency

| # | Item | Details |
|---|------|---------|
| 56 | **Fix `<e:API_URL>` single-angle reference** | Line 76 uses single-angle `<e:API_URL>` while all other docs consistently use `<<e:API_URL>>`. Should be consistent. |

---

## 9. `mmt-overview.md` — Overview Documentation

### P0 — Broken formatting / incorrect content

| # | Item | Details |
|---|------|---------|
| 57 | **Fix `headers` as list instead of map** | The API example writes `headers:` as a YAML list (`- content-type: ...`) but headers are `record<string, string>` (a map). Should be `headers:\n  content-type: application/json`. |
| 58 | **Fix `set` step indentation** | Same broken indentation as test-mmt.md: `token:` should be nested under `set:`. |
| 59 | **Fix triple backticks used as inline code** | Line 85 uses `` ``` `` for inline code markers where single backticks should be used. |

### P3 — Grammar/spelling

| # | Item | Details |
|---|------|---------|
| 60 | **Fix typos and grammar** | "calling **loging**" → "calling **login**"; "two **urls**" → "two **URLs**"; "filter some **of** tests" → "filter some tests"; "two presets as **environmets**" → "two presets as **environments**". |

---

## 10. `demos.md` — Demos Page

### P0 — Broken links

| # | Item | Details |
|---|------|---------|
| 61 | **All 10 demo GIF references are broken** | The `demos/` directory does not exist. All image references (`../demos/api.gif`, `../demos/doc.gif`, `../demos/env.gif`, etc.) are broken. Either create the demo GIFs or replace with screenshots from the existing `screenshots/` directory, or mark as TODO/placeholder. |

### P3 — Missing cross-references

| # | Item | Details |
|---|------|---------|
| 62 | **Add missing "See also" links** | Several demos have no link: Postman Import → link to `convertor.md`; WebSocket Testing → link to `api-mmt.md`; XML Handling → link to `api-mmt.md`; UI Overview → link to `mmt-overview.md`. |

---

## 11. `certificates-mmt.md` — Certificates Documentation

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 63 | **Document self-signed certificate auto-retry behavior** | When `allowSelfSigned` is enabled, the system auto-retries failed HTTPS requests with validation disabled if the error matches specific TLS error codes (`SELF_SIGNED_CERT_IN_CHAIN`, `DEPTH_ZERO_SELF_SIGNED_CERT`). This behavior is not explained. |

---

## 12. Cross-cutting / General

### P1 — Missing features

| # | Item | Details |
|---|------|---------|
| 64 | **Document CSV import behavior** | CSV imports auto-coerce unquoted numeric strings to numbers and `true`/`false` to booleans. Quoted fields stay as strings. Also handles BOM characters and RFC 4180 quoted fields. None of this is documented in test-mmt.md or a dedicated section. |
| 65 | **Document default HTTP timeout** | The default request timeout is 30 seconds (`NetworkData.DEFAULT_NETWORK_CONFIG.timeout = 30000`). Users should know this, especially for slow APIs. Not documented anywhere. |

---

## Execution Plan

### Phase 1 — Fix broken content (P0) — Items: 14, 17, 18, 19, 33, 45, 55, 57, 58, 59, 61
Fix factual errors, broken YAML/Markdown formatting, incorrect claims, broken image links, and structural issues. This is the highest priority since broken content actively misleads users.

### Phase 2 — Document missing features (P1) — Items: 1–13, 20–29, 34–35, 37–38, 42–44, 46–48, 51–54, 63–65
Add new sections and examples for all undocumented features. Group by document and work through each file.

### Phase 3 — Improve existing docs (P2) — Items: 15–16, 30–32, 36, 39–41, 49–50, 56
Expand poorly-documented features, fix inconsistencies, and add better examples.

### Phase 4 — Polish (P3) — Items: 60, 62
Fix typos, grammar, add cross-references, improve readability.

---

## Out of Scope

- Internal-only features (e.g., `abortSignal`, `isExternal`, reporter event shape) — these are for extension/CLI developers, not end users.
- Connection tracker panel — user-visible but self-explanatory in the UI; can be documented separately.
- `keep-alive` / agent pooling — transparent to users, no config knobs.
- `autoFormat` network setting — UI-internal.
