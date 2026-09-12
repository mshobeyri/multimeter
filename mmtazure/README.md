# Testlight Azure Pipelines task

GitHub Action `with:` becomes Azure `inputs:`. Checkout is not part of the task.

```yaml
- task: Testlight@1
  inputs:
    file: tests/suite.mmt
    envFile: tests/env.mmt
    preset: ci
    report: junit
    reportFile: results/junit.xml
```

Pack (from this folder):

```sh
npx --yes tfx-cli extension create --manifest-globs vss-extension.json
```

Upload the `.vsix` to the Azure DevOps org (Extensions) or the Visual Studio Marketplace (`Azure Pipelines` category). YAML `- task: Testlight@1` works after the org has the extension.
