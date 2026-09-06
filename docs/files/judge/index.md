# Judge

Use `type: judge` to define **who** evaluates non-deterministic responses (engine, model, URL, auth). Test steps use [`judge`](../test/steps/judge.md) with **`context`**, soft **`expect`**, and hard **`require`**.

Multimeter does not host models. Bring your own subscription (OpenAI, Anthropic, Gemini, Azure) or run a local engine such as **Ollama**.

Deterministic validation stays on [`check`](../test/steps/check.md) / [`assert`](../test/steps/assert.md). Use judge steps when equality and fuzzy operators are not enough.

## Example (Ollama)

```yaml
type: judge
title: Local quality judge
engine: ollama
model: qwen3:4b
url: e:ollama_url
options:
  temperature: 0
  timeout: 30s
```

Environment:

```yaml
# in a type: env file or CLI -e
ollama_url: http://127.0.0.1:11434
```

## Example (OpenAI)

```yaml
type: judge
title: OpenAI quality judge
engine: openai
model: gpt-4o-mini
url: https://api.openai.com/v1
auth:
  type: bearer
  token: e:openai_api_key
options:
  temperature: 0
  timeout: 30s
```

## Fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | yes | Must be `judge` |
| `engine` | yes | `ollama`, `openai`, `anthropic`, `google`, `azure-openai` |
| `model` | yes | Model id / name (Azure: deployment name) |
| `url` | yes | Base URL for the engine HTTP API |
| `auth` | no | Same shape as API `auth` (e.g. bearer token for OpenAI) |
| `options` | no | e.g. `temperature`, `timeout` (`30s`, ms number) |
| `title` / `description` / `tags` | no | Metadata |
| `defaults` | no | Optional default `checks` / `criteria` merged into steps |

## Built-in checks (used from steps)

Judge **steps** score named metrics under `expect` / `require`. Built-ins:

| Check | Meaning |
|-------|---------|
| `semanticSimilarity` | `actual` ≈ `expected` in meaning |
| `answerRelevance` | `actual` answers `question` |
| `contextFaithfulness` | `actual` grounded in `policy` / `retrievedContext` |
| `factuality` | `actual` factually consistent with ground truth |

See [Judge steps](../test/steps/judge.md) for full details. Free-text `criteria` remain available for custom rules.

## Engines

### Ollama

Uses `POST {url}/api/chat` with JSON output. Typical URL: `http://127.0.0.1:11434` via `e:ollama_url`. Auth is usually omitted.

### OpenAI

Uses `POST {url}/chat/completions` with `response_format: json_object`. Typical URL: `https://api.openai.com/v1` and `auth.type: bearer`.

### Anthropic

Uses `POST {url}/v1/messages`. Typical URL: `https://api.anthropic.com`. Prefer `auth.type: api-key` with header `x-api-key` (bearer token also maps to `x-api-key`).

### Google (Gemini)

Uses `POST {url}/models/{model}:generateContent` with JSON mime type. Typical URL: `https://generativelanguage.googleapis.com/v1beta`. Prefer `auth.type: api-key` with header `x-goog-api-key`.

### Azure OpenAI

Uses `POST {url}/openai/deployments/{model}/chat/completions?api-version=…`. `model` is the **deployment name**. Prefer `auth.type: api-key` with header `api-key`.

## Related

- [Judge steps](../test/steps/judge.md)
- [Import](../test/import.md)
