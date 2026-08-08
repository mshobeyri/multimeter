# Multimeter CLI (mmtcli)

CLI runner for Multimeter test files.

## Usage

```
npx testlight run sample.yaml
testlight run test.mmt.yaml -o result.json
```

Commands:
- `testlight run <file>`
- `testlight version-info`

## Build

```
npm install
npm run build
```

## Bundle standalone binaries (pkg)

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
