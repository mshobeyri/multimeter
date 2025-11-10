<br />
<div align="center">
  <a href="https://github.com/othneildrew/Best-README-Template">
    <img src="res/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">Mutlimeter</h3>

  <p align="center">
    All possible tests for your service as code!
    <br />
    <a href="#-documentation"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="docs/demos.md">View Demo</a>
    &middot;
    <a href="https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter">Try on VSCode</a>
    &middot;
    <a href="https://github.com/mshobeyri/multimeter/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
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

- 🧩 UI editor ( No code mode ) along with text editor.

- 💾 Store test cases as files in your application git repo.
  - ⏳ Preserve tests' history in the git repo.
  - 🤖 Ability to generate tests using AI.
  - 📦 Having tests along with the changes in a same pull request.
  - 🔑 Access control can be handled by git.
- 🧱 JSON/XML schema-aware editing.
- 🔗 Chaining request responses.
- ⛓️ Running tests in the pipeline using testlight.
- 🗄 Environment variable and presets support.
- ⛏️ Extract data from results using xpath, jsonpath and regular expression.
- 🌐 HTTP/WS protocols support.
- 🔄 Support Postman and OpenAPI collection convert.
- 🧪 Supports all kinds of test logic, from simple checks to complex flows.
- 🪞 Server mocking.
- 📃 Auto documentation: generate HTML and MD docs from API.

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

---
**Special thanks to: Dear Ashkan Palganeh.**
