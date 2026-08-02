# Generation Workflow (For AI/Tools)

Follow these steps to generate MMT artifacts:

1. **Parse Source**: Identify input type (OpenAPI, Postman, description). Use precedence order.
2. **Map to APIs**: Create `type: api` files for each endpoint, using mapping rules. Include inputs, examples.
3. **Generate Tests**: Produce smoke tests (required) and optional negative/boundary. Use `call`, `assert`, `check` steps. When user explicitly requests a *WebSocket sample test*, generate BOTH:
  - a `type: api` file with `protocol: ws`
  - a `type: test` file calling that ws api (single `call` + `assert`/`check`).
4. **Handle Data**: Use `r:`, `c:`, `e:` tokens for dynamic/random values. Honor schema constraints.
5. **Output Files**: Name as `{method}-{path}.mmt` for APIs, group in suites for tests. Include env file if needed.
6. **Validate**: Ensure generated YAML matches structures below. Skip unsupported features.
