# Document Parameters

An intermediate `type: doc` example that documents input parameters with options and ranges.

## Files

| File | Description |
|---|---|
| `document.mmt` | Renders the parameter documentation and enables Try buttons |
| `api/search_users.mmt` | API with parameter descriptions, option lists, and a numeric range |

## How to use

1. Open `document.mmt` in VS Code with the Multimeter extension.
2. Expand `Search users`.
3. Review the documented parameters and their options/ranges.

## Key concepts

- **Options** use syntax like `<<i:role>> [admin, editor, viewer] Role description`.
- **Ranges** use syntax like `<<i:page>> [1-5] Page number`.
- **Output annotations** use `<<o:name>> Description`.
- **`html.triable: true`** enables interactive Try buttons in rendered docs.

See [Doc docs](../../../docs/files/doc/index.md#parameter-annotations-in-api-descriptions) for details.
