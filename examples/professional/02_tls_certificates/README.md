# TLS Certificates

Demonstrates how to configure **CA certificates** and **client certificates (mTLS)** in an environment file for secure HTTPS API calls.

## Structure

```
02_tls_certificates/
├── env.mmt                      # Environment file with certificates section
├── api/
│   └── secure_echo.mmt          # API that uses <<e:api_url>> (HTTPS)
├── certs/                        # Place your certificate files here
│   ├── ca.crt                   # CA certificate (not included — add your own)
│   ├── client.crt               # Client certificate for mTLS (PEM)
│   ├── client.key               # Client private key for mTLS (PEM)
│   └── client.p12               # Optional PKCS#12 bundle instead of cert + key
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
  server_ca: "./certs/ca.crt"
```

Add a path to your CA PEM file. This is used to trust custom certificate authorities (e.g., internal company CAs).

### Client certificates (mTLS)

Use either PEM `cert` + `key`, or a PKCS#12 bundle in `pfx` (`.p12` or `.pfx`):

```yaml
certificates:
  clients:
    - name: "Example API"
      host: "*.example.com"
      cert: "./certs/client.crt"
      key: "./certs/client.key"
      passphrase_env: "CLIENT_CERT_PASS"
    - name: "Example API PKCS#12"
      host: "*.internal.example.com"
      pfx: "./certs/client.p12"
      passphrase_env: "CLIENT_CERT_PASS"
```

| Field | Description |
|---|---|
| `name` | Display name for the certificate |
| `host` | Host pattern to match (e.g., `*.api.example.com` or `*` for all) |
| `cert` | Path to client certificate file (PEM) |
| `key` | Path to private key file (PEM) |
| `pfx` | Path to PKCS#12 bundle (`.p12` or `.pfx`) — alternative to `cert` + `key` |
| `passphrase_env` | Environment variable name containing the key or bundle passphrase |
| `passphrase_plain` | Plain text passphrase (avoid in shared configs) |

## Enable/disable settings (VS Code workspace)

These are managed via the UI, not in the YAML file:

| Setting | Default | Description |
|---|---|---|
| CA Enabled | `false` | Enable custom CA certificates |
| Client Enabled | `true` | Enable/disable individual client certs |

## Supported formats

- **PEM:** `.pem`, `.crt`, `.cer`, `.key` for `server_ca`, `cert`, and `key`
- **PKCS#12:** `.p12` or `.pfx` for `pfx` (client bundle)

Working PKCS#12 samples live next to the PEM files in `06_mtls_mock_server` and `08_external_mtls_badssl`. Current Node runtimes need AES-based PKCS#12; older RC2/3DES bundles fail with `Unsupported PKCS12 PFX data`. Re-export if needed:

```sh
openssl pkcs12 -export \
  -in client.crt -inkey client.key \
  -out client.p12 \
  -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
```

## How to use

### In VS Code

1. Place your certificate files in the `certs/` folder.
2. Open the `env.mmt` file and switch to the **Certificates** tab to configure paths and toggle settings.
3. Set the environment in the **Environment** panel.
4. Open `tls_test.mmt` and click **Run**.

### With the CLI

```sh
# Set passphrase via environment variable
export CLIENT_CERT_PASS="secret123"

# Run the test with the env file
npx testlight run examples/professional/02_tls_certificates/tls_test.mmt \
  --env-file examples/professional/02_tls_certificates/env.mmt
```

> **Note:** This example uses `https://test.mmt.dev/echo` which does not require client certificates. To test mTLS, point `api_url` at your own server that requires client certs.
