# Test strategy

Provide three suites:
- smoke (required): at least one per endpoint; prefer examples
- negative: one per endpoint when feasible; users can pass invalid inputs manually
- boundary: one per endpoint when feasible

Timeouts: connect 5s, read 10s. Retries: off by default.

Performance testing: Not yet supported; working on it. For now, use `check` steps in tests for response validation (see docs/files/test/index.md).
