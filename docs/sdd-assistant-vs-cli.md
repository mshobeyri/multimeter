# SDD: Parity between VS Code Assistant (`src/assistant.ts`) and CLI (`mmtcli/src/cli.ts`)

## 1. Scope & goals
This document captures where the VS Code chat-based assistant and the CLI diverge today.

**Goal:** the “command layer” should behave the same across:
- VS Code assistant/chat (`src/assistant.ts`) — human/AI friendly
- CLI (`mmtcli/src/cli.ts`) — pipeline/CI friendly

**Non-goal:** refactor direction/solution design (we’ll discuss after agreeing on divergences).

**Status note (2025-12-20):** some divergences listed below have been addressed in code on branch `dev`:
- CLI `run` now supports `--example`.
- CLI `print-js` now reuses `buildCliRunArgs` for consistent env/input/env-file/preset behavior.
- `core` runner supports loading by path via `fileType: 'path'` using injected `fileLoader`.

---

## 2. Command surface comparison

### 2.1 Commands supported

| Capability | Assistant (`src/assistant.ts`) | CLI (`mmtcli/src/cli.ts`) | Divergence |
|---|---|---|---|
| Help | `/help` (special-cased: also matches text containing `/help`) | `--help` (commander default) + no custom “assistant help” text | Yes (help content + trigger mechanism differs) |
| Run | `/run <file> [args...]` (via chat `request.command === 'run'`) | `multimeter run <file> [options]` | Mostly aligned, but parsing + output differs |
| Print JS | `/print-js <file> [args...]` | `multimeter print-js <file> [options]` | Yes (options + env/input processing differs) |
| Doc generation | `/doc <file> [--md] [--out <file>]` | `multimeter doc <file> [--md] [--html] [-o <file>]` | Yes (flag behavior differs; assistant ignores `--html`) |
| Env info | None | `multimeter version-info` | Yes (CLI-only command) |

> **Status update (2025-12-21):** the packaged binary entry (`mmtcli/src/pkg-entry.cjs`) now implements `run` and `print-js` with the same commonly used flags as the assistant help advertises (`-i/-e/--env-file/--preset/--example/--print-js/-o/-q`).

### 2.2 Options supported per command

#### `run`
- **Assistant help claims support for:** `--quiet`, `--out`, `--input`, `--env`, `--env-file`, `--preset`, `--example`, `--print-js`.
- **CLI supports:** `--quiet`, `--out`, `--input`, `--env`, `--env-file`, `--preset`, `--print-js`.

**Packaged binary (`testlight` via `pkg-entry.cjs`) supports:** `--quiet`, `--out`, `--input`, `--env`, `--env-file`, `--preset`, `--example`, `--print-js`, `--log-level`.

**Divergence (historical):**
- `--example` was documented by assistant but missing in CLI.

**Current status:** fixed — CLI `run` now exposes `--example` and plumbs it into `RunFileOptions`.

> Note: assistant’s `run` uses `parseAssistantRunArgs(...)`. CLI’s `run` uses `buildCliRunArgs(...)`. Those parsers may support different arg sets even when command flags look similar.

#### `print-js`
- **Assistant help claims support for:** `--stages`, `--input`, `--env`, `--env-file`, `--preset`.
- **CLI supports:** `--stages`, `--input`, `--env`, `--env-file`, `--preset`.

**Packaged binary (`testlight`) supports:** `--input`, `--env`, `--env-file`, `--preset`, `--example`.

**Divergences in implementation (details in section 3):**
- Assistant does not actually implement/use `--stages`.
- Assistant likely mishandles file naming and `rawText` loading.
- CLI does not plumb env/preset/env-file into `generateTestJs` (it currently sets `envVars = {}` and passes `inputs` as a list).

#### `doc`
- **Assistant supports:** `--md`, `--out` (custom token parsing).
- **CLI supports:** `--md`, `--html` (HTML default), `--out`.

**Divergence:** assistant ignores `--html` and defaults to HTML unless `--md` is present (similar default), but doesn’t accept `--html` as an override, while CLI uses: `useMd = md && !html`.

---

## 3. Code path divergences (behavior, IO, parsing)

### 3.1 Run execution path

**Assistant (`/run`)**
- Parses args via `parseAssistantRunArgs(projectRoot, request.prompt, context)`.
- Sets `runFileOptions.runCode = runJSCode`.
- Executes via `runner.runFile(runFileOptions)`.
- Response formatting:
  - Inlines logs into Markdown in a fenced block.
  - Emits `Success`, `Duration`, errors.
  - Optionally writes JSON result to `outFile` via `vscode.workspace.fs.writeFile`.

**CLI (`run`)**
- Parses options via `buildCliRunArgs(file, opts)`.
- Sets `runFileOptions.runCode = (code,title,lg)=>runJSCode(...)` (wrapper).
- Executes via `runner.runFile(runFileOptions)`.
- Output formatting:
  - Prints “Loaded: … (summary)” using `summarize(raw)` (extra behavior not in assistant).
  - Prints `Success`, `Duration`, `Errors`.
  - Writes JSON via `fs.writeFileSync`.
  - Exits process with code `0/1/2`.

**Divergence summary:**
- **Different arg parsers**: `parseAssistantRunArgs` vs `buildCliRunArgs`.
- **Extra “Loaded/summary” output**: CLI-only.
- **Exit codes**: CLI defines pipeline semantics; assistant cannot.
- **Logging presentation**: assistant always has the option to render logs; CLI is line-oriented.

### 3.2 Print-JS generation path (major divergence)

**Assistant (`/print-js`)**
- Uses `parseAssistantRunArgs(...)` (same as `/run`).
- Then does:
  - `const rawText = runFileOptions.file;`
  - `const inputPairs = runFileOptions.manualInputs || {};`
  - `const envVars = runFileOptions.envvar || {};`
  - `const name = path.basename('file')...`  ← **BUG/typo: basename of literal 'file'**
  - Calls `runner.generateTestJs({ rawText, name, inputs: inputPairs, envVars, fileLoader })`.

**CLI (`print-js`)**
- Reads file directly via `fs.readFileSync(full, 'utf8')`.
- Passes `inputs = opts.input || []` (array of strings) and `envVars = {}`.
- Calls `mmtcore.runner.generateTestJs({ rawText, name: basename(full), inputs, envVars, fileLoader })`.

**Observed divergences / potential bugs:**
1. **Assistant likely passes the wrong `rawText`:**
   - In `run`, `runFileOptions.file` appears to be a *file path* in many runners, not file contents.
   - For `generateTestJs`, `rawText` should be the file contents.
   - CLI explicitly reads contents; assistant does not.
2. **Assistant uses wrong `name`:** `path.basename('file')` produces constant `file`.
3. **`--stages` option is not applied in assistant:** CLI has a `--stages` flag (default `true`), assistant help documents it, but assistant never reads/uses it.
4. **Input/env typing mismatch:** assistant passes `inputs` as an object (`manualInputs`), CLI passes `inputs` as list of strings.
   - Unless `runner.generateTestJs` supports both (unknown), this is a behavioral divergence.
5. **Env/preset/env-file for print-js:**
   - Assistant appears to support envvar + env-file + preset via `parseAssistantRunArgs`.
   - CLI `print-js` historically ignored env-file/preset entirely.

**Current status:**
- (1) and (2) fixed in assistant (`/print-js` uses `runFileOptions.file` as raw text and derives `name` from `filePath`).
- (5) fixed in CLI (`print-js` now uses `buildCliRunArgs` so it sees env-file/preset/manual env).
- (3) still open: `--stages` is accepted in CLI but not used by core generator; assistant help currently advertises it.

### 3.3 Doc generation path

**Common structure:** both implementations
- Parse doc via `docParsePack.yamlToDoc`.
- Expand doc `sources` and any `services[].sources`.
- Walk folders/paths to collect `.mmt` files.
- Filter to those with `type: api`.
- Parse APIs via `apiParsePack.yamlToAPI`.
- Embed local logo file as data URL when applicable.
- Render HTML or Markdown via `docHtml.buildDocHtml` or `docMarkdown.buildDocMarkdown`.

**Divergences:**
- **YAML library mismatch:** assistant uses `yaml` (eemeli/yaml) and CLI uses `js-yaml`.
- **File system API mismatch:** assistant uses `vscode.workspace.fs`, CLI uses `fs`.
- **CLI chooses md only if `--md` and not `--html`**; assistant chooses md only if `--md` (no `--html` recognized).
- **Output default path:**
  - CLI writes to disk always (defaulting to `<docname>.html|.md`).
  - Assistant prints to chat unless `--out` is passed.

---

## 4. Duplications (logic implemented twice)

### 4.1 Duplication hotspots

1. **Doc generation implementation is duplicated**
   - Directory traversal, `.mmt` discovery, api filtering, logo embedding, and final render are independently implemented.
   - The two implementations are structurally very similar but have subtle behavioral differences (YAML lib, flag rules, output behavior).

2. **Run argument parsing is duplicated** (by different modules)
   - CLI: `buildCliRunArgs` (in `mmtcli/src/runArgs.js`).
   - Assistant: `parseAssistantRunArgs` (in `src/assistantArgs.ts`).

3. **Packaged CLI arg parsing is a third implementation**
   - Packaged binary: `mmtcli/src/pkg-entry.cjs` has its own parsing (`parseRunArgv`/`parsePrintJsArgv`, `parsePairs`, `coerceCliValue`).

3. **Help text is duplicated / can drift**
   - Assistant has a long hard-coded help block that “mirrors CLI”, but it is already drifting (`--example`, `--stages`).

### 4.2 Drift risks caused by duplication
- **Silent behavior differences**: same flag names, different effect.
- **Bug fixes applied to only one surface**.
- **Documentation mismatch**: assistant help claims flags that CLI doesn’t accept (and vice versa).

---

## 5. Concrete divergence list (actionable)

### 5.1 Command surface
- CLI-only: `version-info`.
- Assistant-only: implicit `/help` auto-detection by scanning message text.

### 5.2 Flags/options
- `run`:
   - `--example`: parity achieved (CLI now supports it).
- `print-js`:
  - Assistant: documents `--stages` but ignores it.
   - CLI: env flags now flow into JS generation.

**Current notable mismatch:** `--stages` remains mostly a no-op across surfaces; it is documented but not wired to a core behavior knob.
- `doc`:
  - CLI: `--html` recognized; assistant: no.

### 5.3 Implementation bugs / inconsistencies
- Assistant `/print-js`:
  - `name` computed from literal `'file'`.
  - `rawText` source likely incorrect (`runFileOptions.file`).

---

## 6. Discussion starters (how to fix, high-level)

Not a proposed solution yet, just options to discuss:

1. **Single shared “command core” module** used by both assistant and CLI.
   - Inputs: `{command, args, cwd/workspaceRoot, io adapters}`.
   - Outputs: structured `{exitCode?, stdout?, markdown?, filesWritten?}`.

2. **Move doc generation into `core/`** as a pure function.
   - Both surfaces call it with injected file loaders and directory listing (dependency injection).

3. **Unify argument parsing**
   - Either: one canonical parser in `core/` (pure), with CLI + assistant adapters.
   - Or: generate assistant help text from commander definitions (or vice versa) to avoid drift.

**Concrete merge opportunities (low risk):**
- Extract `coerceCliValue` + `parsePairs` into one shared module (e.g. `core/src/cliValue.ts` or `core/src/runArgsShared.ts`) so assistant/CLI/pkg don’t drift.
- Extract env-file resolution rules (relative-to-test-file directory) into one helper; packaged CLI currently implements it, assistant implements it, and Commander CLI implements it.
- Consider moving doc generation into `core` as a pure pipeline with injected filesystem adapters; both assistant and CLI currently duplicate traversal and filtering.

---

## 7. Open questions (to confirm before refactor)
- Does `runner.generateTestJs` accept `inputs` as an object map, a list of `k=v`, or both?
- Does `parseAssistantRunArgs` read file contents into `runFileOptions.file`, or does it store a path?
- Should assistant “run” output match CLI exactly, or is richer markdown desired?
