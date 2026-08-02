# import

### import
The `import` section lets you bring in other `.mmt` files (APIs or tests), `.http` / `.https` files, `.bru` files, data files (`.json`, `.yaml`, `.yml`, `.csv`), or JavaScript helpers to use in your test. Each import has an alias (the key) and a file path (the value).

```yaml
import:
  login: login.mmt           # relative to current file
  requests: requests.http    # HTTP Client file, converted to a test flow
  profile: profile.bru       # Bruno request file, converted to a test flow
  users: ../data/users.csv   # relative path
  fixture: ../data/user.json  # data source used as ${fixture.path}
  api: +/apis/userApi.mmt    # project root path
  helpers: ./helpers/xxx.js  # JS helper module (CommonJS)
```

HTTP and Bruno files imported this way are converted internally to test flows and can be called like normal test imports:

```yaml
steps:
  - call: requests
```

**JS helper modules**
- Files ending in `.js`, `.cjs`, or `.mjs` are treated as JavaScript helper modules.
- They are loaded via the runner's `fileLoader` and evaluated once per run, then cached.
- Write plain top-level functions (or `const`/`let`/`var` function bindings). Multimeter auto-exports them onto the import alias:

```js
// xxx.js
function add(a, b) {
  return a + b;
}

const double = (x) => x * 2;
```

```yaml
type: test
import:
  helpers: ./helpers/xxx.js
steps:
  - js: |
      const sum = helpers.add(1, 2)
      console.log('sum', sum, helpers.double(sum))
```

- You can still use CommonJS explicitly when you need a custom export shape:

```js
module.exports = {
  add(a, b) {
    return a + b;
  }
};
```

See `examples/intermediate/14_javascript_helpers` and `examples/professional/09_javascript_helpers`.
