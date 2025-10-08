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
