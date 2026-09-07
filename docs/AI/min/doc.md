# Generate `type: doc` (min)

```yaml
type: doc
title: My API docs
sources:
  - ./apis
```

## Essentials

- First line: `type: doc`
- `sources` lists API `.mmt` files or directories
- Optional: `description`, `logo`, `services`
- Build with `testlight doc <file.mmt>`

Request `pack: full` for multi-service layouts.
