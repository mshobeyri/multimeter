# HTTP body formats

Intermediate example covering every HTTP request `format:` — `json`, `xml`, `xmle`, `text`, `urlencoded`, `binary`, and `multipart`.

All requests POST to [test.mmt.dev/echo](https://test.mmt.dev/echo) and read fields back from the echoed payload.

## Files

| File | `format` | What it demonstrates |
|------|----------|----------------------|
| `post_json.mmt` | `json` | YAML object → JSON (default) |
| `post_xml.mmt` | `xml` | YAML object → XML with self-closing empty tags (`<meta/>`) |
| `post_xmle.mmt` | `xmle` | YAML object → XML with explicit closing tags (`<meta></meta>`) |
| `post_text.mmt` | `text` | Raw string body |
| `post_urlencoded.mmt` | `urlencoded` | YAML object → `application/x-www-form-urlencoded` |
| `post_binary.mmt` | `binary` | Relative file path → raw bytes (`./assets/payload.bin`) |
| `post_multipart.mmt` | `multipart` | Parts array with text `value` and file `file` |
| `assets/sample.txt` | — | File part for multipart |
| `assets/payload.bin` | — | Binary body payload |
| `body_formats_test.mmt` | — | Runs one step per format |

## How to use

### In VS Code

Open any `post_*.mmt` file and click **Send**, or open `body_formats_test.mmt` and click **Run** to exercise every format in one flow.

### With the CLI

From the repo root (built-in CLI from this workspace):

```sh
node mmtcli/dist/cli.js run examples/intermediate/28_http_body_formats/body_formats_test.mmt
```

Run a single format:

```sh
node mmtcli/dist/cli.js run examples/intermediate/28_http_body_formats/post_urlencoded.mmt
```

Published CLI (requires a release with the relevant format support):

```sh
npx testlight run examples/intermediate/28_http_body_formats/body_formats_test.mmt
```

## Key concepts

- **`format`** controls encoding and default `Content-Type`. See [Format](../../../docs/files/api/body/format.md).
- **`json` / `urlencoded`** — write a YAML object; Multimeter encodes it at send time.
- **`xml` / `xmle`** — same YAML object, different empty-element rules.
- **`text`** — `body` is a literal string (or input reference).
- **`binary`** — `body` is a relative file path; bytes load at send time.
- **`multipart`** — `body` is a parts array mixing text fields and file paths.

See also: [HTTP bodies](../../../docs/files/api/protocols/http-bodies.md) · [Request body](../../../docs/files/api/body/body.md)
