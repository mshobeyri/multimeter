# Certificates

SSL/TLS certificate configuration in MMT has two parts:
1. **File paths** - stored in the `certificates` section of the env file (YAML)
2. **Boolean settings** - stored in local storage (VS Code workspace state or CLI defaults)

This separation allows certificate file paths to be version-controlled while keeping enable/disable toggles as local preferences.

## Supported certificate formats

Multimeter supports these certificate file references:

- **Client certificate** (`cert`): Client certificate in PEM format (`.pem`, `.crt`, `.cer`)
- **Private key** (`key`): Private key in PEM format (`.pem`, `.key`)
- **PFX bundle** (`pfx`): PKCS#12 bundle (`.pfx`, `.p12`) — alternative to `cert` + `key`
- **Server CA certificates** (`server_ca`): CA certificate files used to verify servers (`.pem`, `.crt`, `.cer`)

## Example certificate configuration

```yaml
type: env
variables:
  API_URL: "https://api.example.com"

certificates:
  # Server CA certificates (multiple paths supported)
  server_ca:
    paths:
      - "./certs/ca.pem"           # Path relative to env file
      - "./certs/intermediate.pem"
  
  # Client certificates (mTLS)
  clients:
    - name: "Production API"
      host: "*.api.example.com"    # Host pattern to match
      cert: "./certs/client.pem"
      key: "./certs/client.key"
      passphrase_env: "CERT_PASS"  # Optional: env variable containing passphrase
    
    - name: "PFX Bundle"
      host: "internal.example.com"
      pfx: "./certs/bundle.pfx"
      passphrase_plain: "secret"   # Optional: plaintext passphrase (avoid in shared configs)
```

## Certificate fields (YAML)

| Field | Description |
|-------|-------------|
| `server_ca.paths` | Array of paths to server CA certificate files (relative to env file or absolute) |
| `clients[].name` | Display name for the client certificate |
| `clients[].host` | Host pattern (e.g., `*.api.example.com`, `api.example.com:8443`, or `*:8443`) |
| `clients[].cert` | Path to client certificate file (PEM/CRT format) |
| `clients[].key` | Path to private key file |
| `clients[].pfx` | Path to PKCS#12 bundle file (alternative to `cert` + `key`) |
| `clients[].passphrase_plain` | Passphrase in plain text (avoid in shared configs) |
| `clients[].passphrase_env` | Environment variable name containing passphrase |

## Boolean settings (local storage)

These settings are NOT stored in the YAML file. They are managed via the UI and stored in VS Code workspace state:

| Setting | Default | Description |
|---------|---------|-------------|
| SSL Validation | `true` | Verify SSL certificates |
| Allow Untrusted Self-Signed | `false` | Retry self-signed HTTPS requests without certificate validation when no trusted CA path is available |
| Server CA Enabled | `false` | Use configured server CA certificates |
| Client Enabled | `true` | Enable/disable individual client certificates |

For CLI usage, sensible defaults are applied:
- SSL validation is enabled
- Self-signed certificates are not allowed by default
- All configured certificates are enabled

### Self-signed certificate auto-retry
When "Allow Untrusted Self-Signed" is enabled, Multimeter automatically retries failed HTTPS requests with SSL validation disabled if the error matches specific TLS error codes (such as `SELF_SIGNED_CERT_IN_CHAIN` or `DEPTH_ZERO_SELF_SIGNED_CERT`). If the server certificate is trusted through `certificates.server_ca`, this setting is not needed.

## Passphrase handling

For security, you can store passphrases in environment variables instead of the env file:

```yaml
clients:
  - name: "Secure API"
    host: "secure.api.com"
    cert: "./certs/client.pem"
    key: "./certs/client.key"
    passphrase_env: "MY_CERT_PASSPHRASE"  # Will read from $MY_CERT_PASSPHRASE
```

Then set the environment variable before running:

```sh
export MY_CERT_PASSPHRASE="secret123"
testlight run test.mmt --env-file env.mmt
```

## Edit certificates in the UI

In the env file editor, switch to the **Certificates** tab to:
- Configure SSL validation settings (stored locally)
- Add/remove server CA certificate paths (stored in YAML)
- Manage client certificates for mTLS (paths in YAML, enable/disable locally)

## Host matching rules

Client certificate selection is based on the request host, with optional port matching:

- `example.com` matches `example.com` and subdomains like `api.example.com`
- `*.api.example.com` matches subdomains like `v1.api.example.com`
- `api.example.com:8443` restricts the match to that port
- `*:8085` matches any host on port `8085`

## Migration from VS Code settings

Previously, certificate settings were stored in VS Code workspace settings. These settings are now deprecated and will be ignored. To migrate:

1. Open your env file (e.g., `_environments.mmt`)
2. Switch to the **Certificates** tab in the editor
3. Configure your certificate file paths (saved to YAML)
4. Toggle enable/disable settings as needed (saved locally)

This ensures that certificate file paths are portable and can be version-controlled, while local preferences remain workspace-specific.

