# Environment live variables (`./…mmt`)

Env values that start with `./` and end with `.mmt` are **file-backed**. At run
start each such path becomes a getter in the process env store. Reading
`e:name` runs that file (default inputs) and uses the **first key** under its
`outputs:` (YAML order). The target’s `cache:` controls reuse. A later
`setenv` of `./x.mmt` stays a plain string — only the original env copy turns
paths into getters.

Works for any runnable type with `outputs:` (typically `api` or `test`).

API files in this example call [https://test.mmt.dev/echo](https://test.mmt.dev/echo)
(needs network).

## Structure

```
32_environment_live_variables/
├── multimeter.mmt              # session_api / session_test → ./create_*.mmt
├── create_session_api.mmt      # API → outputs.session (uuid)
├── create_session_test.mmt     # Test → outputs.session (uuid), cache: 2s
├── consume_session_test.mmt    # Asserts both e: values look like UUIDs
├── consume_session_api.mmt     # Optional: post both e: values to echo (Send)
├── suite.mmt                   # Runs consume_session_test
└── README.md
```

## Files

| File | Role |
|---|---|
| `multimeter.mmt` | Env with file-backed `session_api` and `session_test` |
| `create_session_api.mmt` | API that posts `r:uuid` to test.mmt.dev/echo and exposes `session` |
| `create_session_test.mmt` | Test that sets `o:session` to `r:uuid` |
| `consume_session_test.mmt` | Checks `e:session_*` with `=*` UUID regex |
| `consume_session_api.mmt` | Optional API Send demo — body uses `e:session_*` |
| `suite.mmt` | Runs `consume_session_test.mmt` |

## Try it

From the repo root:

```sh
npx testlight run examples/intermediate/32_environment_live_variables/suite.mmt \
  --env-file examples/intermediate/32_environment_live_variables/multimeter.mmt

# Or the test directly
npx testlight run examples/intermediate/32_environment_live_variables/consume_session_test.mmt \
  --env-file examples/intermediate/32_environment_live_variables/multimeter.mmt
```

### In VS Code

1. Open this folder (or the repo) so `multimeter.mmt` is the workspace env.
2. Reload the Environment panel if needed — file-backed values show a **file**
   icon and an underlined, Ctrl/Cmd+clickable path.
3. Run `suite.mmt` or `consume_session_test.mmt`. Optionally Send
   `consume_session_api.mmt` to see both UUIDs in the echo body.

## Notes

- Checks use `=*` (regex), not `== xxx`, so random UUIDs still pass.
- `cache: 2s` on the test target: two `e:session_test` reads in one run match.
