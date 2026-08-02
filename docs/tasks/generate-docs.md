# Generate docs

Use `type: doc` to turn your API `.mmt` files into HTML or Markdown documentation — same source of truth as your runnable requests.

## Minimal example

```yaml
type: doc
title: My API
services:
  - name: Public API
    apis:
      - ./api/get_json.mmt
```

Generate from VS Code (doc view / generate command) or CLI:

```sh
npx mmt-testlight doc document.mmt --html out.html
```

## Tips

- Write good `title` and `description` fields on API files — they become the published docs.
- Document inputs/outputs so consumers see parameters and response fields.
- Preview locally before publishing the HTML artifact.

## Learn more

- [Doc files](../files/doc.md)
- Example: [Basic Documentation](/docs/examples/basic/05_basic_documentation)
