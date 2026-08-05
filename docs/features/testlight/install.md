# Install

Use Testlight to run `.mmt` files from a terminal or CI pipeline. Both `testlight` and `mmt` commands are available depending on how you install.

## npm

Global install:

```sh
npm install -g mmt-testlight
```

Or run without a global install:

```sh
npx mmt-testlight run path/to/test.mmt
```

Quick try with the repo examples:

```sh
npx testlight run examples/basic/02_simple_test/echo_test.mmt --quiet
```

## macOS (Homebrew)

```sh
brew tap mshobeyri/multimeter
brew install mmt-testlight
```

## Other platforms

Linux, Windows, and Docker installs are listed on the [Downloads](/downloads) page.

## Standalone binary (CI)

For pipelines, use a self-contained binary built with `pkg` — no Node.js required on the runner.

Build locally from the repo:

```sh
cd mmtcli
npm install
npm run pkg
```

Binaries land under `mmtcli/dist/bin/` (macOS, Linux, Windows). Upload the platform binary to your artifact store and invoke it in CI:

```sh
# macOS
./dist/bin/testlight-macos run path/to/test.mmt --quiet

# Linux
./dist/bin/testlight-linux run path/to/test.mmt --quiet
```

See also: [Commands](./commands.md) · [Examples](./examples.md) · [Run in CI](../../tasks/run-in-ci.md)
