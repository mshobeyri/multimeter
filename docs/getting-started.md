# Getting Started

Multimeter is a Git-friendly API client and test runner for VS Code. You define requests, tests, environments, and suites as plain YAML `.mmt` files — then run them in the editor or in CI with `testlight`.

## Choose a path

| Guide | When to use it |
|---|---|
| [Install](./install.md) | Set up the VS Code extension and CLI |
| [Quick Start](./quick-start.md) | Create and run your first `.mmt` file |
| [Start with a task](./tasks/index.md) | Jump in by what you want to do |
| [Files](./files.md) | Learn each `.mmt` file type |
| [Examples](./examples) | Browse real projects with file trees |

## Start with a task

- [Send an API request](./tasks/send-api-request.md) — define a `type: api` file and hit Send
- [Write a test flow](./tasks/write-test-flow.md) — assert status, body, and headers
- [Use environments](./tasks/use-environments.md) — switch URLs and secrets without editing requests
- [Run a suite](./tasks/run-suite.md) — group tests and run them together
- [Generate docs](./tasks/generate-docs.md) — publish API docs from your `.mmt` files
- [Run in CI](./tasks/run-in-ci.md) — execute tests with the `testlight` CLI

## Why Multimeter?

- **Git-native** — store APIs and tests as files; review changes like code
- **VS Code first** — custom editor, panels, mock server, and history in one place
- **Same files in CI** — `testlight` runs the same `.mmt` files your team edits locally
- **Plain YAML** — readable, searchable, and easy for AI tools to generate
