# SDD: TLS and mTLS Mock Server Support

## Problem

Certificate configuration recently drifted toward nested YAML file references and docs/autocomplete text that emphasized that naming model. The desired behavior is not a naming imitation. Multimeter should support the actual protocols and certificate flows needed for TLS and mutual TLS, while keeping the `.mmt` schema simple and native.

Mock servers should keep protocol naming aligned with URL/server protocols: `http`, `https`, and `ws`. TLS behavior is configured separately through `connection.mode`.

## Goals

- Use native certificate path fields in env files:
  - `server_ca`
  - `cert`
  - `key`
  - `pfx`
  - `passphrase_plain`
  - `passphrase_env`
- Remove docs and autocomplete language that says Multimeter follows or mirrors another tool's certificate field names.
- Support file-based mock servers with `protocol: https` and `connection.mode: tls | mtls`.
- Keep `protocol: http` for plaintext HTTP and `protocol: ws` for WebSocket mock servers.
- Let mock server files pass optional server certificate/key and required mTLS client CA through `connection`.
- Add examples for TLS and mTLS mock servers with long-lived local certificates and clients that call those mock servers.
- Do not keep compatibility aliases for old mock protocol or certificate field names.

## Non-Goals

- Do not change API/test request URL schemes. Clients still call TLS and mTLS mock servers with `https://localhost:<port>`.
- Do not store local certificate enable/disable toggles in YAML.
- Do not redesign the certificate editor UI beyond the field-shape changes needed here.
- Do not make generated test certificates trusted by the OS automatically.

## Schema

### Environment certificates

```yaml
certificates:
  server_ca:
    paths:
      - ./certs/ca.crt
  clients:
    - name: mock-client
      host: localhost:8444
      cert: ./certs/client.crt
      key: ./certs/client.key
      passphrase_env: CLIENT_CERT_PASS
```

A client certificate may use either `cert` plus `key`, or `pfx`.

### Mock server TLS

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
    body: ok
```

### Mock server mTLS

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
    body: ok
```

For `connection.mode: mtls`, `connection.client_ca` is required. Runtime sets `requestCert: true` and rejects unauthorized clients.

## Implementation Plan

1. Update core mock server data and parser types to accept `protocol: https` plus `connection.mode`, validate mTLS requirements, and serialize the new fields.
2. Update VS Code and CLI mock runners to create HTTPS servers for `protocol: https`; require client certs only for `connection.mode: mtls`.
3. Update the Mock Server panel naming to HTTP/HTTPS/WebSocket, with mTLS as a connection option, while preserving existing workspace state keys where helpful.
4. Replace env certificate client shape in core types, VS Code runtime parsing, workspace env loader, CLI env parsing, webview editor, autocomplete, and docs.
5. Add examples:
   - `examples/25_tls_mock_server`
   - `examples/26_mtls_mock_server`
   Each includes a server `.mmt`, env file, client API/test files, README, and local long-lived certificates.
6. Run focused parser/runtime tests and compile.

## Risks

- Node TLS rejects self-signed server certificates unless the client has the matching CA loaded or validation is disabled. The examples should include env CA paths and run with env files.
- Existing projects using nested certificate path references should keep running through compatibility parsing, but formatting/suggestions/docs should steer users to native direct path fields.
- mTLS is harder to smoke test automatically in this repo because starting extension-host mock servers requires VS Code context; CLI examples and parser tests cover the pure/runtime path.
