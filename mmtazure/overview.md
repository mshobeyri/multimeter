# Testlight

Run Multimeter (`.mmt`) files in Azure Pipelines. Same inputs as the GitHub Action, as YAML `inputs:` — the task does not check out git and does not start your app.

Install this extension on the Azure DevOps org, then:

```yaml
steps:
  - checkout: self
  - task: Testlight@1
    inputs:
      file: tests/suite.mmt
      report: junit
      reportFile: results/junit.xml
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: JUnit
      testResultsFiles: results/junit.xml
```

`checkout: self` stays a pipeline step (Azure already does it by default). Testlight only runs the `.mmt` path you pass.
