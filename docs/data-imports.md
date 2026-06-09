# Data Imports

All YAML-based Multimeter files can import data from `.json`, `.yaml`, `.yml`, and `.csv` files with a top-level `import` map.

```yaml
type: api
import:
  fixture: ./data/user.json

url: https://api.example.com/users/${fixture.user.id}
method: post
body: ${fixture.payload}
```

Each import key is an alias. The value is a path relative to the current `.mmt` file, or a project-root path starting with `+/` relative to the folder containing `multimeter.mmt`.

Imported values are referenced with `${alias.path}`. A whole scalar value like `body: ${fixture.payload}` keeps the imported value's type, so objects stay objects and arrays stay arrays. Inline replacements inside longer strings are converted to text.

CSV imports are parsed into JSON rows, using the same behavior as test CSV imports: quoted fields are preserved as strings, unquoted numbers and booleans are coerced, and BOMs/quoted commas are handled.

Example JSON file:

```json
{
  "endpoint": "users",
  "payload": {
    "name": "Alice",
    "active": true
  }
}
```

Example YAML file:

```yaml
endpoint: users
payload:
  name: Alice
  active: true
```

Both can be used the same way:

```yaml
import:
  data: ./fixture.yaml

url: https://api.example.com/${data.endpoint}
body: ${data.payload}
```

Supported file types include `api`, `test`, `suite`, `loadtest`, `env`, `doc`, and `server`.
