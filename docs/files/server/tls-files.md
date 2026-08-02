# TLS in server files

## HTTPS and mTLS server files

Mock server file protocols are `http`, `https`, or `ws`. The `connection` block controls whether the HTTP connection is plain, TLS, or mTLS:

Certificate paths in `connection.cert`, `connection.key`, and `connection.client_ca` are resolved relative to the `.mmt` server file. The visual mock editor exposes these in the **Server** tab, including file pickers for certificate/key paths.

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

## Running from the Mock Server panel

1. Set **Server Type** to **MMT Mock Server**
2. Click the folder button and select your `.mmt` server file
3. Optionally adjust the port (overrides the file's default)
4. Click **Run Mock Server**

The server starts with full routing — requests are matched against your endpoints, and responses use all the dynamic token features of Multimeter.

---
