# TLS

## HTTPS and mTLS in server files

Mock server file protocols are `http`, `https`, or `ws`. The `connection` block controls whether the HTTP connection is plain, TLS, or mTLS.

Certificate paths in `connection.cert`, `connection.key`, and `connection.client_ca` are resolved relative to the `.mmt` server file. The visual mock editor exposes these in the **Server** tab, including file pickers for certificate/key paths.

If no cert/key is provided for TLS mode, Multimeter uses built-in self-signed certs.

```yaml
type: server
protocol: https
port: 8443
connection:
  mode: tls
  cert: ./certs/server.crt
  key: ./certs/server.key
endpoints:
  - method: get
    path: /health
    status: 200
    body: OK
```

For mTLS, `connection.client_ca` is required:

```yaml
type: server
protocol: https
port: 8444
connection:
  mode: mtls
  cert: ./certs/server.crt
  key: ./certs/server.key
  client_ca: ./certs/ca.crt
endpoints:
  - method: get
    path: /secure
    status: 200
    body: OK
```

For TLS in the sidebar **Mock server panel** (workspace-stored cert paths), see [Mock server panel — HTTPS and mTLS](./panel.md#https-and-mtls).

---

See also: [Endpoints](./endpoints.md) · [Certificates](../../features/certificates/index.md)
