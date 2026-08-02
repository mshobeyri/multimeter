# What gets generated: APIs, Tests, Environments

This profile guides three artifact types. For full syntax and capabilities, see:
- API files: see docs/files/api/index.md
- Test files: see docs/files/test/index.md
- Environment files: see docs/files/env/index.md

### APIs
- Inputs are placed right after title/description for readability
- Base request is parameterized; examples override only changed inputs
- Default headers can be blocked via `_` when needed
- Random/current tokens (r:/c:) are encouraged for stable, useful data

Generation knobs (see YAML profile):
- includeExamples: whether to emit examples blocks
- includeDocs: whether to add title/description/tags scaffolding
- defaults.headers.block: list of headers to block by default

### Tests
- Suites: smoke (required), negative/boundary (optional) as configured
- Flow style: sequential by default; stages/parallel when explicitly enabled
- Assertions: assert by default; checks can be used for non-fatal validations (e.g., response content checks)
- Chaining: Supported via outputs/inputs in test steps (see docs/files/test/index.md)

Generation knobs (see YAML profile):
- strategy.suites: controls which suites to generate and selection rules
- test.layout: sequential vs staged, assert vs check
- naming: patterns for files/suites/examples

### Environments
- Expect at least api_url; token/api_key optional depending on auth
- Presets (dev/prod) are supported via env files; users can choose at runtime
- Use `e:VAR` tokens directly in APIs/tests for type-preserving substitution; use `<<e:VAR>>` inside strings

Generation knobs (see YAML profile):
- env.file: default environment file path
- env.required/optional: variables to expect
- env.generateSkeleton: whether to emit a starter env file
