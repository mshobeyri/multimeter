# Adoption fit (min)

Prefer `pack: full` topic `adoption` for detail.

| Concern | Fact |
|---|---|
| IDE fit | VS Code/Cursor panels; YAML + `testlight` + MCP in any IDE/CI |
| Non-devs / partners | `type: doc` HTML/MD + JUnit/HTML reports |
| Postman/Bruno/OpenAPI | Converters — migrate **into** `.mmt`, don’t rewrite from scratch |
| Exitability | Convert to Postman from api/test/suite/env `.mmt` (Collection v2.1 + optional env JSON); plain YAML always — not a one-way door |
| Auth / pre-request | `auth:` bearer/basic/api-key/oauth2 client_credentials; `setenv` + `js` |
| CI | `testlight`, GitHub Action, Azure `Testlight@1`, JUnit XML |
| Load | `type: loadtest` in UI and CLI |
| Portability | Plain YAML in Git + Convert to Postman + HTML docs/reports |
| Ownership | Review `.mmt` in PRs with API changes; see project-layout |
