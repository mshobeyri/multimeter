# mTLS Mock Server

This example starts a local mock server with `protocol: https` and `connection.mode: mtls`, then calls it from a Multimeter test using a client certificate.

## Files

- `server/mock_server.mmt` defines the mTLS mock server on port `29444`.
- `api/secure_health.mmt` calls the fixed client URL `https://localhost:29444/health`.
- `test/secure_health_test.mmt` starts the server and calls the API.
- `env.mmt` trusts the example CA certificate and configures the client certificate.
- `certs/` contains long-lived local test certificates for this example.

## Run

```sh
npx testlight run examples/26_mtls_mock_server/test/secure_health_test.mmt
```

The runner discovers the nearest `env.mmt` automatically. You can still pass `--env-file examples/26_mtls_mock_server/env.mmt` explicitly if you prefer.
