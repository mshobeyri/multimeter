# HTTPS and mTLS

The Mock Server panel can run an HTTPS server on localhost.

- Set **Server Type** to **HTTPS**.
- Optionally select a **server certificate** file (PEM/CRT) and matching **server key** file (PEM/KEY). If no cert/key is provided for TLS mode in a `.mmt` mock server file, Multimeter uses built-in self-signed certs.

### mTLS (client certificate verification)

To require clients to present a valid certificate (mutual TLS):

- Set **Server Type** to **HTTPS** and enable **Require client certificate (mTLS)**.
- Select a **Client CA** file (PEM) that signed the client certificates you want to accept.

When mTLS is enabled:
- The server will request a client certificate from connecting clients.
- Clients without a valid certificate signed by the configured CA will be rejected.

### Testing TLS and mTLS with curl

**TLS only (server cert, no client cert):**
```sh
curl --cacert certs-test/ca.crt https://127.0.0.1:8080/
```

**mTLS (client cert required):**
```sh
curl --cacert certs-test/ca.crt \
     --cert certs-test/client.crt \
     --key certs-test/client.key \
     https://127.0.0.1:8080/
```

### Notes
- The server binds to `127.0.0.1`.
- Certificate file paths are stored in VS Code workspace state and persist across restarts.
- Only PEM format is supported (`.pem`, `.crt`, `.cer`, `.key`).
- Most HTTP clients will need to trust the server certificate (add the CA to `certificates.server_ca` or disable validation where appropriate).

---
