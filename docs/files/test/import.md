# import

### import
The `import` section brings external files into a test. Each entry is an **alias** (key) and a **path** (value). Paths are relative to the current `.mmt` file, or start with `+/` to resolve from the project root (the folder containing `multimeter.mmt`).

## Importable file types

| File type | Extensions | Use with | Docs |
|-----------|------------|----------|------|
| API definition | `.mmt` (`type: api`) | `call` | [call](./steps/call.md) |
| Test flow | `.mmt` (`type: test`) | `call` (nested test) | [call](./steps/call.md) |
| Mock server | `.mmt` (`type: server`) | `run` | [Mock servers in tests](../server/in-tests.md) |
| HTTP Client file | `.http`, `.https` | `call` (converted to a test flow) | [HTTP files](../../integration/http-files/index.md) |
| Bruno request | `.bru`, `.bruno` | `call` (converted to a test flow) | [Bruno files](../../integration/bruno-files/index.md) |
| Data file | `.csv`, `.json`, `.yaml`, `.yml` | `data`, `for`, `${alias.path}` | [Data-driven tests](../../features/data-driven-tests.md) |
| JS helper module | `.js`, `.cjs`, `.mjs` | `js` steps | [JS helper modules](./steps/js.md#js-helper-modules) |

```yaml
import:
  login: login.mmt           # relative to current file
  requests: requests.http    # HTTP Client file, converted to a test flow
  profile: profile.bru       # Bruno request file, converted to a test flow
  users: ../data/users.csv   # relative path
  fixture: ../data/user.json # data source used as ${fixture.path}
  api: +/apis/userApi.mmt    # project root path
  helpers: ./helpers/xxx.js  # see JS helper modules in js step docs
```

HTTP and Bruno files imported this way are converted internally to test flows and can be called like normal test imports:

```yaml
steps:
  - call: requests
```

See also: [Cache](./cache.md) · [Data-driven tests](../../features/data-driven-tests.md) · [Data imports](../../integration/data-imports.md) · [js step — JS helper modules](./steps/js.md#js-helper-modules)
