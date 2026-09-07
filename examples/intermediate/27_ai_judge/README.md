# AI Judge

Demonstrates `type: judge` with a `judge` step using soft **`expect`** and hard **`require`** (one report box).

The demo imports both judges and runs **Gemini**. Change `judge: gemini` to `judge: ollama` to use the local engine.

## Setup (Gemini — default)

1. Create an API key at [Google AI Studio](https://aistudio.google.com/apikey).
2. Set `api_key` in a `type: env` file or the Environment panel, then Reload.

## Setup (Ollama)

1. Install and run [Ollama](https://ollama.com/) on `http://127.0.0.1:11434`.
2. Pull a model matching `model:` in `judges/ollama.mmt`, e.g. `ollama pull qwen2.5-coder:7b`.

## Files

| File | Role |
|------|------|
| `judges/gemini.mmt` | Judge resource (`engine: google`, used by the demo) |
| `judges/ollama.mmt` | Judge resource (`engine: ollama`) |
| `judge_demo.mmt` | Test with context / expect / require |

## Run

```bash
npx testlight run examples/intermediate/27_ai_judge/judge_demo.mmt
```

Without a live engine, unit tests in `core` mock the HTTP layer; this example needs Gemini or Ollama.
