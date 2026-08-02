# Run a suite

Use `type: suite` to group tests (and other suites) into a runnable tree. Run the whole suite or a single node from the Suite view.

## Minimal example

```yaml
type: suite
title: Smoke
items:
  - test: ./tests/echo_test.mmt
  - test: ./tests/get_json_test.mmt
```

Open the suite file and click **Run Suite**, or run with the CLI:

```sh
npx mmt-testlight run suite.mmt
```

## Tips

- Nest suites for smoke vs regression.
- Use groups when children should run in parallel (same idea as `then` stages in tests).
- Target a subtree from the Suite UI when debugging one area.

## Learn more

- [Suite files](../files/suite.md)
- Example: [Basic Suite](/docs/examples/basic/04_basic_suite)
