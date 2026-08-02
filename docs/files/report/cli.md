# CLI and auto-export

## CLI usage

Use the `--report` flag with `testlight run`:

```bash
# Generate JUnit XML report
npx testlight run test.mmt --report junit

# Generate MMT YAML report
npx testlight run suite.mmt --report mmt

# Generate HTML report
npx testlight run loadtest.mmt --report html

# Generate Markdown report
npx testlight run test.mmt --report md

# Generate detailed Markdown (summary + request/response IO)
npx testlight run test.mmt --report md-detailed
```

### Custom output path

Use `--report-file` to specify a custom output path:

```bash
npx testlight run suite.mmt --report junit --report-file results/output.xml
npx testlight run loadtest.mmt --report html --report-file reports/load.html
```

### Default output paths

| Format | Default filename |
|--------|-----------------|
| `junit` | `test-results.xml` |
| `mmt` | `test-results.mmt` |
| `html` | `test-results.html` |
| `md` | `test-results.md` |
| `md-detailed` | `test-results-detailed.md` |

## Auto-export from `.mmt` files

Suites can automatically generate reports after completion using the `export` field:

```yaml
type: suite
title: CI Suite
export:
  - ./reports/results.xml
  - ./reports/results.html
items:
  - tests/login.mmt
  - tests/profile.mmt
```

Load tests can also automatically generate reports after completion:

```yaml
type: loadtest
title: Login Load Test
threads: 100
repeat: 1m
rampup: 10s
export:
  - ./reports/load-results.mmt
  - ./reports/load-results.html
  - ./reports/load-results.md
  - ./reports/load-results.xml
test: ./tests/login.mmt
```

See [Suite — Exports](./suite.md#exports) and [Load Test — Exports](./loadtest.md#export) for details.
