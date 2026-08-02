# Omit Keyword

Intermediate example for the `omit` keyword in API inputs and outputs.

## Files

| File | Description |
|---|---|
| `omit_keyword.mmt` | Remove fields with `omit`, send real `null`, use quoted literals, and inspect echoed outputs |
| `omit_keyword_test.mmt` | Test that verifies omit/null/literal-string behavior via the echo API |

## How to use

### In VS Code

1. Open `omit_keyword.mmt`.
2. Click **Run** and inspect the request body and output values.
3. Change values in the **Inputs** panel:
   - set `middleName` to `omit` to remove it (output shows `omit`)
   - set `middleName` to `Lee` to send a normal string
   - use `"omit"` when you want the literal string

### With the CLI

```sh
npx testlight run examples/intermediate/22_omit_keyword/omit_keyword.mmt
npx testlight run examples/intermediate/22_omit_keyword/omit_keyword_test.mmt
```

Override inputs from the command line:

```sh
npx testlight run examples/intermediate/22_omit_keyword/omit_keyword.mmt \
  -e middleName=Lee -e nickname='"omit"'
```

## Key concepts

- **`omit` in inputs** — unquoted `omit` removes the target field from request objects (body/headers/query/cookies).
- **`null` in inputs** — unquoted `null` sends a real null value.
- **Quoted literals** — `"omit"` and `"null"` stay strings (like quoted numbers).
- **`omit` in outputs** — shown when an extraction path is missing (for example `echoed_middleName` when `middleName` was omitted).
- **`null` in outputs** — shown when the echoed field exists and its value is literally `null`.

See [API docs — inputs](../../../docs/files/api/index.md#inputs) and [API docs — outputs](../../../docs/files/api/index.md#outputs).
