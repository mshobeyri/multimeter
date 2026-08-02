# Report CLI

`type: report` files are output artifacts. Generate them with the `--report` flag when running tests, suites, or load tests:

```bash
testlight run test.mmt --report junit
testlight run suite.mmt --report mmt
testlight run loadtest.mmt --report html
testlight run test.mmt --report md
testlight run test.mmt --report md-detailed
```

Custom output path:

```bash
testlight run suite.mmt --report junit --report-file results/output.xml
```

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

See [Testlight — Options](../../features/testlight/options.md) · [Testlight](../../features/testlight/index.md) · [CI/CD](./ci.md) · [Reference](./reference.md)
