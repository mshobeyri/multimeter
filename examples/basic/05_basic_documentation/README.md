# Basic Documentation

A minimal `type: doc` example that shows how parameter annotations are rendered. The doc file has no description so the sample focuses only on the API and its parameters.

## Files

| File | Description |
|---|---|
| `document.mmt` | Renders documentation for the API files in `api/` |
| `api/get_user.mmt` | API with simple input and output parameter annotations |

## How to use

1. Open `document.mmt` in VS Code with the Multimeter extension.
2. The editor renders the documented API.
3. Expand the API row to see the input and output parameter descriptions.

## Key concepts

- **`type: doc`** scans API files and renders documentation.
- **`<<i:param>>`** documents an input parameter.
- **`<<o:param>>`** documents an output parameter.

See [Doc docs](../../../docs/files/doc/index.md) for the full reference.
