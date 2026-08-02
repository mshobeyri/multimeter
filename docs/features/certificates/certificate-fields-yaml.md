# Certificate fields (YAML)

| Field | Description |
|-------|-------------|
| `server_ca` | Server CA certificate file (relative to env file or absolute) |
| `clients[].name` | Display name for the client certificate |
| `clients[].host` | Host pattern (e.g., `*.api.example.com`, `api.example.com:8443`, or `*:8443`) |
| `clients[].cert` | Path to client certificate file (PEM/CRT format) |
| `clients[].key` | Path to private key file |
| `clients[].pfx` | Path to PKCS#12 bundle file (alternative to `cert` + `key`) |
| `clients[].passphrase_plain` | Passphrase in plain text (avoid in shared configs) |
| `clients[].passphrase_env` | Environment variable name containing passphrase |
