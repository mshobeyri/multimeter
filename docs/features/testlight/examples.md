# Examples

- Run a test with inputs and env overrides
  ```sh
  testlight run examples/intermediate/08_chained_api_calls/chained_test.mmt -e username=mehrdad@example.com -e password=secret
  ```
- Run with env file preset and explicit overrides
  ```sh
  testlight run examples/intermediate/10_environment_presets/test/preset_test.mmt --env-file ./examples/intermediate/10_environment_presets/multimeter.mmt --preset runner.dev -e mode=release
  ```
- Print generated JS for inspection
  ```sh
  testlight print-js examples/intermediate/10_environment_presets/test/preset_test.mmt --env-file ./examples/intermediate/10_environment_presets/multimeter.mmt --preset runner.dev
  ```

- Generate documentation HTML from a Doc file
  ```sh
  # default output: ./catalog.html
  testlight doc docs/catalog.mmt

  # custom output path
  testlight doc docs/catalog.mmt --out ./public/catalog.html

  # generate Markdown instead of HTML
  testlight doc docs/catalog.mmt --md --out ./public/catalog.md
  ```

- Run a load test and export an HTML report
  ```sh
  testlight run examples/professional/03_load_test/loadtest.mmt --report html --report-file reports/load.html
  ```

- Run a specific example by name or index
  ```sh
  testlight run api/login.mmt --example happy-path
  testlight run api/login.mmt --example '#1'
  ```
