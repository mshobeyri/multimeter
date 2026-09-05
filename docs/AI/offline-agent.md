# Offline / no-MCP agent profile

Use this when Multimeter MCP is **not** registered, or the host cannot call MCP tools.

## Prefer MCP when available

If Multimeter MCP tools exist (`scaffold_test`, `validate`, `run`, …), use those first. See `agent-workflow.md`.

## Offline loop

```
testlight docs <topic>          # local syntax (pack min by default)
testlight scaffold test --from <api.mmt> [-o path]
# patch the file if needed
testlight validate <file.mmt>
testlight run <file.mmt>        # only when asked to execute
```

### Topics

`overview` | `workflow` | `test` | `api` | `suite` | `env` | `doc` | `loadtest` | `constraints`

```
testlight docs test
testlight docs api --pack full
```

## Hard rules

1. Do **not** open mmt.dev / GitHub / web search for Multimeter YAML syntax.
2. New tests from an API: **scaffold first** — do not invent blank YAML.
3. Modify: **patch only** — do not rewrite the whole file.
4. Always **validate** before claiming done.
5. Set `MMT_GUIDES_DIR` if guides are not next to the CLI binary.

## Guides location

`testlight docs` reads from, in order:

1. `MMT_GUIDES_DIR`
2. Guides bundled next to the CLI (`guides/` beside `cli.js`)
3. Repo `docs/AI` when developing from source
