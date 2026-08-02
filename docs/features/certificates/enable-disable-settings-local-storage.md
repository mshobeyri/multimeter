# Enable/disable settings (local storage)

These settings are NOT stored in the YAML file. They are managed via the UI and stored in VS Code workspace state:

| Setting | Default | Description |
|---------|---------|-------------|
| Server CA Enabled | `false` | Use configured server CA certificates |
| Client Enabled | `true` | Enable/disable individual client certificates |

For CLI usage, sensible defaults are applied:
- SSL validation is enabled
- Self-signed certificate failures are retried and reported as warnings
- All configured certificates are enabled

### Self-signed certificate warning
Multimeter first verifies SSL certificates. If an HTTPS request fails because of a self-signed certificate, Multimeter retries the request without certificate validation and reports the certificate issue as a warning, matching Postman-style behavior.

### Legacy TLS compatibility

Multimeter automatically enables the Node/OpenSSL compatibility flags needed for many legacy TLS and mTLS gateways, avoids HTTPS TLS session reuse, and keeps TLS version negotiation automatic. No TLS-specific user configuration is required.
