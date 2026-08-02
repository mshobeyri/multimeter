# Data generation

Prefer built-in tokens — full list with examples: [Dynamic values](../../features/dynamic-values.md).

- Random (`r:`): uuid, bool, int, etc.
- Current (`c:`): date, epoch, etc.

Honor schema constraints (e.g., min/max, regex) when available.

Examples:
```yaml
headers:
  X-Req: req-<<r:uuid>>
body:
  id: r:int
  created_at: c:epoch
  active: r:bool
```

### Token Prefix Summary

Use these compact prefixes to indicate dynamic values. Generators and AI should prefer them over hard‑coded literals.

- `i:<name>` – Input parameter placeholder (declared under `inputs:` in an API or test). Example: `inputs: { user_id: r:int }` then use `i:user_id` in body/headers/url.
- `e:<var>` – Environment variable reference (type‑preserving). Inside strings use `<<e:var>>`; standalone use `e:var`.
- `r:<type>` – Random value generator. Common types: `r:uuid`, `r:int`, `r:bool`, `r:email`, `r:first_name`, `r:full_name`, `r:phone`, `r:city`, `r:country`. Honors constraints when possible.
- `c:<name>` – Current/time/system value. Examples: `c:epoch`, `c:date`, `c:epoch_ms`, `c:time`, `c:year`.

Guidelines:
- Prefer `e:` for secrets / deployment specifics, `r:` for variability, `c:` for timestamps, `i:` for test/API parameterization.
- Do not mix `<<e:var>>` with other token syntaxes inside the same scalar unless needed (avoid confusing expansions).
- In examples, override only `inputs` values—not environment or random tokens (those remain dynamic).
