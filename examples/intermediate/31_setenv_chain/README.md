# setenv chain

`setenv` values are usable by the very next step, imported test, or suite item. They live in memory for the run and are never written to env files.

| File | Purpose |
|---|---|
| `server/auth_server.mmt` | Local mock: `POST /login` returns a token, `GET /whoami` requires it |
| `api/login.mmt` | API-level `setenv: session_token` |
| `api/whoami.mmt` | Sends `Bearer <<e:session_token>>` |
| `test/prepare_test.mmt` | Imported test with a `setenv` step |
| `test/login_test.mmt` | Calls login, then whoami, in one run |
| `test/whoami_test.mmt` | Calls whoami only; relies on an earlier suite item |
| `suite.mmt` | Runs login test, then whoami test |

## Run

From the repo root:

```sh
npx testlight run examples/intermediate/31_setenv_chain/suite.mmt \
  --env-file examples/intermediate/31_setenv_chain/env.mmt
```

The suite starts the mock server itself. To run a single test, start `server/auth_server.mmt` first.
