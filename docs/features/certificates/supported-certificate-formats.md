# Supported certificate formats

Multimeter supports these certificate file references:

- **Client certificate** (`cert`): Client certificate in PEM format (`.pem`, `.crt`, `.cer`)
- **Private key** (`key`): Private key in PEM format (`.pem`, `.key`)
- **PFX bundle** (`pfx`): PKCS#12 bundle (`.pfx`, `.p12`) — alternative to `cert` + `key`
- **Server CA certificates** (`server_ca`): CA certificate files used to verify servers (`.pem`, `.crt`, `.cer`)

PKCS#12 samples are in `examples/professional/06_mtls_mock_server/certs/client.p12` and `examples/professional/08_external_mtls_badssl/certs/badssl-client.p12`. Current Node runtimes need AES-based PKCS#12; older RC2/3DES exports fail with `Unsupported PKCS12 PFX data`. Re-export with:

```sh
openssl pkcs12 -export \
  -in client.crt -inkey client.key \
  -out client.p12 \
  -keypbe AES-256-CBC -certpbe AES-256-CBC -macalg sha256
```
