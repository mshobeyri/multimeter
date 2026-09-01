# HTTP file examples

These examples show `.http` files that can be opened through **Open With...** → **Multimeter HTTP Test Editor**, or **Open as MMT**.

The header has a selector and **Save as MMT**. **All** runs every request as one test; pick a request to Send it. The Test and API UIs are the same as for `.mmt` files.

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
