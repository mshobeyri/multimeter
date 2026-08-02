# Documentation

These fields make APIs searchable and auto-documentable:

- `title` — display name
- `tags` — labels for filtering
- `description` — Markdown explanation of the API (`**bold**`, *italic*, `` `code` ``, lists, headings, tables). Use `|-` for multiline text.

## Parameter annotations

Inside `description`, document inputs and outputs with annotations (not plain Markdown bullets alone):

- `<<i:param_name>> description text` — input parameter
- `<<o:param_name>> description text` — output parameter

Optional leading `[...]` on an **input** annotation documents allowed values (ranges / enums) and enables a picker in the API **In / Out** tab:

- `[a, b, c]` — discrete options (comma-separated; double-quoted tokens allowed)
- `[1-5]` — integer range, inclusive (picker hidden if more than 10 values)
- `["1", "2"]` keeps numeric-looking values as strings; `[1, 2]` stores them as numbers

Example: `<<i:role>> [admin, editor, viewer] User role`

```yaml
type: api
title: generate session
description: |-
  Create a session from username and password.

  <<i:username>> Account username
  <<i:password>> Account password
  <<i:role>> [admin, editor, viewer] Optional role for the session

  <<o:token>> JWT session token
  <<o:expires_in>> Token TTL in seconds
tags:
  - smoke
  - authentication
inputs:
  username: demo
  password: secret
  role: viewer
outputs:
  token: body.token
  expires_in: body.expires_in
url: https://test.mmt.dev/post
method: post
format: json
body:
  username: i:username
  password: i:password
  role: i:role
```

After you save this:

- Open the **In / Out** tab to see input descriptions and range pickers next to the input fields
- Open the **Doc** tab to preview the documented parameters (same annotations feed generated HTML/Markdown docs)

Declare the matching keys under `inputs` / `outputs` and wire them in the request — see [Inputs](./inputs.md) and [Outputs](./outputs.md).

## File references in descriptions

A description is treated as a file reference when it is a single token (no spaces), on one line, and contains `.md#`. The path is relative to the current `.mmt` file.

```yaml
description: README.md#-why-multimeter
```

- In the **editor**, Ctrl+click (Cmd+click on macOS) opens the file
- In the **Doc** tab preview, the link is clickable
- In generated HTML/Markdown docs, it renders as a link
