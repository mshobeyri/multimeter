# Environment
Acts as a global store for variables to read and write across tests. Like any global scope, use it sparingly. Prefer it for shared configuration (for example: base URLs, modes, timeouts) rather than per-step data.


## Define an environment file
```yaml
type: env
variables:
  API_URL: "http://localhost:8080"
  USER: "alice"
  PASS: "secret"
  MODE:
    dev: "debug"      # map of named choices
    prod: "release"
  TIMEOUTS:
    - 1000            # list of allowed values (optional)
    - 2000
presets:
  runner:
    dev:
      API_URL: dev    # picks choice "dev" when the variable is defined as a mapping
      MODE: dev
    prod:
      API_URL: prod
      MODE: prod
```

Notes
- `variables` values can be:
  - scalar (string/number/bool/null)
  - object map (named choices)
  - array list of allowed values
- `presets` groups can be hierarchical; `runner.dev` is a common pattern
 
## Usage
Supported token forms in tests and APIs:
- `<<e:VAR>>`
- `e:VAR` when used as a value after `: ` (colon + space), for example `value: e:VAR`.

What to use when
- Use `<<e:VAR>>` when you want substitution anywhere in a string (inside URLs, headers, or other text).
- Use `e:VAR` only when it appears as the entire value after `: `; types are preserved (numbers, booleans, strings).

Notes
- `e:VAR` is not replaced inside plain text like `hi:e:VAR there`; it must follow `: `.
- `e:{VAR}` and `{{VAR}}` are not supported.

Examples:
```yaml
url: <<e:API_URL>>/login
headers:
  Authorization: Bearer <<e:TOKEN>>
body:
  username: e:USER
  password: e:PASS
```

## Using presets and overrides in CLI
Use preset from env file:
```sh
 testlight run tests/login.mmt --env-file env.mmt --preset runner.dev
```

Override values explicitly (wins over preset):
```sh
 testlight run tests/login.mmt --env-file env.mmt --preset runner.dev \
  -e API_URL http://localhost:8080 -e USER bob
```
Without env file, pass env directly:
```sh
 testlight run tests/login.mmt -e API_URL=http://localhost:8080 -e USER=alice -e PASS='00123'
```

Typing rules for CLI values
- Unquoted numbers and booleans are coerced (e.g., `true`, `42`).
- Quoted numbers remain strings (e.g., `'00123'`).

## Edit environments in the UI
- You can modify variables and set presets using the UI panels.
- From the Environment panel, you can pick preset groups and values, then:
  - Click "Set To Workspace" to apply your changes to the Environment Variables workspace.
  - Click "Clear Workspace" to clear the Environment Variables from workspace.


![Environment panel](../screenshots/environment_panel.png)

- You can change variable selections and values directly in the Environment Variables panel. Choices (like url/test_type) are offered as dropdowns; plain values can be edited inline. Edits are saved back to your `.mmt` env file.

![Environment variables UI](../screenshots/environment_variables_ui.png)

## Promote values to env during runs
In API definitions, use `setenv` to capture values from responses for later steps.
```yaml
setenv:
  TOKEN: body[token]
```

## Certificates

SSL/TLS certificate settings can be configured in the `certificates` section of the env file. See [Certificates documentation](./certificates-mmt.md) for details on configuring CA certificates, client certificates (mTLS), and SSL validation settings.

## Reference (types)
- type: `env`
- variables: record<string, string | object (choices) | array (allowed values)>
- presets: record<string, record<string, record<string, string|number|boolean|null>>>
- certificates: { ca?, clients?, sslValidation?, allowSelfSigned? }

## Project Root Marker

A file named `multimeter.mmt` (with `type: env`) placed at the root of your project serves as the **project root marker**. This enables:

1. **Workspace environment loading**: When configured, VS Code will automatically load variables, presets, and certificates from `multimeter.mmt` into workspace storage on project open. Configure the path using `multimeter.workspaceEnvFile` setting (default: `multimeter.mmt` at project root).

2. **Project root imports**: In test and API files, you can use `+/` prefix to import files relative to the project root (where `multimeter.mmt` exists) instead of relative to the current file.

Example project structure:
```
project/
├── multimeter.mmt          # Project root marker
├── apis/
│   ├── auth.mmt
│   └── users.mmt
└── tests/
    └── auth/
        └── login_test.mmt  # Can use +/apis/auth.mmt
```

In `tests/auth/login_test.mmt`:
```yaml
import:
  auth: +/apis/auth.mmt     # Resolves to project/apis/auth.mmt
```

See [Test documentation](./test-mmt.md#import) for more details on import paths.

