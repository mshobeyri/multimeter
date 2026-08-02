# Current Limitations

- Bruno collection folders are not expanded automatically; import or open individual `.bru` request files.
- Pre-request and post-response scripts are not executed as Bruno scripts. Only simple `expect(...).to.equal(...)` style tests are mapped to Multimeter checks.
- File bodies, multipart helpers, and advanced auth helpers may need conversion to editable `.mmt` for full control.
