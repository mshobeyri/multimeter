# 🔌 Multimeter

**Multimeter** is a powerful Visual Studio Code extension designed to write, run, and manage structured tests using `.mmt` files. It supports a wide range of test types — including API, integration, functional, and custom tests — all stored directly in your application's repository as version-controlled files.

## 🚀 Features

- ⚙️ Interactive API test editor with input/output configuration  
- 🧪 Supports all kinds of test logic, from simple checks to complex flows  
- 💾 Store test cases as files in your application repo  
- 🌳 JSON/XML schema-aware editing  
- 🧾 Git-aware result tracking 
- 📦 Supports inputs, headers, query parameters, cookies, and structured outputs  

🛠️ Usage
Create a .mmt file in your project (e.g., login.mmt).
Define your inputs, outputs, and interfaces in YAML format.
Write the test logic using YAML.
Use the sidebar or inline panel to run tests and inspect results.

✍️ Example

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
    endpoint: https://httpbin.org/s
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
Special thanks to: Ashkan palganeh.