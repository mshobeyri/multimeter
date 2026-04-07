# API Inputs & Outputs

This example shows how to use **inputs** and **outputs** in `.mmt` API files. Inputs let you parameterize requests so callers can supply different values. Outputs extract fields from the response for use in test flows.

## Files

| File | Description |
|---|---|
| `get_with_outputs.mmt` | Bracket-path extraction — `body[name]`, `body[tags][0]`, `body[tags].length` |
| `get_dot_notation.mmt` | Dot-notation extraction — `body.nested.enabled`, `body.nested.items[0].key` |
| `post_with_inputs_outputs.mmt` | Inputs + bracket-path outputs from the echoed response, including accessor examples like `<<i:username[0]>>` |
| `post_regex_outputs.mmt` | Regex extraction — `body[/"username":"(.*?)"/]` captures from body, `headers[/pattern/]` from headers |

## How to use

### In VS Code

1. Open any `.mmt` file in this folder.
2. Click **Run** — inputs use their default values; outputs appear in the response panel.
3. Change input values in the **Inputs** section of the editor before running.

### With the CLI

```sh
npx testlight run examples/3_api_inputs_outputs/get_with_outputs.mmt
npx testlight run examples/3_api_inputs_outputs/post_with_inputs_outputs.mmt
```

Override inputs from the command line:

```sh
npx testlight run examples/3_api_inputs_outputs/post_with_inputs_outputs.mmt \
  -e username=bob -e role=viewer
```

## Key concepts

- **`inputs`** — declare parameters with default values. Reference them with `i:name` (entire value) or `<<i:name>>` (inline in a string).
- **Accessors on variables** — append `[0]`, `[0:3]`, or `.field` to `i:` / `e:` tokens when you need only part of the value.
- **`outputs`** — three extraction styles:
  - **Bracket path** — `body[nested][items][0][key]` for structured access
  - **Dot notation** — `body.nested.items[0].key` as a shorter alternative
  - **Regex** — `regex "field":"(.*?)"` to capture from raw response text (first capture group wins)
- Outputs can be chained into subsequent steps in a test flow using `${step_id.output_name}`.

See [API docs](../../docs/api-mmt.md#inputs) and [API docs — outputs](../../docs/api-mmt.md#outputs) for full details.
