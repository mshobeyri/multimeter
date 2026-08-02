# Tips

- Env tokens in tests (`e:VAR`, `<<e:VAR>>`) resolve at runtime; prefer presets for switching environments.
- Quoted values are kept as strings: `-e port="08080"`.
- When `--env-file` is relative, it resolves from the shell cwd first, then the test file directory.
- If `--env-file` is omitted, the CLI searches upward from the file being run for `multimeter.mmt`, then `env.mmt`.
- Use `--out` to capture structured results in CI.
- Suite files with an `export:` field automatically generate reports after completion—no `--report` flag needed.
- Load test files with an `export:` field also generate load reports after completion.

---
