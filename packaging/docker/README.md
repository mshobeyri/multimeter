# mmt-testlight

The official Docker image for [Multimeter](https://mmt.dev) CLI (`testlight`) — run `.mmt` API tests, test suites, and generate API documentation from any container environment.

## Quick Start

```bash
# Run a test
docker run --rm -v "$PWD:/w" -w /w mshobeyri/mmt-testlight run test.mmt

# Run a test suite
docker run --rm -v "$PWD:/w" -w /w mshobeyri/mmt-testlight run suite.mmt

# Generate API documentation
docker run --rm -v "$PWD:/w" -w /w mshobeyri/mmt-testlight doc api.mmt -o docs.html

# Check version
docker run --rm mshobeyri/mmt-testlight --version
```

Both `testlight` and `mmt` commands are available:

```bash
docker run --rm --entrypoint mmt mshobeyri/mmt-testlight --version
```

## Commands

| Command | Description |
|---|---|
| `run <file>` | Execute a `.mmt` test or suite file |
| `doc <file>` | Generate HTML/Markdown API documentation |
| `print-js <file>` | Print compiled JS for debugging |
| `version-info` | Show CLI and runtime version |

## Options

```
-i, --input <pairs>     Input variables (key=value, repeatable)
-e, --env <pairs>       Environment variables (key=value, repeatable)
--env-file <path>       Load variables from an env file (.mmt/.yaml)
--example <name|#n>     Run a specific named example
--log-level <level>     Log verbosity: error, warn, info, debug, trace
-o, --out <file>        Write output to a file
--md                    Generate Markdown docs instead of HTML
```

## CI/CD Example

### GitHub Actions

```yaml
- name: Run API tests
  run: |
    docker run --rm -v "${{ github.workspace }}:/w" -w /w \
      mshobeyri/mmt-testlight run tests/suite.mmt
```

### GitLab CI

```yaml
test:
  image: mshobeyri/mmt-testlight
  script:
    - testlight run tests/suite.mmt
```

## Image Details

- **Base**: `node:18-alpine`
- **Size**: ~60 MB compressed
- **Platforms**: linux/amd64

## Other Installation Methods

| Method | Command |
|---|---|
| **npm** | `npm install -g mmt-testlight` |
| **Homebrew** | `brew install mshobeyri/multimeter/mmt-testlight` |
| **Binaries** | [GitHub Releases](https://github.com/mshobeyri/multimeter/releases) |
| **VS Code** | [Marketplace](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter) |

## Links

- [Documentation](https://mmt.dev)
- [GitHub](https://github.com/mshobeyri/multimeter)
- [npm](https://www.npmjs.com/package/mmt-testlight)
