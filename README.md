# <img src="res/icon.png" alt="Multimeter Logo" width="40" height="40"/> Multimeter

**Multimeter** is a powerful Visual Studio Code extension designed to write, run, and manage structured tests using `.mmt` files. It supports a wide range of test types — including API, integration, functional, and custom tests — all stored directly in your application's repository as version-controlled files.

## 🚀 Features

- 🧩 UI editor along with text editor.
- 🧪 Supports all kinds of test logic, from simple checks to complex flows.
- 💾 Store test cases as files in your application git repo.
  - ⏳ Preserve tests' history in the git repo.
  - 🤖 Ability to generate tests using AI.
  - 📦 Having tests along with the changes in a same pull request.
- 🧱 JSON/XML schema-aware editing.
- 🌐 HTTP/WS protocols support.
- 🧑‍🚀 Support Postman collection.
- 🪞 Server mocking.

## 🛠️ Usage
- Add [multimeter](https://marketplace.visualstudio.com/items?itemName=mshobeyri.multimeter) extention to your vscode.
- Create a .mmt file in your project (e.g., login.mmt).
- Follow the UI instructions 👌.

## ✍️ Example

```yaml
type: api
title: generate session
tags:
  - smoke
  - authentication
description: returns session information.
inputs:
  - username: string
  - password: string
  - traceId: string
outputs:
  - session: string
  - errorcode: number
interfaces:
  - name: http-json
    protocol: http
    format: json
    method: POST
    url: https://httpbin.org/s
    headers:
      traceId: i:traceId
      content-type: application/json
    body:
      username: i:username
      password: i:password
examples:
  - name: simple login
    description: simple login with a sample user
    inputs:
      - username: mehrdad
      - password: 123456

```
**Special thanks to: Od. Ashkan Palganeh 👨🏻‍🦱♥️.**