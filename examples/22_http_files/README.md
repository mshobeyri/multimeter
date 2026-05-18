# HTTP file examples

These examples show `.http` files that can be opened through **Open With...** -> **Multimeter HTTP Test Editor**.

The Multimeter HTTP editor treats these files as runnable test flows. The structured UI is read-only for `.http` files; use **Save as MMT** to convert one into an editable `.mmt` test.

## Files

- `auth_user_flow.http`: login, create user, fetch user, update user, and delete user flow with captured variables.
- `jsonplaceholder_posts.http`: create, fetch, search, and delete post flow using JSONPlaceholder-style endpoints.
- `import_http_in_test.mmt`: a Multimeter test that imports a `.http` file and calls it like any other test import.

## Importing HTTP files from MMT

`.http` and `.https` files can be imported from `type: test` files. Multimeter converts them to test flows internally, so a normal `call` step can run the HTTP file.

```yaml
type: test
import:
	posts: jsonplaceholder_posts.http
steps:
	- call: posts
```
