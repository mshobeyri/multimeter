# Suite tag filter

Run a subset of a suite by `tags:` on tests and nested suites — `filter.only` / `filter.skip` in YAML, or `--tag` / `--skip-tag` on the CLI.

## Files

| File | Tags / filter | What runs |
|------|---------------|-----------|
| `tests/smoke_get.mmt` | `smoke`, `api` | Smoke and API-only filters |
| `tests/smoke_post.mmt` | `smoke` | Smoke only |
| `tests/api_echo.mmt` | `api` | API-only (skipped by only-smoke) |
| `tests/flaky_echo.mmt` | `flaky` | Full run; skipped by `skip: [flaky]` |
| `tests/slow_status.mmt` | `slow` | Full run; skipped by `--skip-tag slow` |
| `tests/untagged.mmt` | — | Full run; skipped when `only` is set |
| `nested/auth.mmt` | `smoke` | Selecting this suite runs **login** and untagged **profile** |
| `suite.mmt` | no filter | Everything |
| `suite_smoke.mmt` | `only: [smoke]` | Smoke tests + nested auth subtree |
| `suite_ci.mmt` | `only: [smoke, api]`, `skip: [flaky]` | Typical CI selection |

**only-smoke** runs `smoke_get`, `smoke_post`, nested `login`, and nested `profile` (untagged child of a selected suite). It skips `api_echo`, `flaky_echo`, `slow_status`, and `untagged`.

**CI** also runs `api_echo`. `flaky_echo` is skipped even if it would match `only`.

## How to use

### In VS Code

1. Open `suite_smoke.mmt` or `suite_ci.mmt`.
2. Skipped items show a skip icon before you run.
3. Click **Run suite**. Edit `filter:` on the **Filter** tab of Edit Suite.

### With the CLI

YAML `filter:` on the file you run:

```sh
npx testlight run examples/intermediate/29_suite_tag_filter/suite_smoke.mmt
npx testlight run examples/intermediate/29_suite_tag_filter/suite_ci.mmt
```

CLI flags **replace** that file’s `filter:` (they do not merge):

```sh
npx testlight run examples/intermediate/29_suite_tag_filter/suite.mmt --tag smoke
npx testlight run examples/intermediate/29_suite_tag_filter/suite.mmt --skip-tag flaky --skip-tag slow
npx testlight run examples/intermediate/29_suite_tag_filter/suite.mmt --tag smoke,api --skip-tag flaky
```

## Key concepts

- `only:` is OR within the list (empty = all). `skip:` is OR (empty = none). Order is **only, then skip**.
- A tagged **suite** selected by `only` runs its subtree, except descendants that match `skip`.
- An untagged parent suite is only a container: children can still match.
- Skipped items are reported as skipped, not failed.

See [Tag filter](../../../docs/files/suite/execution.md#tag-filter) · [Edit Suite — Filter](../../../docs/files/suite/edit.md#filter) · [Testlight options](../../../docs/features/testlight/options.md)
