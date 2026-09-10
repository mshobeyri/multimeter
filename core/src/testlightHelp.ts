export const TESTLIGHT_NAME = 'testlight';

export const TESTLIGHT_DESCRIPTION =
    'Multimeter CLI — run .mmt API tests, suites, and docs';

/** Shared footer for `testlight --help` (npm package and standalone binaries). */
export const TESTLIGHT_HELP_AFTER = [
  '',
  'Run options:',
  '  -q, --quiet                Minimal output',
  '  -o, --out <file>           Write result JSON to file',
  '  -i, --input <k=v...>       Input variables (repeatable)',
  '  -e, --env <k=v...>         Environment variables (repeatable)',
  '  -F, --env-file <path>      Environment file (.mmt/.yaml)',
  '  -P, --preset <name>        Preset from env file (repeatable)',
  '  -x, --example <name|#n>    Named example or index (#1 is first)',
  '  -p, --print-js             Print generated JS before executing',
  '  -r, --report <format>      junit | mmt | html | md | md-detailed',
  '  -R, --report-file <path>   Report output path',
  '',
  'Examples:',
  '  testlight run path/to/test.mmt',
  '  testlight run path/to/test.mmt -F env.mmt -P runner.dev -P custom.prod',
  '  testlight run path/to/suite.mmt --report html',
  '  testlight scaffold test --from path/to/api.mmt',
  '  testlight scaffold test --from path/to/api.mmt -o tests/api-smoke.mmt',
  '  testlight docs test',
  '  testlight validate path/to/test.mmt',
  '  testlight suggest asserts --from path/to/api.mmt',
  '  testlight update',
  '  testlight update --check',
  '',
  'Run `testlight <command> --help` for command-specific options.',
].join('\n');
