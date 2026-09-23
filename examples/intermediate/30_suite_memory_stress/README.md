# Suite memory stress

Large nested suite for testing suite panel performance, report spill to IndexedDB, and lazy report reload on expand.

## Layout

Root `suite.mmt` wraps several explicit suite-in-suite envelopes (no circular references):

```
suite.mmt
  └── envelopes/layer_1 → layer_2 → layer_3
        └── bundles/core
              ├── bundles/stage_one → branches/alpha + branches/beta (parallel)
              ├── then
              ├── bundles/gamma_wrap → branches/gamma → shallow + deep
              ├── then
              └── envelopes/leaf_wrap → nested/leaf_shell → leaf/
```

Each test hits `https://test.mmt.dev/json` many times. Every HTTP and check step uses `report: all` so suite runs emit full pass reports (not just failures). Long step titles inflate report size (~29 tests, ~80+ step reports per test).

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
