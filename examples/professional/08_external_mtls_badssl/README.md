# External mTLS with BadSSL

This example calls the public BadSSL client-certificate endpoint at `https://client.badssl.com/` using a real client certificate.

It is useful for checking that Multimeter sends mTLS client certificate material through the VS Code extension and CLI request transport, not just that local certificate matching logic works.

## Files

- `api/badssl_client.mmt` defines the public BadSSL mTLS endpoint.
- `badssl_mtls_test.mmt` calls the API and expects HTTP 200.
- `multimeter.mmt` configures the BadSSL client certificate with `host: "*:443"`.
- `certs/badssl.com-client.pem` is the original PEM downloaded from BadSSL.
- `certs/badssl-client.crt` is the certificate block split from the PEM.
- `certs/badssl-client.key` is the encrypted private key block split from the PEM.

The key passphrase is the public BadSSL test passphrase: `badssl.com`.

## Run

```sh
npx testlight run examples/professional/08_external_mtls_badssl/badssl_mtls_test.mmt
```

The runner discovers the nearest `multimeter.mmt` automatically. You can pass it explicitly if needed:

```sh
npx testlight run examples/professional/08_external_mtls_badssl/badssl_mtls_test.mmt \
  --env-file examples/professional/08_external_mtls_badssl/multimeter.mmt
```

## External verification

Use curl to confirm the same certificate works outside Multimeter:

```sh
curl -v \
  --cert examples/professional/08_external_mtls_badssl/certs/badssl-client.crt \
  --key examples/professional/08_external_mtls_badssl/certs/badssl-client.key \
  --pass badssl.com \
  https://client.badssl.com/
```

Without the client certificate, BadSSL returns a TLS/client-certificate failure instead of the success page.

BadSSL returns an HTML page. Current runners may print a non-fatal JSON parse warning while extracting outputs from the HTML response; the mTLS smoke test still passes when the status check reports HTTP 200.