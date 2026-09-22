# Suite memory stress

Large nested suite for testing suite panel performance, report spill to IndexedDB, and lazy report reload on expand.

## Layout

- **Stage 1** (parallel): `branches/alpha` and `branches/beta` — 6 tests each
- **Stage 2** (parallel): `branches/gamma` — two nested suites (`shallow/` and `deep/`)
- **Stage 3**: `leaf/` — 8 tests

Each test hits `https://test.mmt.dev/json` many times with long step titles so suite run reports grow quickly (~35 tests, ~80+ steps per test).

## Run

Open `suite.mmt` in VS Code and click **Run suite**.

CLI:

```bash
npx testlight run examples/intermediate/30_suite_memory_stress/suite.mmt
```

## Force report spill (optional)

Default in-memory budget is 2 MB (`multimeter.suite.reportSpillBytes`). To see spill sooner during UI testing, lower it in VS Code settings, e.g. `50000` (50 KB). Set to `0` to disable spill.

When over the threshold, step details move to internal browser storage and load when you expand a test row in the suite tree. Overview counts stay correct; export materializes spilled data automatically.

## Regenerate

```bash
node generate-stress-files.mjs
```
