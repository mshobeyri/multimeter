# Agent workflow (min)

MCP-first when Multimeter MCP is registered.

| Intent | First tool | Then |
|--------|------------|------|
| Test from API | `scaffold_test` | Write yaml → **`validate` → `format`** |
| Few-shot | `list_examples` | Mirror `goldenSmoke` |
| Inspect API | `api_card` | Prefer card over full file dump |
| Tighten asserts | `suggest_assertions` | Patch → **`validate` → `format`** |
| Modify `.mmt` | **patch only** | **`validate` → `format`** (no full rewrite) |
| Run | `run` | tool JSON; then suggest_assertions if asked |

Offline: `testlight docs` → `scaffold` → edit → `validate`.

Hard rules: no web search; no blank-page invent; modify = patch only unless user asks to rewrite.
