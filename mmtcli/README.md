# Multimeter CLI (mmtcli)

CLI runner for Multimeter test files.

## Usage

```
npx multimeter run sample.yaml
multimeter run test.mmt.yaml -o result.json
```

Commands:
- `multimeter run <file>`
- `multimeter version-info`

## Build

```
npm install
npm run build
```

## Bundle single-file binary (pkg)

```
npm run pkg
```

Integrate deeper execution by wiring real core runtime logic in `runTestObject`.

## Standalone binary for CI/CD

The `pkg` step builds self-contained binaries (macOS/Linux/Windows) under `dist/bin`.

- No Node.js is required on the machine running the binary.
- Core runtime (`mmt-core`) and HTTP client (`axios`) are bundled.

Examples:

```
# macOS
./dist/bin/cli-macos version-info
./dist/bin/cli-macos to-js ../examples/test/login_and_get_user_info.mmt
./dist/bin/cli-macos run ../examples/test/login_and_get_user_info.mmt --quiet

# Linux
./dist/bin/cli-linux run path/to/test.mmt --quiet
```

Tip: Upload the platform binary to your artifact store and invoke it in pipelines.
