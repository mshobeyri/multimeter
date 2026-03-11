# API Inputs & Outputs

This example shows how to use **inputs** and **outputs** in `.mmt` API files. Inputs let you parameterize requests so callers can supply different values. Outputs extract fields from the response for use in test flows.

## Files

| File | Description |
|---|---|
| `get_with_outputs.mmt` | GET request that extracts `name`, `item_count`, and `first_tag` from the response |
| `post_with_inputs_outputs.mmt` | POST request with `username` and `role` inputs, plus outputs that extract the echoed values |

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
- **`outputs`** — extract fields from the response using bracket paths like `body[field]`, `headers[name]`, or `cookies[name]`.
- Outputs can be chained into subsequent steps in a test flow using `${step_id.output_name}`.

See [API docs](../../docs/api-mmt.md#inputs) and [API docs — outputs](../../docs/api-mmt.md#outputs) for full details.
