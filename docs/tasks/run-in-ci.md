# Run in CI

The same `.mmt` files you edit in VS Code run in CI with the Multimeter CLI called `testlight`.

Install the npm package, then run the suite:

```sh
npm install -g mmt-testlight
testlight run tests/smoke.mmt --env-file ci.env --report junit --report-file results/junit.xml
```

Or without a global install:

```sh
npx mmt-testlight run suite.mmt --preset ci
```

Ready-to-copy GitHub, GitLab, and Azure files: [CI pipelines example](../../examples/professional/09_ci_pipelines/README.md).

## GitHub Actions

```yaml
- uses: actions/checkout@v6
- uses: mshobeyri/testlight-action@v1
  with:
    file: tests/suite.mmt
    env-file: tests/env.mmt
    report: junit
    report-file: results/junit.xml
```

See the [action README](https://github.com/mshobeyri/testlight-action).

## GitLab CI

```yaml
image: node:20
test:
  script:
    - npm install -g mmt-testlight
    - mkdir -p results
    - testlight run suite.mmt --report junit --report-file results/junit.xml
  artifacts:
    when: always
    reports:
      junit: results/junit.xml
```

## Azure Pipelines

Same parameters as GitHub `with:`, as YAML `inputs:`. Checkout stays a pipeline step. The task does not fetch git or start your app.

```yaml
steps:
  - checkout: self
  - task: Testlight@1
    inputs:
      file: suite.mmt
      envFile: tests/env.mmt
      preset: ci
      report: junit
      reportFile: results/junit.xml
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: results/junit.xml
```

Install the Testlight Azure Pipelines extension on the org first (source: `mmtazure/` in this repo). Until then, the same CLI still works as a `script` step.

## Typical flags

| Flag | Purpose |
|---|---|
| `--env-file` | Load environment variables from a file |
| `--preset` | Select a named preset from your env file |
| `-e key=VALUE` | Override a single variable |
| `--report junit` | Emit a JUnit XML report |
| `--report-file` | Write the report to a path (parent folders are created) |

See [Install](../install.md) and [Downloads](/downloads) for platform packages (Homebrew, apt, Docker, …).

## Tips

- Fail the job when the CLI exits non-zero.
- Keep secrets in the CI secret store; inject with `-e` or an env file that is not committed.
- Prefer running a suite so one command covers smoke or regression.

## Learn more

- [CI pipelines example](../../examples/professional/09_ci_pipelines/README.md)
- [Testlight](../features/testlight/index.md) — install, commands, options, and CI examples
- [Install](../install.md)
- [Examples](/docs/examples)
