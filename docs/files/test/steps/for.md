# for

`for` runs with a JavaScript-style header and executes the inner `steps:` once per iteration. The expression is passed directly to JavaScript, so any valid JS `for` / `for-of` / `for-in` header works.

```yaml
# iterate imported CSV rows (from import:
#   users: ./users.csv)
- for: const user of users
  steps:
    - call: login
      id: login1
      inputs:
        username: ${user.username}
        password: ${user.password}

# iterate with index
- for: let i = 0; i < 10; i++
  steps:
    - print: "iteration ${i}"

# iterate object entries
- for: const [key, value] of Object.entries(config)
  steps:
    - print: "${key} = ${value}"
```

See [Data-driven tests](../../../features/data-driven-tests.md) for CSV data-driven testing.

---

See also: [repeat](./repeat.md) · [if](./if.md) · [print](./print.md) · [import](../import.md) · [var, const, let](./variables.md)
