# Report quick start

Reports are generated after running tests, suites, or load tests — not authored directly.

Generate an HTML report from the CLI:

```sh
npx testlight run path/to/test.mmt --report html
```

Or add `export:` to a suite so reports are written automatically after a run:

```yaml
type: suite
title: CI Suite
export:
  - ./reports/results.html
items:
  - tests/login.mmt
```

Open a generated `.mmt` file with `type: report` in VS Code to view the read-only report panel and re-export to other formats.

More: [CLI](./cli.md) · [VS Code](./vscode.md) · [HTML](./html.md) · [JUnit](./junit.md)
