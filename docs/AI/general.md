This folder teaches an AI how to **answer questions** about Multimeter and decide **when to generate or edit** `.mmt` files.

For actual YAML generation or modification, always go through `AI/generate.md`.

The AI should:
- Understand what each `type` (`api`, `test`, `env`, `doc`, `suite`) is for.
- Decide whether the user needs **an explanation** or **new/edited YAML**.
- Minimize tokens by reading only the specific generator file it needs.

Short mental model of file types:
- `type: api` → describe one HTTP/WebSocket endpoint.
- `type: test` → describe flows that call APIs/tests and assert behavior.
- `type: env` → define environment variables and presets.
- `type: doc` → describe documentation over existing `.mmt` files.
- `type: suite` → group and run multiple tests, APIs, or other suites.

When you are the AI, follow these rules:

1. **Decide intent first**
	- If the user asks "how" or "why" (no explicit request to create/edit a file):
	  - Explain concepts in plain language.
	  - Use small inline examples.
	  - Do **not** open generator files unless you need exact shapes.
	- If the user explicitly asks to create/edit a `.mmt` file:
	  - Open **`AI/generate.md`**.
	  - Follow its instructions to choose the type and generator.

2. **Token conventions (snake_case)**
	- Always show environment tokens in **snake_case**, for example:
	  - `e:api_url`, `e:auth_token`, `e:user_id`.
	  - Embedded: `<<e:api_url>>/users`, `Bearer <<e:auth_token>>`.
	- Inputs: `i:user_id`, `<<i:user_id>>`.
	- Random values: `r:uuid`, `r:first_name`, `r:last_name`, `r:epoch_ms`.
	- Current/time values: `c:date`, `c:epoch`, `c:epoch_ms`.
	- Use bare tokens as standalone YAML values; use `<< >>` only when embedding inside larger strings.

3. **Answering common question types**
	- "How do I call this endpoint?"
	  - Explain briefly.
	  - If the user wants a file, go to `generate.md` and build a `type: api` example.
	- "How do I write a test that does X then Y?"
	  - Explain tests and flows.
	  - If a file is requested, go to `generate.md` and build a `type: test` example.
	- "How do I manage/dev/prod environments?"
	  - Explain env files and presets.
	  - If a file is requested, go to `generate.md` and build a `type: env` example.
	- "How do I generate API docs?"
	  - Explain doc files.
	  - If a file is requested, go to `generate.md` and build a `type: doc` example.
	- "How do I run multiple tests together?"
	  - Explain suite files.
	  - If a file is requested, go to `generate.md` and build a `type: suite` example.

4. **Safety and style**
	- Use 2‑space indentation in all YAML examples.
	- Prefer small, focused examples.
	- Do not invent new fields or token formats.
	- When unsure, propose the **minimal valid change** and explain it.

Your goal here is to **decide what to do** and provide good explanations; when it is time to actually write YAML, defer to `AI/generate.md` and the more detailed `AI/generate-*.md` files.