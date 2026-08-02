# Install

Get Multimeter on your machine, then optionally add the CLI for terminals and CI.

## VS Code extension

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter), or search for **Multimeter** in the Extensions view.

After install:

1. Open any folder (or clone an example).
2. Create a file ending in `.mmt`.
3. The Multimeter editor opens — use **Send** / **Run** in the toolbar.

The extension includes the custom editor, environment panel, mock server, history, convertor, and AI assistant.

## CLI — testlight

Use the CLI to run `.mmt` files from a terminal or pipeline. Both `testlight` and `mmt` commands are available depending on how you install.

### npm

```sh
npm install -g mmt-testlight
```

Or run without a global install:

```sh
npx mmt-testlight run path/to/test.mmt
```

### macOS (Homebrew)

```sh
brew tap mshobeyri/multimeter
brew install mmt-testlight
```

### Other platforms

Linux (apt / snap), Windows, and Docker installs are listed on the [Downloads](/downloads) page.

## Next steps

- [Getting Started](./quick-start.md) — run your first request
- [Start with a task](./tasks/index.md) — pick a goal
- [Downloads](/downloads) — full install options and versions
