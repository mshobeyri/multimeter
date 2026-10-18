# import

### `import`
The `import` section brings external files into a test. Each entry is an **alias** (key) and a **path** (value).

**Prefer `+/…` project-root paths** for APIs and shared fixtures whenever the project has a [`multimeter.mmt`](../env/project-root.md) at its root — imports stay stable if you move the test file. Use paths relative to the current `.mmt` file only for siblings in the same folder (or when there is no project root marker).

## Importable file types

| File type | Extensions | Use with | Docs |
|-----------|------------|----------|------|
| API definition | `.mmt` (`type: api`) | `call` | [call](./steps/call.md) |
| Test flow | `.mmt` (`type: test`) | `call` (nested test) | [call](./steps/call.md) |
| Mock server | `.mmt` (`type: server`) | `run` | [Mock servers in tests](../server/in-tests.md) |
| Judge | `.mmt` (`type: judge`) | `judge` | [Judge](../judge/index.md) · [Judge steps](./steps/judge.md) |
| HTTP Client file | `.http`, `.https` | `call` (converted to a test flow) | [HTTP file](../../integration/http-file.md) |
| Bruno request | `.bru`, `.bruno` | `call` (converted to a test flow) | [Bruno](../../integration/bruno.md) |
| Data file | `.csv`, `.json`, `.yaml`, `.yml` | `for`, `${alias.path}` | [Data-driven tests](../../features/data-driven-tests.md) |
| JS helper module | `.js`, `.cjs`, `.mjs` | `js` steps | [JS helper modules](./steps/js.md#js-helper-modules) |

```yaml
import:
  api: +/api/forecast_current.mmt   # preferred — project root (multimeter.mmt)
  login: +/tests/login.mmt
  helpers: +/helpers/xxx.js
  # Same-folder / local-only (OK when no project root, or for true siblings):
  sibling: ./nearby_test.mmt
  requests: requests.http           # HTTP Client file, converted to a test flow
  profile: profile.bru              # Bruno request file, converted to a test flow
  users: ../data/users.csv          # relative — prefer +/data/users.csv when possible
```

HTTP and Bruno files imported this way are converted internally to test flows and can be called like normal test imports:

```yaml
steps:
  - call: requests
```

See also: [Cache](./cache.md) · [Data-driven tests](../../features/data-driven-tests.md) · [Data imports](../../features/data-imports.md) · [js step — JS helper modules](./steps/js.md#js-helper-modules)
