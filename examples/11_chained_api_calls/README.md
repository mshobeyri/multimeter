# Chained API Calls

Shows how to **chain API calls** — the output of one call feeds into the next. Demonstrates `set`, `setenv`, and inline `expect`.

## Structure

```
11_chained_api_calls/
├── api/
│   ├── login.mmt              # POST login, outputs token + user_id
│   └── get_profile.mmt        # POST profile lookup using token
├── chained_test.mmt            # Test that chains login → profile
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/login.mmt` | Sends credentials, extracts `token` and `user_id` from the response |
| `api/get_profile.mmt` | Uses a token and user_id to fetch a profile |
| `chained_test.mmt` | Calls login, captures outputs with `set`, promotes token with `setenv`, then calls get_profile |

## Key concepts

- **Output chaining** — `${step_id.output_name}` references a previous call's output in a later step's inputs.
- **`set`** — stores values in named variables for reuse across steps.
- **`setenv`** — promotes a runtime value to an environment variable so downstream calls can use `e:VAR` or `<<e:VAR>>`.
- **Inline `expect`** — validates outputs directly on a `call` step without a separate `assert`/`check`. Non-throwing — logs failures but continues.

## How to use

### In VS Code

1. Open `chained_test.mmt` and click **Run**.
2. The Log panel shows both API calls and the inline expect results.

### With the CLI

```sh
npx testlight run examples/11_chained_api_calls/chained_test.mmt
```

Override credentials:

```sh
npx testlight run examples/11_chained_api_calls/chained_test.mmt \
  -e username=bob@example.com -e password=hunter2
```
