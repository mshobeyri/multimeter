<br />
<div align="center">
  <a href="https://mmt.dev">
    <img src="res/logo.png" alt="Logo" width="120" height="115">
  </a>
  <p align="center">
    <h4>A Git-native system for defining, running, and versioning API test workflows.</h4>
      <a href="https://mmt.dev/demos"><img src="res/demo.png" alt="Demo" width="16" height="16" style="vertical-align: text-bottom;"/> View Demo</a>
    &middot;
      <a href="https://mmt.dev"><img src="res/website.png" alt="mmt.dev" width="16" height="16" style="vertical-align: text-bottom;"/> Website</a>  
    &middot;
      <a href="https://github.com/mshobeyri/multimeter/issues/new?labels=enhancement&template=feature-request---.md"><img src="res/request_feature.png" alt="Request Feature" width="16" height="16" style="vertical-align: text-bottom;"/> Request Feature</a>
  </p>
</div>


## 🚨 Problem

API testing is fragmented across multiple tools:

- UI tools (like Postman) for manual testing
- Scripts for automation
- CI pipelines for regression testing
- Separate formats for reporting and sharing

This leads to:
- duplicated test logic
- hidden test state
- inconsistent workflows
- poor reproducibility across environments

---

## 💡 Idea

API testing should not be split across tools.

It should be a single Git-native workflow where:
- tests are stored as simple files
- execution is deterministic and reproducible
- results are versioned in Git
- the same workflow runs in UI, CLI, and CI

---

## ⚙️ What Multimeter Is

Multimeter is a unified test workflow system that executes and synchronizes tests across UI, CLI, and CI using a single source-of-truth model.

---

## 🥂 Code + UI  System

Multimeter provides a real-time bi-directional system between YAML and UI.

- Editing YAML updates the UI instantly
- Editing UI updates YAML instantly
- Both represent the same underlying test state

There is no separation between “code” and “UI” — both are views of the same system.

---

## ✨ Features

- 📁 Git-native test definitions
- 🔁 Real-time YAML ↔ UI synchronization
- 🧪 Smoke and regression testing support
- ⚙️ CLI engine for automation and CI
- 🚀 CI/CD pipeline integration
- 🧾 Versioned test results in Git
- 📊 Multi-format reporting (HTML, JSON, JUnit, Markdown)
- 🧩 VS Code extension for visual workflows
- 🌐 HTTP API testing support

[Browse more features](https://mmt.dev/#features)

---

## 🤖 AI-Friendly Design

All tests are stored as structured YAML files in Git:

- Easy to read and modify for AI systems
- Can be generated or updated automatically
- Fully version-controlled and reproducible

This makes Multimeter naturally compatible with AI-assisted testing workflows.

---
## 📦 Examples

### API Definition

```yaml
type: api
url: https://test.mmt.dev/echo
method: post
body: |-
  {
    "name": "Multimeter",
    "message": "Hello from mmt!"
  }
```

### Test Flow
```yaml
type: test
steps:
  - http: https://test.mmt.dev/echo
    method: post
    body: |-
      {
        "message": "Hi mmt!"
      }
    expect:
      body.body.message: hi mmt
```

[Browse more examples](./examples)

---


## 🎬 Demo

<img src="res/api.gif" alt="Multimeter sample post" style="max-width: 100%; height: auto;" />
</br>
</br>

[Browse more demos](https://mmt.dev/demos)
[Browse documents](./docs/toc.md)