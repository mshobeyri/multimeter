# Write a test flow

Use `type: test` to orchestrate steps: call HTTP (or an API file), then `expect` / `check` / `assert` the result.

## Minimal example

```yaml
type: test
title: Simple HTTP test
description: Calls an HTTP endpoint directly and checks the response
steps:
  - http: https://test.mmt.dev/echo
    title: Send an echo request
    method: post
    body:
      message: hello world
    expect:
      status: 200
      body.body.message: hello world
```

Run the file — failed checks appear in the Report view.

## Tips

- Use `http` for a direct call, or `call` to reuse a `type: api` file.
- Put `expect` on the same step as the request — not as a separate step.
- Prefer `expect` for soft failures that still continue; use `assert` to stop on failure.
- Import helpers and data with `import` when tests grow.

## Learn more

- [Test files](../files/test/index.md)
- Example: [Simple Test](/docs/examples/basic/02_simple_test)
