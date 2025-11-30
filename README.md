<br />
<div align="center">
  <a href="https://github.com/othneildrew/Best-README-Template">
    <img src="res/icon.png" alt="Logo" width="120" height="115">
  </a>


  <p align="center">
    <h4>All possible tests for your service as code!</h4>
    <br />
    <a href="#-documentation"><strong>Explore the docs »</strong></a>
    <br />
    <br />
      <a href="docs/demos.md"><img src="res/demo.png" alt="Demo" width="16" height="16" style="vertical-align: text-bottom;"/> View Demo</a>
    &middot;
      <a href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter"><img src="res/vscode.png" alt="VS Code" width="16" height="16" style="vertical-align: text-bottom;"/> Try on VSCode</a>
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
Here is a how you can run the test in VSCode <a href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter">Click & try!</a> ;
</br></br>
<img src="demos/api.gif" alt="Multimeter sample post" style="max-width: 100%; height: auto;" />
</br></br>

## ⭐ Why Multimeter?

- 💰 **The extention is free and remains free** — no paywalls, no limitation.
- 👤 **Zero setup friction.** No login or account needed — your Git repo controls access.  
- 🦾 **Generate tests automatically.** Ask AI to build tests, refine your code, deploy and run until everything passes.  
- 🌈 **One tool instead of many.** Replace Postman, JMeter, NeoLoad, Robot Framework etc. — no juggling of tools.  
- 🪞 **Instant mock servers.** Built-in HTTP / WebSocket mock server lets you simulate responses quickly (ideal for edge-cases).  
- 🔄 **Seamless migration support.** Already have Postman collections or OpenAPI specs? Convert them to Multimeter tests without rewriting.  
- 📄 **Auto-generated API docs.** Produce clean HTML or Markdown API docs from your tests — always up to date.  
- 🪢 **Reusable & modular tests.** Write once — reuse elsewhere with different inputs, like calling a function.  
- 📦 **Versioned tests alongside code.** Tests live in the same repo and can be updated in the same pull request — you retain ability to test older versions.  
- 🖌️ **Easy bulk edits.** Want to update many tests at once? Use VS Code’s “Replace All” instead of manual edits.  
- ⏳ **Full test history.** Store test results in your repo so you always have access to past runs.  
- 👮‍♂️ **Your data stays yours — secure & private.** Sensitive info stays in your repo; nothing is uploaded externally.  
- 🎛️ **No coding skills needed.** Modern graphical UI lets even non-coders create and run tests.  
- ⛓️ **CI/CD ready.** Integrate with your pipeline via `testlight` to automatically run tests before merging — ensuring quality before merge.  

## 🚀 Demo

 - 🧩 UI editor ( No code mode ) along with text editor. <a href="docs/demos.md#ui-overview"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>

- 🤖 Generate tests using AI (Multimeter assistant). <a href="docs/demos.md#ai-test-generation"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🧱 JSON/XML schema-aware formating and editing. <a href="docs/demos.md#xml-handling"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🔗 Chaining request responses. <a href="docs/demos.md#output-extraction"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🗄 Environment variable and presets support. <a href="docs/demos.md#environment-variables"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - ⛏️ Extract data from results using xpath, jsonpath and regular expression. <a href="docs/demos.md#output-extraction"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🌐 REST, WEBSOCKET, SOAP protocols support. <a href="docs/demos.md#websocket-testing"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🔄 Support Postman and OpenAPI collection convert. <a href="docs/demos.md#postman-import"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🪞 Server mocking. <a href="docs/demos.md#mock-server"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 📃 Auto documentation: generate HTML and MD docs from API. <a href="docs/demos.md#documentation-generation"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>

- 🏋 Load testing (soon).
 - ▶️ And more...  <a href="docs/demos.md" > ▸ Explore all demos!</a>


## 🔎 Tool Comparison  

| Feature / Capability | **Multimeter** | Postman | JMeter | SoapUI|
|----------------------|:-------------:|:------:|:--------:|:-------:|
| HTTP API (REST/SOAP/HTTP) testing | ✔ | ✔ | ✔ | ✔ |
| WebSocket / real‑time API support | ✔ | ✔ | ✖ | ✖ |
| Tests stored as versionable, text‑based files (YAML/code) | ✔ | ✖ | ⚠ | ⚠ |
| Built‑in mock server (HTTP/WS) for testing & simulation | ✔ | ✔ | ✖ | ✔ |
| Modular & reusable test definitions (parameterized / composable) | ✔ | ✖ | ⚠ | ⚠ |
| Auto‑generate API documentation from tests | ✔ | ✖ | ✖ | ✖ |
| Lightweight & simple for small-to-medium projects | ✔ | ✔ | ⚠ | ⚠ |
| AI‑powered test generation / assistant built‑in | ✔ | ⚠ | ✖ | ✖ |
| No‑code / low‑code support  | ✔ | ✔ | ✖ | ✔ |
| No GUI / full code support  | ✔ | ✖ | ✖ | ✖ |

✔ supported / natural fit 
✖ = not supported / missing
⚠ = partial or caveat / less ideal  


## 🛠️ Usage
- Add <img src="res/icon.png" alt="Multimeter Logo" width="16" height="16"/>[Multimeter](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter) extension to your vscode.
- Create a .mmt file in your project (e.g., login.mmt).
- Use UI or write YAML file represent your test.
- Click Run!


## 📚 Documentation
- [MMT Overview](docs/mmt-overview.md)
  - [API](docs/api-mmt.md)
  - [Test](docs/test-mmt.md)
  - [Environment](docs/environment-mmt.md)
  - [Doc](docs/doc-mmt.md)
- [Testlight (CLI)](docs/testlight.md)
- [Convertor](docs/convertor.md)
- [Mock Server](docs/mock-server.md)
- [History](docs/history.md)
- [Test Generation Profile(cheat sheet)](docs/testgen-profile.md)
- [Test Generation Profile(AI optimized)](docs/testgen-profile-ai.md)

---
**Special thanks to: Dear Ashkan Palganeh.**
