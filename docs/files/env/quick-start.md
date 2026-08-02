# Environment quick start

Minimal environment file with one variable:

```yaml
type: env
variables:
  base_url: https://test.mmt.dev
```

Open the file in VS Code to get the **environment panel** on the right. Use {{btn:edit:Edit Environment}} to edit variables and presets.

Reference the variable in API or test files:

```yaml
url: <<e:base_url>>/echo
```

More: [Edit Environment](./edit.md) · [Environment variables panel](./ui.md) · [Use environments](../../tasks/use-environments.md) · [CLI](./cli.md)
