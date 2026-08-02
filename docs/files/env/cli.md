# Using presets and overrides in CLI
Use preset from env `file:`
```sh
 testlight run tests/login.mmt --env-file env.mmt --preset runner.dev
```

Override values explicitly (wins over preset):
```sh
 testlight run tests/login.mmt --env-file env.mmt --preset runner.dev \
  -e api_url http://localhost:8080 -e user bob
```
Without env file, pass env directly:
```sh
 testlight run tests/login.mmt -e api_url=http://localhost:8080 -e user=alice -e pass='00123'
```

Typing rules for CLI values
- Unquoted numbers and booleans are coerced (e.g., `true`, `42`).
- Quoted numbers remain strings (e.g., `'00123'`).
