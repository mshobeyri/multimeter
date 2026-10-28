# OS environment variables (`$VAR`)

Env values that are exactly `$NAME` (POSIX-ish name) read from the **host process environment** at run time — the shell for `testlight`, the VS Code / Cursor process for the extension.

```yaml
type: env
variables:
  path_from_os: $PATH
  api_url:
    local: "http://localhost:8080"
    prod: $PROD_URL
```

Consumers still use Multimeter tokens (`e:path_from_os`, `<<e:path_from_os>>`). The `$…` form is only the **definition** in the env file (or a selected List/Object choice value).

## Rules

- Whole value only: `$PATH` is a ref; `https://$HOST` is a plain string.
- Unset or empty OS vars resolve like a missing Multimeter env (same as unset `e:name`).
- In Edit Environment, Type **OS** edits the process env name; YAML stores `$NAME`.
- The Environment panel shows an `(os)` chip / type label `os` for matching values.

## Example

[Environment Variables (intermediate)](../../../examples/intermediate/10_environment_variables/README.md) defines `path_from_os: $PATH` and posts it in the echo **body** (not the URL) under `os_variables/`.

```sh
npx testlight run examples/intermediate/10_environment_variables/os_variables/path_test.mmt \
  --env-file examples/intermediate/10_environment_variables/multimeter.mmt \
  --preset runner.dev
```

See also: [Live variables](./live-variables.md) · [CLI](./cli.md) · [Overview](./index.md)
