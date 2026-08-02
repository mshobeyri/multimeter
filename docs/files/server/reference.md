# Reference (types)
- `type:` `server`
- `title:` string
- `description:` string (supports Markdown)
- `tags:` string[]
- `import:` record&lt;string, string&gt; — see [Data imports](../../features/data-imports.md)
- `protocol:` `http` | `https` | `ws` | env token (`e:MOCK_PROTOCOL` / `<<e:MOCK_PROTOCOL>>`; default `http`)
- `port:` number (1–65535) | env token (`e:MOCK_PORT` / `<<e:MOCK_PORT>>`) — required
- `connection:` object — see [TLS](./tls.md)
  - `mode:` `plain` | `tls` | `mtls` (default `plain`; `https` implies `tls` when omitted)
  - `cert:` string (path relative to the `.mmt` file)
  - `key:` string
  - `client_ca:` string (required when `mode` is `mtls`)
- `cors:` boolean
- `delay:` number (global response delay in ms; default `0`)
- `headers:` record&lt;string, string&gt; (applied to all endpoint responses)
- `endpoints:` array of endpoint objects — see [Endpoints](./endpoints.md)
- `proxy:` string (forward unmatched requests to a real backend URL)
- `fallback:` object (response when no endpoint matches)
  - `status:` number (default `404`)
  - `format:` `json` | `xml` | `xmle` | `text` | `urlencoded`
  - `headers:` record&lt;string, string&gt;
  - `body:` string or object

## HTTP endpoint (`protocol:` `http` | `https`)
- `method:` HTTP verb | env token — required unless `reflect: true`
- `path:` string — required (supports `:param` segments)
- `name:` string (optional label; must be unique within the file)
- `match:` object (all listed rules must match)
  - `body:` record&lt;string, JSONValue&gt;
  - `headers:` record&lt;string, string&gt;
  - `query:` record&lt;string, string&gt;
- `status:` number (100–599; default `200`)
- `format:` `json` | `xml` | `xmle` | `text` | `urlencoded`
- `headers:` record&lt;string, string&gt;
- `body:` string or object (supports `${url.*}`, `${body.*}`, `${header.*}`, `${query.*}`, `e:`, `r:`, `c:` — see [Tokens](./tokens.md))
- `delay:` number (per-endpoint delay in ms)
- `reflect:` boolean (echo the request back as the response)

## WebSocket endpoint (`protocol:` `ws`)
- `path:` string — required
- `reflect:` boolean
- `body:` string or object (initial/connect response)
- `format:` `json` | `xml` | `xmle` | `text` | `urlencoded`
- `messages:` array of { `match?`, `body?`, `format?`, `delay?` } (reply rules for incoming messages)

Notes:
- Mock server files are not run directly from the CLI — they start from tests (`run` step) or suites (`servers:` / inline items). See [CLI](./cli.md).
- `port` and `protocol` accept env tokens resolved at runtime from the active environment.
- YAML comments (`#`) are preserved when you format the file (Format Document).

---
