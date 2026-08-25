# mTLS Mock Server

This example starts a local mock server with `protocol: https` and `connection.mode: mtls`, then calls it from a Multimeter test using a client certificate.

## Files

- `server/mock_server.mmt` defines the mTLS mock server on port `29444`.
- `api/secure_health.mmt` calls the fixed client URL `https://localhost:29444/health`.
- `test/secure_health_test.mmt` starts the server and calls the API.
- `multimeter.mmt` trusts the example CA certificate and configures client certificates.
- `certs/` contains long-lived local test certificates for this example:
  - PEM: `ca.crt`, `client.crt`, `client.key`, `server.crt`, `server.key`
  - PKCS#12: `client.p12` (passphrase `mmt`) — same client identity as `client.crt` + `client.key`

The env file shows both formats. Matching uses the first enabled client for `localhost:29444`, so the PEM client is used at runtime. Switch to `pfx: ./certs/client.p12` if you want to send the PKCS#12 bundle instead.

## Run

```sh
npx testlight run examples/professional/06_mtls_mock_server/test/secure_health_test.mmt
```

The runner discovers the nearest `multimeter.mmt` automatically. You can still pass `--env-file examples/professional/06_mtls_mock_server/multimeter.mmt` explicitly if you prefer.
