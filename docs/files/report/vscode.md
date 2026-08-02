# VS Code extension

### Export Report button

After running a test, suite, or load test in the VS Code extension, an **Export** button appears when a run result is available. Click it to choose a format:

- **JUnit XML** — for CI/CD integration
- **MMT Report** — for the `.mmt` ecosystem
- **HTML** — for sharing with stakeholders
- **Markdown** — for PRs and documentation

### Report viewer

Opening an `.mmt` file with `type: report` in VS Code renders a read-only visual panel showing:

- Overview header with pass/fail counts and duration
- Functional report rows for tests and suites
- Suite rows with the same layers icon used by suite files
- Collapsible test sections with individual check results
- Failure details (expected, actual, operator)
- Load report metrics and charts

The viewer includes an Export button to re-export the report to any format.
