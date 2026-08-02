# Example certificate configuration

```yaml
type: env
variables:
  api_url: "https://test.mmt.dev"

setting:
  http:
    version: "auto"
    timeout: 30000

certificates:
  # Server CA certificate
  server_ca: "./certs/ca.pem"      # Path relative to env file
  
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
