# Constraints (min)

- Valid YAML only; first non-comment line is `type: …`
- No YAML comments (`#`) in generated `.mmt`
- Snake_case tokens: `e:`, `i:`, `r:`, `c:`
- New API tests: scaffold first, then minimal edits
- Modify: patch only; validate after every edit
- Never invent Postman/`pm.` syntax
- Prefer smoke coverage unless asked for more
