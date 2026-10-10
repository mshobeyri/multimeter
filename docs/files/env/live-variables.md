# Live variables

Environment values that start with `./` and end with `.mmt` are **file-backed live variables**. Instead of a fixed string, the value points at another `.mmt` file. Each time you read that env name, Multimeter runs the target file and uses one of its outputs.

Use them when a shared value must be produced at run time — for example a fresh session id, token, or fixture — without hard-coding it in every consumer.

## How it works

1. Declare a variable whose value is a relative path to a `.mmt` file:

```yaml
type: env
variables:
  session_api: ./create_session_api.mmt
  session_test: ./create_session_test.mmt
```

2. At run start, each such path becomes a **getter** in the process env store.
3. Reading `e:session_api` (or `<<e:session_api>>`) runs that file through the normal runner with **default inputs**.
4. The env value is the **first key** declared under the target’s `outputs:` (YAML order).
5. The target’s optional `cache:` controls reuse across reads in the same run.

Works for any runnable type that declares `outputs:` — typically `type: api` or `type: test`.

## Target file

Minimal API target — first `outputs` key is `session`:

```yaml
type: api
outputs:
  session: body.body.uuid
url: https://test.mmt.dev/echo
method: post
format: json
body:
  uuid: r:uuid
```

Minimal test target with a short cache window:

```yaml
type: test
outputs:
  session: ''
cache: 2s
steps:
  - set:
      o:session: r:uuid
```

See [cache](../test/cache.md) for duration forms (`2s`, `5m`, …). `cache:` is also allowed on API files used as live-env targets.

## Using the value

Consumers reference the env name like any other variable:

```yaml
type: test
steps:
  - assert: e:session_api =* ^[0-9a-f-]{36}$
  - assert: e:session_test =* ^[0-9a-f-]{36}$
```

Or in an API body / URL:

```yaml
body:
  api_session: e:session_api
  test_session: e:session_test
```

## Environment panel

In the environment variables UI, file-backed values show a clickable `(live)` chip in the value field; click it to open the target file. See [Environment variables panel](./ui.md).

## setenv vs live variables

| | Live variable (`./file.mmt` in env) | `setenv` of a path string |
|---|---|---|
| Source | Declared under `variables:` in a `type: env` file | Written during an API/test run |
| Behavior | Path becomes a getter at run start | Stays a plain path string |
| Read | Each `e:name` runs the file (subject to `cache:`) | No automatic run |

Only the original env copy converts `./….mmt` paths into getters. A later `setenv` of `./x.mmt` does **not** turn into a live getter.

## Example

Full working sample (API + test targets, consumer test, suite):

[Environment live variables](../../../examples/intermediate/32_environment_live_variables/README.md)

```sh
npx testlight run examples/intermediate/32_environment_live_variables/suite.mmt \
  --env-file examples/intermediate/32_environment_live_variables/multimeter.mmt
```

## See also

- [Environment overview](./index.md)
- [Environment variables panel](./ui.md)
- [setenv (API)](../api/setenv.md) · [setenv (test)](../test/steps/setenv.md)
- [Test cache](../test/cache.md)
- [Use environments](../../tasks/use-environments.md)
