# Reference (types)
- `type:` `env`
- `variables:` record of choice maps, allowed-value arrays, or `./….mmt` [live variable](./live-variables.md) paths
- `presets:` record<string, record<string, record<string, string|number|boolean|null>>>
- `setting:` { http?: { version?: "auto"|"1"|"1.1"|"2", timeout?: number } }
- `certificates:` { server_ca?, clients? }
