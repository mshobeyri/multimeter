# CI/CD

Generate JUnit XML from the CLI and publish it with your CI system's test-results task.

```sh
npm install -g mmt-testlight
testlight run suite.mmt --report junit --report-file results/junit.xml
```

Copy-paste workflows for GitHub, GitLab, and Azure live in [CI pipelines example](../../../examples/professional/09_ci_pipelines/README.md).

See [CLI](./cli.md) for `--report-file` and other formats.

### GitHub Actions

Use the Multimeter Action, or the same npm install as the other pipelines.

```yaml
- uses: actions/checkout@v4
- uses: mshobeyri/multimeter/.github/actions/testlight@main
  with:
    file: suite.mmt
    report: junit
    report-file: results/junit.xml
```

### GitLab CI

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

### Azure Pipelines

```yaml
steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '20.x'
  - script: |
      npm install -g mmt-testlight
      mkdir -p results
      testlight run suite.mmt --report junit --report-file results/junit.xml
    displayName: Run Multimeter tests
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: results/junit.xml
```

### Jenkins

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

See also: [JUnit](./junit.md) · [Suite exports](../suite/exports.md) · [CI pipelines example](../../../examples/professional/09_ci_pipelines/README.md)
