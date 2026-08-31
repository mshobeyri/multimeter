# Vault over HTTP + setenv

Shows how to treat **HashiCorp Vault / OpenBao** as a normal HTTP API, then promote the secret into the environment with **`setenv`** — no special Vault protocol required.

The runnable path uses a **local mock** that returns a Vault KV v2 JSON shape and a bearer-protected probe. Point the same APIs at a real Vault / [test.mmt.dev](https://test.mmt.dev) when you are ready.

## Flow

1. Mock (or Vault) serves `GET /v1/secret/data/mmt` with `X-Vault-Token`
2. `vault_kv_read.mmt` extracts `body.data.data.token` and can `setenv` it as `api_token`
3. `bearer_with_env_token.mmt` calls a protected URL with `e:api_token`

## Files

| File | Purpose |
|---|---|
| `server/vault_kv_mock.mmt` | Local Vault KV v2–shaped mock + bearer probe on port `9108` |
| `api/vault_kv_read.mmt` | HTTP read + `outputs` / `setenv` |
| `api/bearer_with_env_token.mmt` | Uses `e:api_token` against the protected probe |
| `env.mmt` | Default `vault_addr` / `vault_token` / path for the mock |
| `vault_to_api_test.mmt` | End-to-end: mock → read → setenv → bearer check |

## Run (mock — no Vault install)

From the repo root:

```sh
npx testlight run examples/professional/10_vault_http_setenv/vault_to_api_test.mmt \
  --env-file examples/professional/10_vault_http_setenv/env.mmt \
  --preset runner.mock
```

Expected: Vault mock returns `testtoken`, setenv stores it, bearer check succeeds.

### In VS Code

1. Open `vault_to_api_test.mmt` (or start `server/vault_kv_mock.mmt` yourself).
2. Open `api/vault_kv_read.mmt`, load `env.mmt` / preset `runner.mock`, then **Send** — `setenv` fills `api_token` in the workspace environment.
3. Open `api/bearer_with_env_token.mmt` and **Send**.

## Use a real Vault / OpenBao

Same API file; override env (token never committed):

```sh
npx testlight run examples/professional/10_vault_http_setenv/api/vault_kv_read.mmt \
  -e vault_addr=https://vault.example.com:8200 \
  -e vault_token="$VAULT_TOKEN" \
  -e vault_secret_path=mmt
```

Or in VS Code: set those variables in the Environment panel, then Send `vault_kv_read.mmt`. KV v2 path and `body.data.data.*` extraction stay the same for OpenBao.

Optional: after setenv, point `bearer_with_env_token.mmt` at `https://test.mmt.dev/auth/bearer` (sandbox expects `Bearer testtoken`).

## Why this pattern

- Vault’s API is already HTTP — Multimeter does not need `protocol: vault`
- `setenv` is the write path into the same env bag that `e:` reads
- Pipelines can still fetch outside Multimeter and pass `-e`; this example shows the in-product equivalent
