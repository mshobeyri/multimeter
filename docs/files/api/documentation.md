# Documentation

These fields make APIs searchable and auto-documentable:

- `title` — display name
- `tags` — labels for filtering
- `description` — Markdown explanation of the API (`**bold**`, *italic*, `` `code` ``, lists, headings, tables). Use `|-` for multiline text.

## Parameter annotations

Document inputs and outputs inside `description` with `<<i:name>>` / `<<o:name>>`. Optional `[...]` on inputs defines **allowed values** (enums) and **ranges**, which:

- Appear in generated docs and the **Doc** tab
- Enable a ⋯ picker on matching fields in the **Inputs** tab

Full syntax, rules, and examples for API and test files: [Input and output documentation](../input-output-docs.md).

```yaml
type: api
title: generate session
description: |-
  Create a session from username and password.

  <<i:username>> Required account username
  <<i:password>> Required account password
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

- Open the **Inputs** tab — fields with `[...]` annotations show a ⋯ control to pick an allowed value
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
