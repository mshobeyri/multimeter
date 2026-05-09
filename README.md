<br />
<div align="center">
  <a href="https://mmt.dev">
    <img src="res/logo.png" alt="Logo" width="120" height="115">
  </a>
  <p align="center">
    <h4>Functional, Automation And Performance Testing. All as code...</h4>
    <br />
    <a href="#-documentation"><strong>Explore the docs »</strong></a>
    <br />
    <br />
      <a href="https://www.youtube.com/@mmt_dev"><img src="res/demo.png" alt="Demo" width="16" height="16" style="vertical-align: text-bottom;"/> View Demo</a>
    &middot;
      <a href="https://mmt.dev"><img src="res/website.png" alt="mmt.dev" width="16" height="16" style="vertical-align: text-bottom;"/> Website</a>  
    &middot;
      <a href="https://github.com/mshobeyri/multimeter/issues/new?labels=enhancement&template=feature-request---.md"><img src="res/request_feature.png" alt="Request Feature" width="16" height="16" style="vertical-align: text-bottom;"/> Request Feature</a>
  </p>
</div>

**Multimeter** simplifies the process of writing, running, and managing structured HTTP/WebSocket tests directly within Visual Studio Code. The idea is coming from the Docker world, where the complexity of managing machines is now simple YAML files. Here also, tests will be stored in your application's repository as version-controlled YAML-based files.
## Getting started

```yaml
type: api
protocol: http
url: http://localhost:8080
method: post
format: json
body: 
  username: mehrdad
  password: 123456
```
</br>
Here is a how you can run the test in VSCode;
</br></br>
<img src="res/api.gif" alt="Multimeter sample post" style="max-width: 100%; height: auto;" />
</br></br>

## 🤔 Why Multimeter?

**Free & Open Source** 100% free and open source under BSL license. No subscriptions, no feature gates, no restrictions. 

**Git-Native & YAML**
Tests are plain YAML files versioned in Git alongside your code. PRs, reviews, and diffs work naturally.

**AI Test Generation**
Ask the built-in AI assistant to generate tests from descriptions, OpenAPI specs, or existing APIs.

**Drag & Drop Test Builder**
Build functional test flows visually with calls, asserts, checks, delays, and conditions — no scripting required.

**One Tool Replaces Many**
API testing, beta load testing, mock servers, documentation — one tool instead of Postman, JMeter, and more.

**Secure & Private**
Everything stays local. No cloud sync, no data collection, no external uploads. Your credentials are safe.

**Built-in Mock Server**
Spin up HTTP and WebSocket mock servers instantly. Perfect for frontend development and integration testing.

**CI/CD Ready**
Run the same .mmt files in pipelines with testlight, export reports, and keep automation version-controlled.

**Auto-Generated Docs**
Generate beautiful HTML or Markdown API documentation directly from your .mmt test files.

**Load Testing (Beta)**
Run one .mmt test scenario with threads, ramp-up, repeat limits, and load-oriented reports.

**VS Code Native**
Design, run, debug, and review API tests inside VS Code with native panels and Git-friendly files.

**Import & Convert**
Seamlessly import from Postman collections and OpenAPI specifications. Zero-friction migration.

## 📚 Documentation

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

## 💬 Communcations
- [Contanct](mehrdad.shobeyri@gmail.com)