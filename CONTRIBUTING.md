# Contributing to Multimeter

Thank you for your interest in contributing to Multimeter!

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies from the repo root:
   ```sh
   npm install
   ```
3. Build all packages:
   ```sh
   npm run compile
   ```
4. Run tests:
   ```sh
   npm run test
   ```

## Project Structure

- `core/` — Pure TypeScript library: parsing, execution, network logic. No VS Code or `fs` dependencies.
- `mmtview/` — React + VS Code webview UI for `.mmt` files.
- `mmtcli/` — CLI app; the `testlight` binary used in CI and local runs.
- `src/` — VS Code extension host code (activation, editor provider, assistant).
- `docs/` — User-facing documentation.

## Development Guidelines

- Keep `core/` platform-neutral — no `vscode`, `fs`, browser, or Node-specific globals. Use dependency injection.
- Implement new behavior in `core/` first, then wire it to the extension (`src/`), webview (`mmtview/`), and CLI (`mmtcli/`).
- Use 2-space indentation; always use curly braces for all control structures, even single-line bodies.
- Add or update unit tests in `core/src/*.test.ts` for any logic changes.
- Do not duplicate token-matching regex or variable replacement logic — use `core/src/variableReplacer.ts`.

## Submitting Changes

1. Create a branch with a descriptive name (e.g. `fix/websocket-timeout`, `feat/add-grpc-assert`).
2. Keep commits focused and use short, imperative commit messages (e.g. `Fix WebSocket reconnect`, `Add gRPC assertion support`).
3. Open a pull request against the `main` branch with a clear description of the change and why it is needed.
4. Ensure all tests pass and the build succeeds before requesting review.

## Reporting Issues

Please use [GitHub Issues](https://github.com/mshobeyri/multimeter/issues) to report bugs or request features. Include steps to reproduce, expected behavior, and actual behavior when reporting bugs.

## License

By contributing, you agree that your contributions will be licensed under the [Business Source License 1.1](LICENSE.md).
