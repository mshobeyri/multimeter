# JUnit XML

JUnit XML is the universal CI/CD format. Azure Pipelines, GitHub Actions, GitLab CI, Jenkins, and many other systems can publish it directly.

**Default filename:** `test-results.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="suite.mmt" tests="4" failures="1" errors="0" skipped="0" time="1.234">
  <testsuite name="test-file.mmt" tests="2" failures="1" errors="0" skipped="0" time="0.500" file="test-file.mmt">
    <testcase name="status == 200" classname="test-file.mmt" time="0.100"/>
    <testcase name="result.name == John" classname="test-file.mmt" time="0.050">
      <failure message="expected: John, actual: Jane, operator: ==" type="check">expected: John
actual: Jane
operator: ==</failure>
    </testcase>
  </testsuite>
</testsuites>
```

For load tests, JUnit XML keeps normal `<testsuites>` compatibility and adds load metrics as `<property>` values, for example `load.threads`, `load.throughput`, `load.latency.p95`, `load.error_rate`, and `load.snapshots.0.at`.
