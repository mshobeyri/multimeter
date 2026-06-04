# Manual Timeout

This example shows how to override the default request timeout for one API request.

## Files

| File | Description |
|---|---|
| `manual_timeout.mmt` | Calls the public test endpoint with `timeout: 5000` and extracts status and duration outputs |

## How To Use

Open `manual_timeout.mmt` and run it from VS Code, or use the CLI:

```sh
npx testlight run examples/intermediate/21_manual_timeout/manual_timeout.mmt
```

## Key Concept

- `timeout` is a per-request override in milliseconds.
- If omitted, Multimeter uses `setting.http.timeout` from the env file, or the built-in default of `30000` milliseconds.
