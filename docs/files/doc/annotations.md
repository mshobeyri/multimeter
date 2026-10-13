# Parameter annotations in API descriptions

API and test `description` fields support annotations that document input and output parameters, including allowed values and ranges.

**Canonical guide:** [Input and output documentation](../input-output-docs.md)

Quick syntax:

- `<<i:param_name>> description text` — input parameter
- `<<o:param_name>> description text` — output parameter
- `<<i:role>> [admin, editor, viewer] User role` — allowed values (⋯ picker in Inputs / test runner)
- `<<i:page>> [1-5] Page number` — integer range

In the editor, open **Inputs** (API) or the test runner inputs to use the ⋯ menu on constrained fields, and **Doc** to preview parameter tables. Generated HTML/Markdown docs show each annotation as a parameter table row.

Wire the same names under `inputs` / `outputs` — see [Inputs](../api/inputs.md) and [Outputs](../api/outputs.md). More API context: [API → Documentation](../api/documentation.md).
