# Current Limitations

These constructs are recognized or preserved, but are not fully executed natively yet:

- Pre-request scripts.
- Full response handler/test script execution.
- Multipart/form-data as structured parts.
- Request body file includes such as `< ./payload.json`.
- Cookie jar directives and redirect-control directives.
- Digest auth, AWS SigV4, and other tool-specific auth helpers.

Use Multimeter YAML `.mmt` files when you need full flow control, data-driven loops, explicit checks/asserts, report configuration, mock servers, load tests, or advanced environment presets.
