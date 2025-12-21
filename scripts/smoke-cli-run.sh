#!/usr/bin/env zsh
set -euo pipefail

cd "${0:A:h}/.."

# Build the TypeScript CLI (non-pkg) and run a simple env-file+preset scenario.
# This asserts the regression: e:test_type should be "all".

npm run build --silent --prefix core
npm run build --silent --prefix mmtcli

out=$(node mmtcli/dist/cli.js run ./examples/test1.mmt --env-file ./examples/_environments.mmt --preset runner.cd)

print -r -- "$out" | grep -q "\ball\b"
print "OK: CLI run printed env preset (all)"
