# Reference (types)
- `type:` `env`
- `variables:` record<string, object (key-value choices) | array (allowed values)>
- `presets:` record<string, record<string, record<string, string|number|boolean|null>>>
- `setting:` { http?: { version?: "auto"|"1"|"1.1"|"2", timeout?: number } }
- `certificates:` { server_ca?, clients? }
