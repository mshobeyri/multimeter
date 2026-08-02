# CI/CD Integration

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

---
