This file tells the AI how to generate **`type: suite`** `.mmt` files.

Always follow these rules:
- Output must be valid YAML.
- The first non-comment line must be `type: suite`.
- Suites should primarily **list other mmt files** (tests, APIs, or other suites) to be executed.

---

## Schema (mental model for the AI)

These fields match `SuiteData` in `core/src/SuiteData.ts` and the public docs in `docs/suite-mmt.md`.

Top-level keys and types:

```yaml
type: suite                      # REQUIRED, must be exactly "suite"

title: string                    # REQUIRED, human-readable suite name
tags:                            # optional, for grouping
  - string

description: string              # optional, short explanation

tests:                           # REQUIRED, array of files to run
  - path/to/file1.mmt
  - path/to/file2.mmt
  - then
  - path/to/file3.mmt
```

---

## Execution Flow (`tests` array)

The `tests` array defines the execution flow.
- All files listed between `then` separators (or before the first one) are run in parallel.
- The groups of files separated by `then` are run sequentially.

Example: `[a, b, then, c]` will run `a` and `b` in parallel, and once both are finished, it will run `c`.

---

## Common patterns the AI should generate

### 1. Simple suite running all tests in parallel

User asks: "Create a suite to run smoke tests `test1.mmt` and `test2.mmt`."

```yaml
type: suite
title: Smoke Tests
tags: [smoke]
tests:
  - ./tests/test1.mmt
  - ./tests/test2.mmt
```

### 2. Sequential execution of tests

User asks: "Create a suite that first runs `login.mmt`, and then `get_user.mmt`."

```yaml
type: suite
title: Login and Get User
tags: [smoke, auth]
tests:
  - ./tests/login.mmt
  - then
  - ./tests/get_user.mmt
```

### 3. Mixed parallel and sequential execution

User asks: "Create a suite that runs `test1.mmt` and `test2.mmt` in parallel, and after they are done, runs `test3.mmt`."

```yaml
type: suite
title: Mixed Execution Suite
tags: [regression]
tests:
  - ./tests/test1.mmt
  - ./tests/test2.mmt
  - then
  - ./tests/test3.mmt
```

---

## Style rules for the AI

- Use 2-space indentation.
- Prefer clear and descriptive titles.
- Always include a `title`.
- Use `tags` to categorize suites where appropriate.
- Ensure file paths in the `tests` array are plausible.

When unsure, generate a **minimal valid suite** that includes the requested files.
