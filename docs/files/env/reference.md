# Reference (types)
- `type:` `env`
- `variables:` record of choice maps (choice values may be scalars or nested objects/arrays), allowed-value arrays (scalars only), bare scalars, `./….mmt` [live variable](./live-variables.md) paths, or `$VAR` [OS env refs](./os-variables.md)
- `presets:` record<string, record<string, record<string, string|number|boolean|null>>> — optional; use to bind independent variables, not to keep fields of one nested choice in sync
- `setting:` { http?: { version?: "auto"|"1"|"1.1"|"2", timeout?: number } }
- `certificates:` { server_ca?, clients? }
