# TLS Mock Server

This example starts a local mock server with `protocol: https` and `connection.mode: tls`, then calls it from a Multimeter test.

## Files

- `server/mock_server.mmt` defines the TLS mock server on port `29443`.
- `api/secure_health.mmt` calls the fixed client URL `https://localhost:29443/health`.
- `test/secure_health_test.mmt` starts the server and calls the API.
- `env.mmt` trusts the example CA certificate.
- `certs/` contains long-lived local test certificates for this example.

## Run

```sh
npx testlight run examples/professional/05_tls_mock_server/test/secure_health_test.mmt
```

The runner discovers the nearest `env.mmt` automatically. You can still pass `--env-file examples/professional/05_tls_mock_server/env.mmt` explicitly if you prefer.
