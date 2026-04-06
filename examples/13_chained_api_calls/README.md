# Chained API Calls

Shows how to **chain API calls** — the output of one call feeds into the next. Demonstrates test `outputs`, `set`, `setenv`, and inline `expect`.

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
| `chained_test.mmt` | Calls login, saves `session_token` and `user_id` into test outputs, promotes `auth_token` with `setenv`, then calls get_profile |

## Key concepts

- **Step output chaining** — `${auth.token}` and `${auth.user_id}` read values from the `login` call result.
- **Test outputs** — the test declares top-level `outputs` (`session_token`, `user_id`) and fills them with `set` so they can be reused later in the flow.
- **`setenv`** — promotes `${auth.token}` into the environment as `auth_token` so downstream APIs or tests can use `e:auth_token` or `<<e:auth_token>>`.
- **Inline `expect`** — validates outputs directly on a `call` step without a separate `assert`/`check`. In this example it checks that `token` and `name` are not null.

## Flow summary

1. `login` is called with `username` and `password` inputs.
2. The call verifies `token: != null` with inline `expect`.
3. `set` copies `${auth.token}` and `${auth.user_id}` into the test outputs `session_token` and `user_id`.
4. `setenv` promotes the token as `auth_token`.
5. `getProfile` is called with `${session_token}` and `${user_id}`.
6. The second call verifies `name: != null` with inline `expect`.

## How to use

### In VS Code

1. Open `chained_test.mmt` and click **Run**.
2. The Log panel shows both API calls, the inline expect results, and the populated test outputs.

### With the CLI

```sh
npx testlight run examples/13_chained_api_calls/chained_test.mmt
```

Override credentials:

```sh
npx testlight run examples/13_chained_api_calls/chained_test.mmt \
  -e username=bob@example.com -e password=hunter2
```
