# Report quick start

Reports are generated after running tests, suites, or load tests — not authored directly.

## CLI

Generate an HTML report:

```sh
npx testlight run path/to/test.mmt --report html
```

Other formats: `junit`, `mmt`, `md`, `md-detailed`. See [CLI](./cli.md).

## Auto-export from a suite

Add `export:` so reports are written automatically after a run:

```yaml
type: suite
title: CI Suite
export:
  - ./reports/results.html
items:
  - tests/login.mmt
```

See [Suite exports](../suite/exports.md) for path rules and format mapping.

## View and re-export

Open a generated `.mmt` file with `type: report` in VS Code to view the read-only report panel and re-export to any format.

See also: [Overview](./index.md) · [CLI](./cli.md) · [Reference](./reference.md)
