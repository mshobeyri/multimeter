# CI/CD

Generate JUnit XML from the CLI and publish it with your CI system's test-results task.

```bash
npx testlight run suite.mmt --report junit
```

See [CLI](./cli.md) for `--report-file` and other formats.

### Azure Pipelines

```yaml
steps:
  - script: npx testlight run suite.mmt --report junit
    displayName: Run Multimeter Tests

  - task: PublishTestResults@2
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: test-results.xml
    condition: always()
```

### GitHub Actions

```yaml
steps:
  - name: Run tests
    run: npx testlight run suite.mmt --report junit

  - name: Publish test results
    uses: dorny/test-reporter@v1
    if: always()
    with:
      name: Multimeter Tests
      path: test-results.xml
      reporter: java-junit
```

### GitLab CI

```yaml
test:
  script:
    - npx testlight run suite.mmt --report junit --report-file report.xml
  artifacts:
    reports:
      junit: report.xml
```

### Jenkins

```groovy
pipeline {
    stages {
        stage('Test') {
            steps {
                sh 'npx testlight run suite.mmt --report junit'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }
    }
}
```

See also: [JUnit](./junit.md) · [Suite exports](../suite/exports.md)
