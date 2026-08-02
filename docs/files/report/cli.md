# CLI

`type: report` files are output artifacts. Generate them with the `--report` flag when running tests, suites, or load tests.

## Usage

```bash
npx testlight run test.mmt --report junit
npx testlight run suite.mmt --report mmt
npx testlight run loadtest.mmt --report html
npx testlight run test.mmt --report md
npx testlight run test.mmt --report md-detailed
```

### Custom output path

```bash
npx testlight run suite.mmt --report junit --report-file results/output.xml
```

### Default filenames

| Format | Default filename |
|--------|-----------------|
| `junit` | `test-results.xml` |
| `mmt` | `test-results.mmt` |
| `html` | `test-results.html` |
| `md` | `test-results.md` |
| `md-detailed` | `test-results-detailed.md` |

## Auto-export from `.mmt` files

Suites and load tests can auto-generate reports after completion using the `export:` field. Format is inferred from the file extension (`.xml`, `.html`, `.md`, `.mmt`).

- [Suite exports](../suite/exports.md) — `export:` on `type: suite`
- [Load test exports](../loadtest/exports.md) — `export:` on `type: loadtest`

See also: [CI/CD](./ci.md) · [Reference](./reference.md) · [Running](../../running/testlight/index.md)
