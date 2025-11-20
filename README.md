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
<a href="docs/demos.md" >
  ▸ See More Demos!
</a>

## 🚀 Features

- 💰 No login needed, all features are available for free.
 - 🧩 UI editor ( No code mode ) along with text editor. <a href="docs/demos.md#ui-overview"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
- 💾 Store test cases as files in your application git repo.
  - 👮🏻‍♂️ Security: sensitive info remains in your hand.
  - ⏳ Preserve tests' history.
  - 🤖 Ability to generate tests using AI. <a href="docs/demos.md#ai-test-generation"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
  - 📦 Having tests along with the changes in a same pull request.
  - 🔑 Access control can be handled by git.
  - 🖌️ Bulk edit using vscode and regex.
 - 🧱 JSON/XML schema-aware formating and editing. <a href="docs/demos.md#xml-handling"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🔗 Chaining request responses. <a href="docs/demos.md#output-extraction"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
- ⛓️ Running tests in the pipeline using testlight.
 - 🗄 Environment variable and presets support. <a href="docs/demos.md#environment-variables"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - ⛏️ Extract data from results using xpath, jsonpath and regular expression. <a href="docs/demos.md#output-extraction"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🌐 REST, WEBSOCKET, SOAP protocols support. <a href="docs/demos.md#websocket-testing"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 🔄 Support Postman and OpenAPI collection convert. <a href="docs/demos.md#postman-import"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
- 🧪 Supports all kinds of test logic, from simple checks to complex flows.
 - 🪞 Server mocking. <a href="docs/demos.md#mock-server"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>
 - 📃 Auto documentation: generate HTML and MD docs from API. <a href="docs/demos.md#documentation-generation"><img src="https://img.shields.io/badge/►-demo-green?style=flat-square" height="14" /></a>

## 🎯 Upcoming Features
- 🏋 Load testing.

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
