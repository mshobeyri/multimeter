# Certificates

SSL/TLS certificate configuration in MMT has two parts:
1. **File paths** - stored in the `certificates` section of the env file (YAML)
2. **Boolean settings** - stored in local storage (VS Code workspace state or CLI defaults)

This separation allows certificate file paths to be version-controlled while keeping enable/disable toggles as local preferences.

## Supported certificate formats

Multimeter supports **PEM format only** for all certificate types:
- CA certificates: `.pem`, `.crt`, `.cer`
- Client certificates: `.pem`, `.crt`
- Private keys: `.pem`, `.key`

PKCS#12 (`.pfx`, `.p12`) bundles are not currently supported. Convert them to PEM format before use:

```sh
# Extract certificate from PFX
openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client.crt

# Extract key from PFX
openssl pkcs12 -in bundle.pfx -nocerts -out client.key
```

## Example certificate configuration

```yaml
type: env
variables:
  API_URL: "https://api.example.com"

certificates:
  # CA Certificates (multiple paths supported)
  ca:
    paths:
      - "./certs/ca.pem"           # Path relative to env file
      - "./certs/intermediate.pem"
  
  # Client certificates (mTLS)
  clients:
    - name: "Production API"
      host: "*.api.example.com"    # Host pattern to match
      cert_path: "./certs/client.pem"
      key_path: "./certs/client.key"
      passphrase_env: "CERT_PASS"  # Optional: env variable containing passphrase
    
    - name: "Internal API"
      host: "internal.example.com"
      cert_path: "./certs/internal.pem"
      key_path: "./certs/internal.key"
      passphrase_plain: "secret"   # Optional: plaintext passphrase (avoid in shared configs)
```

## Certificate fields (YAML)

| Field | Description |
|-------|-------------|
| `ca.paths` | Array of paths to CA certificate files (relative to env file or absolute) |
| `clients[].name` | Display name for the client certificate |
| `clients[].host` | Host pattern (e.g., `*.api.example.com` or `*` for all) |
| `clients[].cert_path` | Path to client certificate file |
| `clients[].key_path` | Path to private key file |
| `clients[].passphrase_plain` | Passphrase in plain text (avoid in shared configs) |
| `clients[].passphrase_env` | Environment variable name containing passphrase |

## Boolean settings (local storage)

These settings are NOT stored in the YAML file. They are managed via the UI and stored in VS Code workspace state:

| Setting | Default | Description |
|---------|---------|-------------|
| SSL Validation | `true` | Verify SSL certificates |
| Allow Self-Signed | `false` | Trust self-signed certificates |
| CA Enabled | `false` | Enable custom CA certificates |
| Client Enabled | `true` | Enable/disable individual client certificates |

For CLI usage, sensible defaults are applied:
- SSL validation is enabled
- Self-signed certificates are not allowed by default
- All configured certificates are enabled

### Self-signed certificate auto-retry
When "Allow Self-Signed" is enabled, Multimeter automatically retries failed HTTPS requests with SSL validation disabled if the error matches specific TLS error codes (such as `SELF_SIGNED_CERT_IN_CHAIN` or `DEPTH_ZERO_SELF_SIGNED_CERT`). This makes it easier to work with development servers using self-signed certificates without manually disabling validation globally.

## Passphrase handling

For security, you can store passphrases in environment variables instead of the env file:

```yaml
clients:
  - name: "Secure API"
    host: "secure.api.com"
    cert_path: "./certs/client.pem"
    key_path: "./certs/client.key"
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
- Add/remove CA certificate paths (stored in YAML)
- Manage client certificates for mTLS (paths in YAML, enable/disable locally)

## Migration from VS Code settings

Previously, certificate settings were stored in VS Code workspace settings. These settings are now deprecated and will be ignored. To migrate:

1. Open your env file (e.g., `_environments.mmt`)
2. Switch to the **Certificates** tab in the editor
3. Configure your certificate file paths (saved to YAML)
4. Toggle enable/disable settings as needed (saved locally)

This ensures that certificate file paths are portable and can be version-controlled, while local preferences remain workspace-specific.
