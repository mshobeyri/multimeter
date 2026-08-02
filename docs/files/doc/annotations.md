# Parameter annotations in API descriptions

API `description` fields support special annotations that document input and output parameters. These annotations are parsed and displayed as parameter description columns in both HTML and Markdown output.

Syntax:
- `<<i:param_name>> description text` — documents an input parameter
- `<<o:param_name>> description text` — documents an output parameter

Optional leading `[...]` on an input annotation documents allowed values and enables a picker in the API/test **In / Out** tab (inputs only). The bracket text is shown verbatim in generated docs.

- `[a, b, c]` — discrete options (comma-separated; double-quoted tokens allowed)
- `[1-5]` — integer range, inclusive (picker hidden if more than 10 values)
- `["1", "2"]` keeps numeric-looking values as strings; `[1, 2]` stores them as numbers

Example: `<<i:role>> [admin, editor, viewer] User role`

Example API file:
```yaml
type: api
title: Create user
description: |-
  Create a new user account.

  <<i:username>> The desired username (3-20 characters)
  <<i:email>> User email address
  <<i:role>> User role: admin, editor, or viewer

  <<o:id>> The generated user ID
  <<o:created_at>> ISO 8601 timestamp of account creation
inputs:
  username: string
  email: string
  role: viewer
method: post
url: <<e:api_url>>/users
```

In the rendered doc, each `<<i:...>>` and `<<o:...>>` annotation appears as a row in the parameter table for that API.

---
