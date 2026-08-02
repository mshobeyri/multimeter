# Environment Priority

When running suite files, environment variables are resolved in this priority order (highest wins):

1. **CLI `-e` flags** — explicit overrides always take precedence
2. **Suite `environment.variables`** — inline variables in the suite file
3. **Suite `environment.preset`** — preset from suite's env file or `multimeter.mmt`
4. **CLI `--env-file` + `--preset`** — external env file settings
5. **Project defaults** — base values from `multimeter.mmt`

Suite-level environment configuration (from `environment:` field) only applies when the suite is run directly. When imported by another suite, the root suite's environment takes precedence.
