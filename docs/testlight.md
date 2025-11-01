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
- print-js <file>
  - Print the generated executable JS for a test file
  - Use this to inspect how a test will run
- doc <file>
  - Generate a standalone HTML document from a `type: doc` file (.mmt/.yaml/.yml)
  - Options:
    - -o, --out <file>  Write HTML to file (default: <docname>.html in the current directory)
  - See [Doc](./doc-mmt.md) for authoring `type: doc` files
- version-info
  - Print the CLI and Node.js version

## Options

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
  ```

## Tips

- Env tokens in tests (`e:VAR`, `<<e:VAR>>`) resolve at runtime; prefer presets for switching environments.
- Quoted values are kept as strings: `-e port="08080"`.
- When `--env-file` is relative, it resolves from the shell cwd first, then the test file directory.
- Use `--out` to capture structured results in CI.
