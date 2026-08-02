# Write a test flow

Use `type: test` to orchestrate steps: call HTTP (or an API file), then `expect` / `check` / `assert` the result.

## Minimal example

```yaml
type: test
title: Echo POST
steps:
  - http:
      url: https://test.mmt.dev/post
      method: post
      format: json
      body:
        hello: world
  - expect:
      status: 200
      body.json.hello: world
```

Run the file — failed checks appear in the Log / report view.

## Tips

- Use `http` for a direct call, or `call` to reuse a `type: api` file.
- Prefer `expect` for soft failures that still continue; use `assert` to stop on failure.
- Import helpers and data with `import` when tests grow.

## Learn more

- [Test files](../files/test/index.md)
- Example: [Simple Test](/docs/examples/basic/02_simple_test)
