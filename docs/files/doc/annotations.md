# Parameter annotations in API descriptions

API `description` fields support annotations that document input and output parameters. Full details live under [API → Documentation](../api/documentation.md).

Syntax:
- `<<i:param_name>> description text` — input parameter
- `<<o:param_name>> description text` — output parameter

Optional leading `[...]` on an input annotation documents allowed values and enables a picker on the API **In / Out** tab:

- `[a, b, c]` — discrete options
- `[1-5]` — integer range, inclusive

Example: `<<i:role>> [admin, editor, viewer] User role`

```yaml
type: api
title: Create user
description: |-
  Create a new user account.

  <<i:username>> The desired username (3-20 characters)
  <<i:email>> User email address
  <<i:role>> [admin, editor, viewer] User role

  <<o:id>> The generated user ID
  <<o:created_at>> ISO 8601 timestamp of account creation
inputs:
  username: demo
  email: demo@example.com
  role: viewer
method: post
url: https://test.mmt.dev/post
```

In the editor, open **In / Out** to see descriptions and range pickers, and **Doc** to preview the documented parameters. Generated HTML/Markdown docs show each annotation as a parameter table row.

Wire the same names under `inputs` / `outputs` — see [Inputs](../api/inputs.md) and [Outputs](../api/outputs.md).
