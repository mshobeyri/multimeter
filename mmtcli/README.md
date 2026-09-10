# Multimeter CLI (mmtcli)

**testlight** runs Multimeter YAML `.mmt` tests in CI and locally. npm package: `mmt-testlight`.

Multimeter is an AI-powered REST Client and API testing tool for VS Code and CI. It is not an electrical multimeter. Git-native alternative to Postman. Docs: https://mmt.dev

## Usage

```
npx testlight run sample.yaml
testlight run test.mmt.yaml -o result.json
```

Commands:
- `testlight run <file>`
- `testlight print-js <file>`
- `testlight docs [topic]`
- `testlight scaffold test --from <api.mmt>`
- `testlight validate <file>`
- `testlight suggest asserts --from <api.mmt>`
- `testlight doc <file>`
- `testlight version-info`
- `testlight update`

npm (`mmt-testlight`) and GitHub/Homebrew standalone binaries use the same CLI.

## Build

```
npm install
npm run build
```

## Bundle standalone binaries (pkg)

Uses `@yao-pkg/pkg` in SEA mode (Node 22, Brotli-compressed archive). Requires Node ≥ 22 on the machine that builds binaries.

```
npm run pkg
```

Builds self-contained binaries (no Node.js required on the runner) into
platform folders under the repo `bin/` directory:

```
bin/
  macos-arm64/testlight   (+ mmt → testlight)
  macos-x64/testlight
  linux-x64/testlight
  linux-arm64/testlight
  win-x64/testlight.exe   (+ mmt.cmd shim)
```

Examples:

```
# macOS (Apple Silicon)
./bin/macos-arm64/testlight --version
./bin/macos-arm64/testlight run ../examples/basic/02_simple_test/echo_test.mmt --quiet

# Linux
./bin/linux-x64/testlight run path/to/test.mmt --quiet

# Windows
bin\win-x64\testlight.exe run path\to\test.mmt --quiet
bin\win-x64\mmt.cmd run path\to\test.mmt --quiet
```

Tip: Upload the matching platform folder (or the GitHub Release archive) to your
artifact store and invoke it in pipelines.
