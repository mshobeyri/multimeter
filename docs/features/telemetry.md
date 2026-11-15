# Telemetry

Multimeter may send **anonymous usage counts** so we can improve the product. It does **not** send your APIs, request/response bodies, headers, env values, or file contents.

## What is collected

Feature and run counters only, for example:

- Extension activated; editor opened (`api` / `test` / `suite` / `env`)
- Runs: `run.api`, `run.test`, `run.suite` (success, duration, protocol)
- Feature flags: whether the file uses inputs, outputs, env tokens, asserts, imports, etc.
- Complexity: `basic` or `standard`
- Convert / MCP tool usage (success only)
- Error area codes (no stack traces with paths or payloads)

Events are listed in the repo root [`telemetry.json`](https://github.com/mshobeyri/multimeter/blob/dev/telemetry.json).

VS Code also attaches standard extension fields (extension version, OS, VS Code version, machine/session ids). Machine ids approximate unique installs — not accounts or teams.

## What is never collected

- URLs, hosts, headers, bodies
- Input, output, or env **names or values**
- File paths, workspace names, or request payloads
- Distinct endpoint fingerprints

## Controls

Telemetry is sent only when **both** are enabled:

1. VS Code: `telemetry.telemetryLevel` is not `off` (usage events need `all`)
2. Multimeter: `multimeter.telemetry.enabled` (default `true`)

Turn either off to stop Multimeter usage events. Data goes to Multimeter’s Azure Application Insights resource (not a Multimeter cloud workspace for your collections).

## Related

- [Privacy](/privacy) on the website
- FAQ: “Does Multimeter send my API data anywhere?”
