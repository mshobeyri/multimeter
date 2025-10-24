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
./dist/bin/testlight-macos version-info
./dist/bin/testlight-macos to-js ../examples/test/login_and_get_user_info.mmt
./dist/bin/testlight-macos run ../examples/test/login_and_get_user_info.mmt --quiet

# Linux
./dist/bin/testlight-linux run path/to/test.mmt --quiet
```

Tip: Upload the platform binary to your artifact store and invoke it in pipelines.
