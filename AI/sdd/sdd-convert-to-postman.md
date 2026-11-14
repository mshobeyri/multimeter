# SDD: Convert `.mmt` → Postman (exit export)

**Date:** 2026-11-14  
**Status:** Implementing (branch `feature/convert-to-postman`)  
**Product framing:** Exit solution — right-click on `.mmt` files, mirror of **Convert to MMT...** for Postman/Bruno/OpenAPI/HTTP sources.

---

## Summary

Add **Convert to Postman...** so users can export Multimeter `type: api`, `type: test`, and `type: suite` files into a **valid** Postman Collection v2.1 JSON. Logic lives in `core/` (pure, injectable file loader); VS Code Explorer context menu is the primary surface; CLI reuses the same convertor.

**Exit-grade, not complete:** the generated file must import/open cleanly in Postman with no broken schema or broken scripts. Unmapped Multimeter features are omitted (with warnings); users finish those manually. Not a perfect round-trip with Convert to MMT.

---

## Motivation

- Adoption objection: “What if we need to leave?” — answer with one right-click.
- Symmetric UX with existing **Convert to MMT...** (`multimeter.convert.toMmt` / `src/mmtAPI/convertToMmt.ts`).
- Real prior art in-repo: `examples/real-projects/open-meteo-mmt/postman/generate-collection.mjs` already walks suite → tests → APIs into Collection v2.1; promote that pattern into a maintained convertor.
- Competitive story: Bruno/Postman migrations are one-way today; exit export makes Multimeter safer to standardize on.

---

## Product decisions

Guiding rule (product): **valid export over complete export.** Prefer omitting something over emitting a collection that fails to import or runs broken scripts. Manual fix-up in Postman is expected.

### 1. Output artifacts — **chosen**

**Suites as suites; `e:` as usages; env export separate.**

- Default convert of api/test/suite → **one Collection v2.1** only (suites → folders inside that collection — Postman does not use one file per suite).
- `e:name` / `<<e:name>>` → `{{name}}` in URLs/headers/body. Do **not** auto-attach a Postman environment JSON when converting api/test/suite.
- **Env export is a separate action:** right-click a `type: env` `.mmt` (same **Convert to Postman...** command, type-detect) → `*.postman_environment.json` only (variables / presets → Postman environment values). Never mixed into the collection file from an api/test/suite convert.

### 2. Fidelity (asserts / scripts) — **chosen: simple allowlist (B)**

Export **easy, unambiguous** expects/checks as Postman `pm.test` scripts. Skip anything outside the allowlist (+ warning). Prefer omit over a wrong/broken script.

**Export (v1 allowlist):**

| Multimeter (examples) | Postman script idea |
|----------------------|---------------------|
| `status: 200` / `status == 200` | `pm.response.to.have.status(200)` |
| `body.field: defined` / exists | `pm.expect(json.field).to.exist` |
| `body.field: 123` / `"ok"` / `true` (literal equality) | `pm.expect(json.field).to.eql(…)` |
| Header equals literal (e.g. `headers.content-type` contains/equals a string) | Simple `pm.response.headers.get(…)` check when path is plain |
| Top-level `body` equals a small literal JSON/object | `pm.expect(pm.response.json()).to.eql(…)` when value is literal |

Path access: only **simple dotted paths** (`body.token`, `body.user.id`) — no filters, wildcards, regex extractors, or complex operators.

**Do not export (warn + skip):**

- `require` / soft vs hard nuances beyond “emit a failing `pm.test`”
- `ai` / judge steps, `js` checks, schema/`ajv`, XML/xpath-heavy checks
- Operators beyond plain equality / defined (ranges, regex, custom ops) unless trivially mapped
- Values that still need Multimeter runtime tokens (`o:`, unresolved `e:` slices, `r:` inside expect RHS) — skip that assert
- Anything we’re not sure maps 1:1

**`setenv` / output chaining — chosen: handle.**

- API or test `setenv` (and simple `o:` / response path sources) → Postman **test** script: `pm.collectionVariables.set("name", …)` (or `pm.environment.set` when clearly env-scoped).
- Later requests that used `e:name` / `<<e:name>>` after setenv keep `{{name}}`.
- Only simple extraction paths (same spirit as assert allowlist). Complex extractors → warn + skip that binding.
- This is required for exit usability, not optional polish.

Example:

```yaml
- call: login
  expect:
    status: 200
    body.token: defined
  setenv:
    token: o:body.token
```

→ request + simple `pm.test`s + script sets collection var `token`.

### 3. Suite / test shape — **chosen: 1**

Suite → folders (nested suites as subfolders); test → ordered request items; API → single-request collection.

### 4. Save UX — **chosen: 1**

Mirror **Convert to MMT**: user selects what to save → destination folder → collision policy.

### 5. Surfaces — **chosen: 1**

Explorer right-click first; same core API; CLI same release if cheap, else right after.

### 6. Protocol scope — **chosen: HTTP + GraphQL + WebSocket**

- **HTTP / GraphQL:** full request mapping.
- **WebSocket (`protocol: ws`):** convert — Postman supports WS requests; map URL, headers/protocols, and initial message(s) when Multimeter has them (one-shot / first send). Keep the item valid so it opens in Postman; document limits in description/warnings (e.g. live multi-message Connect panel flows may need manual tweak).
- **gRPC / mock / load / doc / report:** warn + skip (not in v1).

---

## User experience

### Command

- Command id: `multimeter.convert.toPostman`
- Title: **Convert to Postman...**
- Category: Multimeter
- Icon: same family as Convert to MMT (`$(export)` or distinct export icon if available)

### When / where

| Surface | Behavior |
|---------|----------|
| `explorer/context` | Show when `resourceExtname == .mmt` |
| Command palette | Available; uses active editor URI or requires a selected `.mmt` |
| Editor title (optional, later) | Not required for v1 |

Do **not** show on Postman/Bruno/OpenAPI sources (those already have Convert to MMT).

### Flow (mirror of Convert to MMT)

1. User right-clicks a `.mmt` file.
2. Extension reads file bytes; calls `core` `convertToPostman(raw, options)`.
3. If `type` is `env`: run **env → Postman environment** export (separate from collection convert). If `mock` / `doc` / `report` / etc.: clear unsupported message.
4. Quick pick of generated artifact(s) (usually one collection; env-only when converting env), selected by default.
5. Folder picker → collision policy → write files.
6. Info toast: Open Folder / Open First File.

### Generated file names

| Kind | Suggested relative path |
|------|-------------------------|
| Collection | `<slug>.postman_collection.json` |
| Environment | `<slug>.postman_environment.json` |

`slug` from file `title` or basename without `.mmt`. For a suite named `Smoke`, e.g. `smoke.postman_collection.json`.

---

## Design

### Architecture

```
Explorer / CLI
  └─ convertToPostman(rawFile, { sourcePath, fileLoader, ... })
       ├─ detect type (api | test | suite)
       ├─ resolve imports via fileLoader (+/ and relative)
       ├─ apiToPostmanRequest / testToPostmanItems / suiteToPostmanFolder
       ├─ collect referenced env keys → optional environment export
       └─ { files: ConvertedPostmanFile[], warnings: string[] }
```

Keep **all** mapping in `core/` (no `vscode` / `fs`). Extension and CLI only supply `fileLoader` and write results.

### New modules (proposed)

| Module | Role |
|--------|------|
| `core/src/convert/mmtToPostmanConvertor.ts` | Public API: `convertToPostman`, type detection, suite/test walk |
| `core/src/convert/mmtToPostmanMapping.ts` (optional split) | Token rewrite, auth, body, assert → script helpers |
| `core/src/convert/mmtToPostmanConvertor.test.ts` | Fixtures: single API, chained test, nested suite |
| `src/mmtAPI/convertToPostman.ts` | VS Code UI (clone patterns from `convertToMmt.ts`) |
| `mmtcli/` | `testlight convert postman <file> [--out <dir>]` (same core) |

Reuse existing parsers (`apiParsePack` / `testParsePack` / `suiteParsePack`) and suite hierarchy / path resolution used by the runner — do **not** re-parse YAML with ad-hoc regex except where the open-meteo script’s “strip assertion blocks for loose parse” is needed for resilience; prefer real parsers.

Invert helpers already in `postmanConvertor.ts` where possible:

- `translatePostmanTemplate` (`{{x}}` → `<<e:x>>` / `r:…`) → **`translateMmtTokenToPostman`** (`<<e:x>>` / bare `e:x` / `r:uuid` → `{{x}}` / `{{$guid}}`, …)
- Reuse `POSTMAN_RANDOM_MAP` as a **reverse** lookup for supported `r:` names

### Public core API (sketch)

```typescript
export type PostmanExportKind = 'collection' | 'environment';

export interface ConvertedPostmanFile {
  path: string;           // relative, e.g. smoke.postman_collection.json
  kind: PostmanExportKind;
  content: string;        // pretty-printed JSON
  warnings?: string[];
}

export interface ConvertToPostmanOptions {
  sourcePath?: string;
  /** Resolve import / suite child paths (required for test + suite). */
  fileLoader: (absoluteOrProjectPath: string) => Promise<string> | string;
  /** Optional: project root for `+/` resolution. */
  projectRoot?: string;
  /** Default true when any e: / env keys collected. */
  includeEnvironment?: boolean;
  /** Default 'best-effort'. */
  assertMode?: 'skip' | 'best-effort';
}

export interface ConvertToPostmanResult {
  sourceType: 'api' | 'test' | 'suite';
  title?: string;
  files: ConvertedPostmanFile[];
  warnings: string[];
}

export function convertToPostman(
  rawFile: string,
  options: ConvertToPostmanOptions,
): Promise<ConvertToPostmanResult>;
```

### Per-type behavior

#### `type: api`

- One collection, one request item.
- Map: method, URL (path + host + query), headers, body, auth, GraphQL query/variables when `protocol: graphql`.
- Inputs (`i:`) → Postman path/query/`{{inputName}}` placeholders; document in description if useful.
- Examples: optional extra request items or Postman examples (`response` array) — **v1: skip examples** unless cheap; prefer one request with defaults.

#### `type: test`

- Walk `steps` in order.
- Each `call` that resolves to an HTTP/GraphQL API → one request item.
- `setenv` / output chaining (`o:`, `${id.field}`) → Postman collection/environment variable `set` in a **test** script on the producing request (same pattern as open-meteo geocode → `chain_lat`).
- Non-call steps (`js`, `wait`, nested flows): warn + skip or emit commented script stubs.
- Asserts (`expect` / `assert` / `check` / `require`): **simple allowlist only** (decision #2) — status, defined, literal equality on simple paths; else warn + skip.

#### `type: suite`

- Build folder tree from suite entries (tests and nested suites).
- Each test folder/item list from test conversion above.
- Parallel `group` semantics: **flatten to sequential folders** in Postman (Postman collections are not Multimeter parallel groups); add a collection description note + warning that order/parallelism may differ.
- Suite `environment` block: do **not** auto-write a Postman env file on suite convert; `e:` usages remain `{{…}}`. User exports env separately if they want values filled in.

#### Unsupported / edge

| Case | Behavior |
|------|----------|
| gRPC API | Warning; omit |
| WebSocket API | Convert to Postman WS request (URL/headers/initial message); warn on live multi-message limits |
| Missing import path | Warning; skip that call |
| `type: env` alone | v1: message “open a suite/test/api, or use env export later” |
| Binary / multipart file bodies | Best-effort; warn like import path |
| Tokens with slices (`e:x[0]`, etc.) | Warn; leave literal or best-effort `{{x}}` |

---

## Mapping cheat sheet (v1)

| Multimeter | Postman |
|------------|---------|
| `<<e:name>>` / bare `e:name` | `{{name}}` |
| `i:name` / `<<i:name>>` | `{{name}}` (and declare as collection var if no default) |
| `r:uuid` (and other mapped `r:`) | `{{$guid}}` / reverse of `POSTMAN_RANDOM_MAP` |
| Unsupported `r:` / `c:` / complex accessors | Leave as text + warning |
| Bearer / basic / apikey auth | Postman `auth` object |
| JSON / text / urlencoded / graphql body | Matching Postman `body.mode` |
| Status expect `== 200` | `pm.response.to.have.status(200)` |
| Simple JSON path expect | `pm.expect(pm.response.json()…).…` best-effort |

Round-trip with **Convert to MMT** is **not** a v1 guarantee. Prefer readable Postman that a human can run.

---

## Extension wiring

1. `package.json`: register `multimeter.convert.toPostman`; add `explorer/context` when clause for `.mmt`; command palette entry.
2. `src/extension.ts`: register handler → `convertUriToPostman`.
3. `src/mmtAPI/convertToPostman.ts`: UI twin of `convertToMmt.ts`, with workspace `fileLoader` using `vscode.workspace.fs` + project-root `+/` resolution (reuse existing path helpers if present).
4. Docs: `docs/integration/postman.md` — new **Convert to Postman** section; adoption / AI docs one-liner under exit/migration.

---

## CLI (recommendation #5)

```text
testlight convert postman path/to/file.mmt [--out dir] [--no-env]
```

- Writes the same files as the extension.
- Exit non-zero if no files generated or fatal parse/resolve errors; print warnings to stderr.
- If CLI lands in a follow-up PR, keep the core API stable so the extension does not change.

---

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | Token reverse map; API → request JSON; test with `setenv` chain; suite folders |
| Fixture | Round-ish: take `examples/intermediate/25_convert_to_mmt/postman/converted/` (or open-meteo suite) → export → openable Collection v2.1 schema |
| Manual | Right-click API / test / suite in Extension Development Host; import into Postman or Newman |

Schema check: `info.schema` = `https://schema.getpostman.com/json/collection/v2.1.0/collection.json`.

---

## Non-goals (v1)

- Perfect round-trip with Postman → MMT.
- Exporting Bruno, OpenAPI, or Insomnia from `.mmt` (Postman only).
- Preserving Multimeter parallel suite groups / call cache / load profiles.
- Folder-level “export whole project” (user can right-click root suite instead).
- Editor title-bar button (Explorer is enough).
- Marketplace demos beyond docs + one example under `examples/` if useful.

---

## Implementation phases

| Phase | Deliverable |
|-------|-------------|
| **P0** | Core: API → collection; extension command + Explorer menu; docs blurb |
| **P1** | Test walk + `setenv`/output chaining; warnings |
| **P2** | Suite folders + nested resolve; optional env JSON |
| **P3** | Best-effort asserts; CLI `testlight convert postman` |
| **P4** | Example under `examples/` (or replace open-meteo hand script with core call) |

Ship Explorer + API/test/suite HTTP path when P0–P2 are solid; P3–P4 can trail without blocking the exit story.

---

## Success criteria

- Right-click any HTTP/GraphQL `.mmt` **api**, **test**, or **suite** → **Convert to Postman...** → importable Collection v2.1.
- Referenced env keys appear as `{{vars}}` in the collection; env **values** come only from a separate env-file convert (#1).
- `setenv` simple paths become Postman variable-set scripts so chained requests keep working.
- Simple expects export; hard expects warn + skip (#2).
- HTTP, GraphQL, and WebSocket APIs convert; gRPC and other kinds warn + skip (#6).
- UX matches Convert to MMT (#4).
- No `vscode` imports in `core` convertor.

---

## Open follow-ups (not blocking)

- Export Postman **data files** / iteration from Multimeter data-driven tests.
- “Export project” from `multimeter.mmt` root.
- Newman-ready packaging (collection + env in one folder README).
- Bidirectional fidelity tests once import and export stabilize.
- Mark Postman env vars as `secret` type when Multimeter gains an explicit secret flag (today: export plain values).