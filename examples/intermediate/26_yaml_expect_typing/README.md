# YAML expect / check typing

Live example for the value-typing rules used by `expect`, `check`, and `if`:

| Written in YAML | Meaning |
|---|---|
| `== 200` / `200` | number |
| `== "200"` | string `"200"` |
| `null` | JSON null |
| `"null"` | string `"null"` |
| `omit` | field missing / omit keyword |
| `"omit"` | string `"omit"` |
| `!= null` | present (not omitted) |

## Run

```sh
npx testlight run examples/intermediate/26_yaml_expect_typing/typing_test.mmt
```

Related: [Omit keyword](../22_omit_keyword/README.md) · [Check operators](../23_check_operators/README.md)
