# HTTP file examples

These examples show `.http` files that can be opened through **Open With...** -> **Multimeter HTTP Test Editor**.

The Multimeter HTTP editor treats these files as runnable test flows. The structured UI is read-only for `.http` files; use **Save as MMT** to convert one into an editable `.mmt` test.

All live requests target the public [test.mmt.dev](https://test.mmt.dev) test server.

## Files

- `auth_user_flow.http`: login, create user, verify bearer auth, update user, and delete user flow with captured variables.
- `echo_posts.http`: create, fetch, search, and delete post flow using echo and status endpoints on test.mmt.dev.
- `import_http_in_test.mmt`: a Multimeter test that imports a `.http` file and calls it like any other test import.

## Importing HTTP files from MMT

`.http` and `.https` files can be imported from `type: test` files. Multimeter converts them to test flows internally, so a normal `call` step can run the HTTP file.

```yaml
type: test
import:
	posts: echo_posts.http
steps:
	- call: posts
```
