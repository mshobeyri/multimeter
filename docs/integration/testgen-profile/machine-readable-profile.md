# Machine-readable profile

The companion YAML lives at `.mmt/testgen.profile.yaml` and is used by tools for deterministic behavior. Keep the YAML as the source of truth for settings and update this document for rationale and examples.

### Skeletons
Starter templates are included for quick scaffolding:

- api
  - Minimal HTTP API with inputs just after title/description; empty headers/query/body ready to fill
- test
  - Simple flow calling one API and asserting status 200
- env
  - Basic environment with `api_url` and optional `token`
- doc
  - Minimal doc pointing to `./examples`

Tools can substitute placeholders like `${TITLE}`, `${DESCRIPTION}`, and `${API_NAME}` before writing files.
