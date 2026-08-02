# Supported certificate formats

Multimeter supports these certificate file references:

- **Client certificate** (`cert`): Client certificate in PEM format (`.pem`, `.crt`, `.cer`)
- **Private key** (`key`): Private key in PEM format (`.pem`, `.key`)
- **PFX bundle** (`pfx`): PKCS#12 bundle (`.pfx`, `.p12`) — alternative to `cert` + `key`
- **Server CA certificates** (`server_ca`): CA certificate files used to verify servers (`.pem`, `.crt`, `.cer`)
