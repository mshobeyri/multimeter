# Agent workflow (min)

MCP-first when Multimeter MCP is registered.

| Intent | First tool | Then |
|--------|------------|------|
| Test from API | `scaffold_test` | Write yaml → minimal edits → `validate` |
| Inspect API | `api_card` | Prefer card over full file dump |
| Modify `.mmt` | patch file | `validate` |
| Run | `run` | report tool JSON |

Offline (no MCP): `testlight docs <topic>` → `testlight scaffold test --from` → edit → `testlight validate`.

Hard rules: no web search for syntax; no blank-page test invent; no full-file rewrite on modify.
