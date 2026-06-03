#!/usr/bin/env zsh
set -euo pipefail

cd "${0:A:h}/.."

# Build the TypeScript CLI (non-pkg) and run a simple env-file+preset scenario.
# This asserts that preset-selected env values reach the test run.

npm run build --silent --prefix core
npm run build --silent --prefix mmtcli

out=$(node mmtcli/dist/cli.js run ./examples/intermediate/10_environment_presets/test/preset_test.mmt --env-file ./examples/intermediate/10_environment_presets/multimeter.mmt --preset runner.dev)

print -r -- "$out" | grep -q "debug"
print "OK: CLI run printed env preset (debug)"
