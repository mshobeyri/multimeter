# Input and output documentation

Document parameters in the `description:` of an **API** or **test** file with annotations. The same syntax feeds generated HTML/Markdown docs, the editor **Doc** preview, and the ⋯ options menu on input fields.

Declare matching keys under `inputs:` / `outputs:` and wire them in the request or flow — see [API Inputs](./api/inputs.md), [API Outputs](./api/outputs.md), and [Test overview](./test/index.md#input-and-output-documentation).

## Annotation syntax

Inside `description` (use `|-` for multiline Markdown):

| Annotation | Meaning |
|---|---|
| `<<i:param_name>> description text` | Input parameter |
| `<<o:param_name>> description text` | Output parameter |

Put one annotation per line (or separate them clearly). Plain Markdown bullets alone are not enough for the Doc tables or the input picker.

```yaml
description: |-
  Create a session from username and password.

  <<i:username>> Required account username
  <<i:password>> Required account password
  <<i:role>> [admin, editor, viewer] Optional role for the session
  <<i:page>> [1-5] Page number

  <<o:token>> JWT session token
  <<o:expires_in>> Token TTL in seconds
```

## Allowed values and ranges

Optional leading `[...]` on an **input** annotation documents the allowed set for that field:

| Form | Meaning |
|---|---|
| `[a, b, c]` | Discrete options (comma-separated; double-quoted tokens allowed) |
| `[1-5]` | Integer range, inclusive |
| `["1", "2"]` | Numeric-looking values kept as strings |
| `[1, 2]` | Stored as numbers |

Example: `<<i:role>> [admin, editor, viewer] User role`

Rules:

- The bracket block must be the **first** thing after `<<i:name>>` (then the human description).
- At most **10** options (including expanded ranges). Larger ranges still document the intent in text, but the UI picker is hidden.
- There is no separate “required” marker in YAML — write **Required** / **Optional** in the description text when you want that shown in docs (as in the example above).
- Outputs (`<<o:…>>`) are documented the same way; they do **not** take `[...]` pickers.

## Effects in the product

| Surface | What happens |
|---|---|
| **Generated docs** (`type: doc`, HTML/Markdown export) | Each `<<i:>>` / `<<o:>>` becomes a parameter table row (name + description, including any `[...]` text) |
| **API Doc tab** | Same parameter tables in the tester preview |
| **API Inputs tab** | Declared `inputs:` fields whose annotations include `[...]` show a ⋯ menu to pick an allowed value |
| **Test runner Inputs** | Same ⋯ picker when the test `description` annotates inputs with `[...]` |

The picker only appears when:

1. The key is declared under `inputs:`, and  
2. `description` has a matching `<<i:name>> [...]` annotation with a valid option list / small range.

## Full example (API)

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

## Full example (test)

```yaml
type: test
title: Create session
description: |-
  <<i:role>> [admin, editor, viewer] Role for the session
  <<i:page>> [1-5] Page number
inputs:
  role: viewer
  page: 1
steps:
  - http: https://test.mmt.dev/echo
    method: post
    body:
      role: i:role
      page: i:page
```

---

See also: [API → Documentation](./api/documentation.md) · [API → Inputs](./api/inputs.md) · [API → Outputs](./api/outputs.md) · [Doc → Annotations](./doc/annotations.md) · [Test overview](./test/index.md)
