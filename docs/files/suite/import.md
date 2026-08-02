# import

### `import`

Suites support top-level data imports from `.json`, `.yaml`, `.yml`, and `.csv` files. Each entry is an **alias** (key) and a **path** (value). Imported values can be referenced with `${alias.path}` in suite fields before the suite is run.

Paths are relative to the current `.mmt` file, or start with `+/` to resolve from the project root (the folder containing `multimeter.mmt`).

```yaml
type: suite
import:
  config: ./suite-config.yaml
title: ${config.title}
items:
  - ./tests/login.mmt
```

See [Data Imports](../../integration/data-imports.md).

---

See also: [items](./items.md) · [Edit Suite — Overview tab](./edit.md#overview) · [Data-driven tests](../../features/data-driven-tests.md)
