# Certificate fields (YAML)

| Field | Description |
|-------|-------------|
| `server_ca` | Server CA certificate file (relative to env file or absolute) |
| `clients[].name` | Display name for the client certificate |
| `clients[].host` | Host pattern (e.g., `*.api.example.com`, `api.example.com:8443`, or `*:8443`) |
| `clients[].cert` | Path to client certificate file (PEM/CRT format). Use with `key`. |
| `clients[].key` | Path to private key file. Use with `cert`. |
| `clients[].pfx` | Path to PKCS#12 bundle (`.p12` or `.pfx`). Use instead of `cert` + `key`, not with them. |
| `clients[].passphrase_plain` | Passphrase in plain text (avoid in shared configs). Use instead of `passphrase_env`, not with it. |
| `clients[].passphrase_env` | Environment variable name containing passphrase. Use instead of `passphrase_plain`, not with it. |
