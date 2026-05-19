# Bruno file examples

These examples show `.bru` files that can be opened through **Open With...** -> **Multimeter Bruno Test Editor**.

The Multimeter Bruno editor treats Bruno request files as runnable test flows. The structured UI is read-only for `.bru` files; use **Save as MMT** to convert one into an editable `.mmt` test.

## Files

- `get_profile.bru`: a simple Bruno GET request with variables, headers, bearer auth, query params, and assertions.
- `import_bruno_in_test.mmt`: a Multimeter test that imports a `.bru` file and calls it like any other test import.

## Importing Bruno Files From MMT

`.bru` files can be imported from `type: test` files. Multimeter converts them to test flows internally, so a normal `call` step can run the Bruno request.

```yaml
type: test
title: Import Bruno request
import:
  profile: get_profile.bru
steps:
  - call: profile
```
