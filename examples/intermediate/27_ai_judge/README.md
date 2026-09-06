# AI Judge (Ollama)

Demonstrates `type: judge` with a `judge` step using soft **`expect`** and hard **`require`** (one report box).

## Setup

1. Install and run [Ollama](https://ollama.com/) on `http://127.0.0.1:11434`.
2. Pull a model, e.g. `ollama pull qwen2.5:3b` (or match `model:` in `judges/local.mmt`).

## Files

| File | Role |
|------|------|
| `judges/local.mmt` | Judge resource (`engine: ollama`) |
| `judge_demo.mmt` | Test with context / expect / require |

## Run

```bash
npx testlight run examples/intermediate/27_ai_judge/judge_demo.mmt
```

Without Ollama, unit tests in `core` mock the HTTP layer; this example needs a live model.
