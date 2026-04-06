# Stages and Conditions

Demonstrates **parallel stages** with `after` dependencies and **conditional stage execution** using `condition`.

## Structure

```
15_stages_and_conditions/
├── api/
│   ├── login.mmt               # Login API
│   ├── get_profile.mmt         # Profile API
│   └── get_settings.mmt        # Settings API
├── stages_test.mmt              # Test with parallel stages, after, and condition
└── README.md
```

## Files

| File | Description |
|---|---|
| `api/login.mmt` | Simulates login, outputs a token |
| `api/get_profile.mmt` | Fetches profile using a token |
| `api/get_settings.mmt` | Fetches settings using a token |
| `stages_test.mmt` | Three stages: `auth` runs first, then `profile` and `settings` run in parallel after auth succeeds |

## Execution flow

```
auth (login)
  ├── condition met ──► profile  ┐
  │                               ├── run in parallel
  └── condition met ──► settings ┘
```

1. **auth** stage runs first (login).
2. **profile** and **settings** both have `after: auth` — they wait for auth to finish.
3. Both have `condition: doLogin.status_code == 200` — they are skipped if login fails.
4. Once auth passes, profile and settings run **in parallel**.

## Key concepts

- **`stages`** — groups of steps that start concurrently by default.
- **`after`** — declares a dependency so the stage waits for another stage to complete first. Can be a single string or an array.
- **`condition`** — skips the stage if the expression is false. Uses the same syntax as `assert`/`check`.
- **Parallelism** — stages without `after` dependencies run simultaneously. Stages with the same `after` also run in parallel with each other.

## How to use

### In VS Code

1. Open `stages_test.mmt` and click **Run**.
2. The Flow panel shows the stage graph with dependencies.

### With the CLI

```sh
npx testlight run examples/17_stages_and_conditions/stages_test.mmt
```
