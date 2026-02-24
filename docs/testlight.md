# Testlight CLI

Run Multimeter api, tests and generate documentation from the command line and in CI/CD.

Testlight compiles your `.mmt`/YAML tests to JS on the fly and executes them with the same core engine the VS Code extension uses.

## Install

- Local (via npx):
  - npx testlight run examples/test/login_and_get_user_info.mmt --quiet
- Binary (recommended for CI):
  - See mmtcli README for pkg-built binaries under `dist/bin/`

## Commands

- run <file>
  - Execute a test file (.yaml/.yml/.json/.mmt)
  - Writes a JSON summary if `--out` is provided
  - Options:
    - `--example <name|#n>` — run a specific named example or numeric index (e.g., `--example happy-path` or `--example #1`)
- print-js <file>
  - Print the generated executable JS for a test file
  - Use this to inspect how a test will run
  - Options:
    - `--example <name|#n>` — print JS for a specific example
- doc <file>
  - Generate documentation from a `type: doc` file (.mmt/.yaml/.yml)
  - Options:
    - `-o, --out <file>` — write output to file (default: `<docname>.html` in the current directory)
    - `--md` — generate Markdown instead of HTML
  - See [Doc](./doc-mmt.md) for authoring `type: doc` files
- version-info
  - Print the CLI and Node.js version

## Options

- --log-level <level>
  - Set log verbosity: `error`, `warn`, `info`, `debug`, `trace`
  - Example: `--log-level debug`
- -i, --input <pairs>
  - Input variables as key/value pairs, repeatable
  - Forms: key=value or key value
  - Example: -i user_id=42 env prod
- -e, --env <pairs>
  - Environment variables as key/value pairs, repeatable
  - Values are type-coerced (true/false/number) unless quoted
  - Example: -e API_URL=http://localhost:8080 DEBUG=true retries=3 "token=abc xyz"
- --env-file <path>
  - Load variables and presets from an environment file (.mmt/.yaml)
  - Path resolves from cwd, then relative to the test file
- --preset <name>
  - Select a preset defined in the env file
  - Accepts `dev` (under `presets.runner.dev`) or dotted `group.name`
- --print-js (in run)
  - Print generated JS before executing
- -q, --quiet
  - Minimal output
- -o, --out <file>
  - Write result JSON to a file

## Examples

- Run a test with inputs and env overrides
  ```sh
  testlight run examples/test/login_and_get_user_info.mmt -i username=mehrdad -e API_URL=http://localhost:8080
  ```
- Run with env file preset and explicit overrides
  ```sh
  testlight run examples/test/login_and_get_user_info.mmt --env-file ./examples/_environments.mmt --preset dev -e retries=2
  ```
- Print generated JS for inspection
  ```sh
  testlight print-js examples/test/login_and_get_user_info.mmt --env-file ./examples/_environments.mmt --preset dev
  ```

- Generate documentation HTML from a Doc file
  ```sh
  # default output: ./catalog.html
  testlight doc docs/catalog.mmt

  # custom output path
  testlight doc docs/catalog.mmt --out ./public/catalog.html

  # generate Markdown instead of HTML
  testlight doc docs/catalog.mmt --md --out ./public/catalog.md
  ```

- Run a specific example by name or index
  ```sh
  testlight run api/login.mmt --example happy-path
  testlight run api/login.mmt --example '#1'
  ```

## Tips

- Env tokens in tests (`e:VAR`, `<<e:VAR>>`) resolve at runtime; prefer presets for switching environments.
- Quoted values are kept as strings: `-e port="08080"`.
- When `--env-file` is relative, it resolves from the shell cwd first, then the test file directory.
- Use `--out` to capture structured results in CI.

---

## See also
- [API](./api-mmt.md) — define HTTP/WS requests to run from the CLI
- [Test](./test-mmt.md) — define test flows to run from the CLI
- [Environment](./environment-mmt.md) — variables and presets (`--env-file`, `--preset`)
- [Doc](./doc-mmt.md) — author doc files for `testlight doc`
- [Suite](./suite-mmt.md) — run suites from the CLI
- [Sample Project](./sample-project.md) — full walkthrough with CLI examples
- [Logging](./logging.md) — log levels and where logs appear for each entry point
