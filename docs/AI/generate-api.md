This file tells the AI how to generate **`type: api`** `.mmt` files.

Always follow these rules:
- Output must be valid YAML.
- The **first non-comment line** must be `type: api`.
- Prefer explicit, descriptive names and short, readable examples.
- Only include fields that make sense for the user’s request.

---

## Schema (mental model for the AI)

These fields mirror the internal `api` data model.

Top‑level keys and types (with descriptions the AI should remember):

```yaml
type: api                      # REQUIRED. Declares this file as an API description.

# Documentation / metadata (optional but recommended)
title: string                  # Short human title, e.g. "Login API" or "List users".
description: string            # 1–3 sentence explanation of what this endpoint does.
tags:                          # Optional tags for search/filters (e.g. [auth, smoke]).
	- string

# Reuse / composition
import:                        # Optional. Map of aliases to other .mmt files this API depends on.
	<alias>: path/to/file.mmt
inputs:                        # Optional. Input parameters for this API, with default values.
	<name>: JSON value           # string | number | boolean | null | object.
outputs:                       # Optional. Named values extracted from the response (body/headers/cookies).
	<name>: string               # Extractor expression, e.g. body[token] or body[/regex_pattern/]
setenv:                        # Optional. Promote outputs into environment variables for later steps/tests.
	<env_name>: <output_name>    # env_name is snake_case; output_name must exist in outputs.

# Request description (REQUIRED)
url: string                    # REQUIRED. Full or relative URL; may include env/input tokens like <<e:api_url>>.
query:                         # Optional. Query parameters appended to url; merged with any inline query string.
	<name>: string               # Value is always a string expression (can contain tokens).
protocol: http | ws            # Optional. "http" for HTTP(S); "ws" for WebSocket.
                               # Inferred from URL if omitted: ws:// or wss:// → ws, otherwise http.
format: json | text | xml | xmle      # REQUIRED. Controls how body is encoded/decoded (JSON object vs raw text/XML).
method:                        # HTTP method (REQUIRED when protocol is http).
	get | post | put | delete | patch | head | options | trace
headers:                       # Optional. HTTP/WS headers to send with the request.
	<Header-Name>: string        # Values can include tokens; header names are case-insensitive.
cookies:                       # Optional. HTTP cookies to send.
	<cookie_name>: string
body: object | string | null   # Optional. Request body (HTTP) or initial WS message; type depends on format.

# Examples (optional)
examples:                      # Optional. Example invocations for smoke tests / documentation.
	- name: string               # REQUIRED per example. Identifier used in UI/CLI.
		description?: string       # Optional explanation for this example.
		inputs?: object            # JSON record overriding top-level inputs for this example.
		outputs?: object           # JSON record of expected outputs for this example.
```

Notes for the AI:
- `inputs`, `setenv`, and `examples` are optional but powerful when the user wants reusable APIs or smoke‑testable examples.
- `import` is rarely needed when the user only describes a single endpoint.

---

## When to use which fields

- Use **`title`** and **`description`** whenever the user describes intent or business meaning (`"login endpoint"`, `"create user"`, etc.).
- Use **`tags`** when the user mentions categories like "smoke", "load", "auth", "payments".
- Use **`inputs`** when the user expects to change parameters between runs (username, pagination, filters, ids, etc.).
- Use **`outputs`** + **`setenv`** when the user wants to **capture response data** for later steps (e.g. tokens, IDs).
- Use **`examples`** when the user asks for **examples, smoke tests, or sample calls**.
- Use **`protocol: ws`** when the user asks for **websocket api**. For **REST or SOAP api**, protocol can be omitted (defaults to http based on URL).


If the user gives:
- **Only URL + method** → make a minimal file: `type`, `title`, `format`, `method`, `url` (protocol is inferred).
- **Request + response contract** → also add `inputs`, `outputs`, maybe `setenv`.
- **Multiple usage scenarios** → use `examples` to capture them.

---

## Tokens the AI can use

The API body, headers, query, cookies, and url can contain tokens:

- Environment variables: `e:api_url`, `e:auth_token`, etc., or `<<e:api_url>>`
- Test/API inputs: `i:var` or `<<i:var>>`
- Random values: `r:name` or `<<r:name>>`
- Current/time values: `c:name` or `<<c:name>>`

Guidelines:
- If a value **is exactly** a single token (e.g. `username: i:user` or `id: r:int`), do **not** quote it unless the surrounding examples already use quotes.
- If a token is used **inside text**, wrap it as `<<token>>`, for example:
	- `url: <<e:api_url>>/users/<<i:user_id>>`
	- `x-request-id: req-<<r:uuid>>`

Common random tokens: `r:uuid`, `r:int`, `r:bool`, `r:email`, `r:phone`, `r:first_name`, `r:last_name`, `r:full_name`, `r:epoch`, `r:epoch_ms`.
Common current tokens: `c:date`, `c:time`, `c:epoch`, `c:epoch_ms`.

Do **not** invent new token syntaxes.

---

## Authoring patterns for common requests

### 1. Simple GET with query and headers

Use when the user asks for something like “GET `/users` with pagination and auth header”.

```yaml
type: api
title: List users
description: Returns a paginated list of users.
tags: [users, list]
inputs:
	limit: 20
	page: 1
url: <<e:api_url>>/users
protocol: http
format: json
method: get
headers:
	authorization: Bearer <<e:auth_token>>
query:
	limit: "<<i:limit>>"
	page: "<<i:page>>"
```

### 2. Login POST with JSON body and extracted token

Use when the user describes a login/auth endpoint that returns a token.

```yaml
type: api
title: Login
description: Authenticate user and return a session token.
tags: [auth, login]
inputs:
	username: user@example.com
	password: string
outputs:
	token: body[token]
	status: body[status]
setenv:
	auth_token: token
url: <<e:api_url>>/login
protocol: http
format: json
method: post
headers:
	content-type: application/json
body:
	username: i:username
	password: i:password
examples:
	- name: valid-user
		description: Login with a valid account.
		inputs:
			username: alice@example.com
			password: secret
	- name: invalid-password
		description: Login with wrong password.
		inputs:
			username: alice@example.com
			password: wrong
```

### 3. Raw text or XML body

Use `format: text`, `format: xml`, or `format: xmle` when the user explicitly mentions plain text, HTML, or XML bodies. Use `xmle` when expanded empty tags are required.

```yaml
type: api
title: Echo text
description: Send and echo back a plain text payload.
protocol: http
format: text
method: post
url: <<e:api_url>>/echo
body: |
	hello world
```

```yaml
type: api
title: Submit XML payload
description: Send an XML document as the request body.
protocol: http
format: xml
method: post
url: <<e:api_url>>/xml
body: |
	<root>
		<value>42</value>
	</root>
```

### 4. WebSocket connection description

Use when the user describes WS endpoints (chat, notifications, streams). Actual send/receive flows are usually defined in `type: test` files calling this API.

```yaml
type: api
title: Notifications stream
description: WebSocket stream of user notifications.
protocol: ws
format: json
url: wss://example.com/notifications
```

---

## Style rules for the AI

- Prefer **2 spaces** for indentation.
- Avoid trailing spaces.
- Prefer lower‑case, hyphen‑separated tags (e.g. `smoke`, `auth`, `user-profile`).
- Keep titles short (3–6 words) and descriptions 1–3 sentences.
- Do **not** add YAML comments (`#`). Multimeter's formatter removes them on reformat, so they will always be lost. Use the `description` field instead.

When unsure, **favor simpler files** with fewer fields rather than guessing complex outputs or headers.
