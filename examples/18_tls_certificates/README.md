# TLS Certificates

Demonstrates how to configure **CA certificates** and **client certificates (mTLS)** in an environment file for secure HTTPS API calls.

## Structure

```
18_tls_certificates/
├── env.mmt                      # Environment file with certificates section
├── api/
│   └── secure_echo.mmt          # API that uses <<e:api_url>> (HTTPS)
├── certs/                        # Place your PEM certificate files here
│   ├── ca.crt                   # CA certificate (not included — add your own)
│   ├── client.crt               # Client certificate for mTLS
│   └── client.key               # Client private key for mTLS
├── tls_test.mmt                  # Test that calls the secure API
└── README.md
```

## Files

| File | Description |
|---|---|
| `env.mmt` | Environment file with `certificates` section — CA paths and client cert config |
| `api/secure_echo.mmt` | API using `<<e:api_url>>` to call an HTTPS endpoint |
| `tls_test.mmt` | Test that calls the secure API with certificate config |

## Certificate configuration

The `certificates` section in `env.mmt` has two parts:

### CA certificates

```yaml
certificates:
  ca:
    paths:
      - "./certs/ca.crt"
      - "./certs/intermediate.pem"
```

Add paths to your CA/intermediate PEM files. These are used to trust custom certificate authorities (e.g., internal company CAs).

### Client certificates (mTLS)

```yaml
certificates:
  clients:
    - name: "Example API"
      host: "*.example.com"
      cert_path: "./certs/client.crt"
      key_path: "./certs/client.key"
      passphrase_env: "CLIENT_CERT_PASS"
```

| Field | Description |
|---|---|
| `name` | Display name for the certificate |
| `host` | Host pattern to match (e.g., `*.api.example.com` or `*` for all) |
| `cert_path` | Path to client certificate file (PEM) |
| `key_path` | Path to private key file (PEM) |
| `passphrase_env` | Environment variable name containing the key passphrase |
| `passphrase_plain` | Plain text passphrase (avoid in shared configs) |

## Boolean settings (VS Code workspace)

These are managed via the UI, not in the YAML file:

| Setting | Default | Description |
|---|---|---|
| SSL Validation | `true` | Verify SSL certificates |
| Allow Self-Signed | `false` | Trust self-signed certificates |
| CA Enabled | `false` | Enable custom CA certificates |
| Client Enabled | `true` | Enable/disable individual client certs |

## Supported formats

Only **PEM format** is supported (`.pem`, `.crt`, `.cer`, `.key`). Convert PKCS#12 bundles before use:

```sh
# Extract certificate from PFX
openssl pkcs12 -in bundle.pfx -clcerts -nokeys -out client.crt

# Extract key from PFX
openssl pkcs12 -in bundle.pfx -nocerts -out client.key
```

## How to use

### In VS Code

1. Place your PEM certificate files in the `certs/` folder.
2. Open the `env.mmt` file and switch to the **Certificates** tab to configure paths and toggle settings.
3. Set the environment in the **Environment** panel.
4. Open `tls_test.mmt` and click **Run**.

### With the CLI

```sh
# Set passphrase via environment variable
export CLIENT_CERT_PASS="secret123"

# Run the test with the env file
npx testlight run examples/18_tls_certificates/tls_test.mmt \
  --env-file examples/18_tls_certificates/env.mmt
```

> **Note:** This example uses `https://test.mmt.dev/echo` which does not require client certificates. To test mTLS, point `api_url` at your own server that requires client certs.
