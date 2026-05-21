
## 📚 TABLE OF CONTENT


#### [MMT Overview](docs/mmt-overview.md)

**MMT File Types** — YAML files you create and version-control:
- [API (`type: api`)](docs/api-mmt.md) — define HTTP/WebSocket requests
- [Test (`type: test`)](docs/test-mmt.md) — orchestrate flows with steps, assertions, and loops
- [Environment (`type: env`)](docs/environment-mmt.md) — variables, presets, and certificates
- [Doc (`type: doc`)](docs/doc-mmt.md) — generate API documentation from your `.mmt` files
- [Suite (`type: suite`)](docs/suite-mmt.md) — group and run tests, APIs, or other suites
- [Load Test (`type: loadtest`)](docs/loadtest-mmt.md) — run one test scenario with concurrency, ramp-up, and load reports (beta)
- [Mock Server (`type: server`)](docs/mock-server.md#mmt-mock-server-files) — define mock endpoints with routing, matching, and dynamic responses
- [Report (`type: report`)](docs/reports.md#mmt-report-yaml) — structured test results viewable in the editor

**Other supports**
- [HTTP files (`.http`, `.https`)](docs/http-files.md) — run REST Client / JetBrains-style HTTP files as test flows via Open With
- [Bruno files (`.bru`)](docs/bruno-files.md) — run Bruno request files as test flows via Open With

**VS Code Panels & Features:**
- [Mock Server Panel](docs/mock-server.md) — start HTTP/HTTPS/WS mock servers from the UI
- [Convertor](docs/convertor.md) — import OpenAPI and Postman collections into `.mmt`
- [History](docs/history.md) — inspect recent requests and responses
- [Certificates](docs/certificates-mmt.md) — SSL/TLS, mTLS, and CA certificate configuration

**Running & CI/CD:**
- [Testlight CLI](docs/testlight.md) — run tests, suites, and generate docs from the command line
- [Reports](docs/reports.md) — JUnit XML, HTML, Markdown, and MMT YAML test reports
- [Load Test](docs/loadtest-mmt.md) — beta load tests and load-oriented report exports
- [Logging](docs/logging.md) — log levels and where logs appear

**Guides & Reference:**
- [Sample Project](docs/sample-project.md) — full walkthrough with APIs, tests, suites, docs, and CLI
- [Test Generation Profile (cheat sheet)](docs/testgen-profile.md) — AI/tool guidance for generating `.mmt` files
- [Demos](docs/demos.md) — animated feature demos
