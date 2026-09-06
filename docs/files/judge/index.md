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
| `engine` | yes | `ollama` (v1). Later: `openai`, `anthropic`, `google`, `azure-openai` |
| `model` | yes | Model id / name for that engine |
| `url` | yes | Base URL for the engine HTTP API |
| `auth` | no | Same shape as API `auth` (e.g. bearer token for OpenAI) |
| `options` | no | e.g. `temperature`, `timeout` (`30s`, ms number) |
| `title` / `description` / `tags` | no | Metadata |
| `defaults` | no | Optional default `checks` / `criteria` merged into steps |

## Engines

### Ollama (v1)

Uses `POST {url}/api/chat` with JSON output. Typical URL: `http://127.0.0.1:11434` via `e:ollama_url`. Auth is usually omitted.

### Cloud engines

OpenAI / Anthropic / Google / Azure adapters are planned. Same top-level shape (`engine`, `model`, `url`, `auth`, `options`); each adapter validates its own connection fields.

## Related

- [Judge steps](../test/steps/judge.md)
- [Import](../test/import.md)
