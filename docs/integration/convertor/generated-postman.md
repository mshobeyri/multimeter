# Postman conversion features

Postman-specific behavior when converting collections to MMT. See [What gets generated](./generated-output.md) for the overall output layout.

- **Dynamic variable mapping**: Postman variables like `{{$guid}}`, `{{$randomEmail}}`, `{{$randomInt}}` are automatically converted to Multimeter `r:` tokens (e.g., `r:uuid`, `r:email`, `r:int`).
- **Form data and URL-encoded bodies**: `formdata` and `urlencoded` body modes from Postman collections are converted to Multimeter bodies with `format: urlencoded` where applicable.
- **Example extraction**: When Postman items include saved response examples with `originalRequest`, the convertor auto-generates inputs, header input placeholders, and example overrides in the generated API files.
- **Suite generation**: Postman folders generate suites that run folder tests and child-folder suites in sequence.
- **Large project imports**: Postman collections with 5 or more APIs generate `multimeter.mmt` and use `+/` imports.
- **Script preservation**: Unsupported Postman scripts are preserved as `js` steps with review comments.

## Tips after import
- Map your base URL to an environment variable early and reference it with `<<e:api_url>>`
- Review generated inputs/headers and tweak names to match your project conventions
- Use the API editor to refine bodies and add `setenv` for downstream tests

Complex auth flows and Postman sandbox APIs may still need manual touch-ups.

See also: [What gets generated](./generated-output.md) · [OpenAPI / HTTP / Bruno](./generated-sources.md) · [Convertor](./index.md)
