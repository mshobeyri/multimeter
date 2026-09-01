# CI pipelines (GitHub, GitLab, Azure)

The same `.mmt` suite runs in every pipeline. Install the `mmt-testlight` npm package, run `testlight`, and publish the JUnit file.

GitHub has a composite Action that does that install/run for you. GitLab and Azure use the same CLI commands.

## Structure

```
09_ci_pipelines/
├── suite.mmt              # Suite all three pipelines run
├── smoke_get.mmt
├── smoke_post.mmt
├── github-actions.yml     # Copy to .github/workflows/mmt.yml
├── gitlab-ci.yml          # Copy to .gitlab-ci.yml
├── azure-pipelines.yml    # Copy to azure-pipelines.yml
└── README.md
```

## Shared command

```sh
npm install -g mmt-testlight
mkdir -p results
testlight run suite.mmt --report junit --report-file results/junit.xml
```

From this repository:

```sh
npx mmt-testlight run examples/professional/09_ci_pipelines/suite.mmt \
  --report junit --report-file results/junit.xml
```

`results/` is created automatically.

## GitHub Actions

Copy `github-actions.yml` to `.github/workflows/mmt.yml`. It uses the Multimeter Action:

```yaml
- uses: mshobeyri/multimeter/.github/actions/testlight@main
  with:
    file: suite.mmt
    report: junit
    report-file: results/junit.xml
```

If you prefer the npm CLI instead of the Action, use the same `npm install -g` / `testlight run` lines as GitLab and Azure.

## GitLab CI

Copy `gitlab-ci.yml` to `.gitlab-ci.yml`. GitLab publishes `results/junit.xml` as a JUnit report.

## Azure Pipelines

Copy `azure-pipelines.yml` to `azure-pipelines.yml`. Azure publishes the same JUnit file with `PublishTestResults@2`.

## Other pipelines

Any runner with Node.js can use the shared command. Jenkins example:

```groovy
pipeline {
  agent any
  stages {
    stage('Test') {
      steps {
        sh 'npm install -g mmt-testlight'
        sh 'mkdir -p results'
        sh 'testlight run suite.mmt --report junit --report-file results/junit.xml'
      }
    }
  }
  post {
    always {
      junit 'results/junit.xml'
    }
  }
}
```

## Files

| File | Description |
|---|---|
| `suite.mmt` | Two public smoke tests against test.mmt.dev |
| `github-actions.yml` | GitHub Actions workflow |
| `gitlab-ci.yml` | GitLab CI job |
| `azure-pipelines.yml` | Azure Pipelines job |

Change `suite.mmt` in each YAML if the suite is not at the repository root.
