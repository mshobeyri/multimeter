# WSDL

Import SOAP API definitions from WSDL files into Multimeter.

## Run directly

See [Spec editor](./spec-editor.md) for the {{btn:list-tree}} request picker and {{btn:save-as}}.

In VS Code, right-click a `.wsdl` file and choose **Open as MMT**, or use **Open With...** → **Multimeter Spec Editor**. The WSDL stays on the left.

Click {{btn:list-tree}}, pick a **WSDL operation**, then {{btn:send:Send}}. There is no **All** row for WSDL — each operation runs as a single SOAP API send. Hover a row for **Save as MMT**.

## Convert to MMT

1. Right-click a `.wsdl` file in the VS Code Explorer
2. Choose **Convert to MMT...**
3. Select the generated files, pick a destination folder, and choose a collision policy

Multimeter generates `type: api` files under `api/` — one per WSDL operation.

## What Multimeter maps

- WSDL operations → XML API files with SOAP envelopes
- Service endpoint URLs and **SOAPAction** headers from the WSDL binding
- Request body templates inferred from the WSDL schema where available

Review generated SOAP envelopes and endpoint URLs against your environment before running tests.

Example output: [WSDL convert example](../../examples/intermediate/25_convert_to_mmt/wsdl/README.md)

Multi-operation WSDL sample: [professional WSDL convert](../../examples/professional/04_convert_to_mmt/wsdl/README.md)

## See also

- [OpenAPI spec](./openapi.md) · [HTTP protocol](../files/api/protocols/http.md) · [API files](../files/api/index.md)
