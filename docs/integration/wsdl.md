# WSDL

Import SOAP API definitions from WSDL files into Multimeter.

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

Example output: [WSDL convert example](../../examples/professional/04_convert_to_mmt/wsdl/README.md)

## See also

- [OpenAPI spec](./openapi.md) · [HTTP protocol](../files/api/protocols/http.md) · [API files](../files/api/index.md)
