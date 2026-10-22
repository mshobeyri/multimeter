#!/usr/bin/env bash
# Wall-clock compare: Multimeter suite vs Newman Postman collection.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../.." && pwd)"
MMT="$ROOT/multimeter"
cd "$ROOT"

node postman/generate-collection.mjs >/dev/null

echo "=== Multimeter (testlight) ==="
START=$(python3 -c 'import time; print(time.time())')
(
  cd "$MMT"
  node "$REPO/mmtcli/dist/cli.js" run suite.mmt --env-file multimeter.mmt
) > /tmp/mmt-open-meteo-suite.log 2>&1
MMT_EC=$?
END=$(python3 -c 'import time; print(time.time())')
MMT_SEC=$(python3 -c "print(f'{${END}-${START}:.3f}')")
echo "exit=$MMT_EC wall_seconds=$MMT_SEC"
tail -5 /tmp/mmt-open-meteo-suite.log

echo
echo "=== Postman (newman) ==="
START=$(python3 -c 'import time; print(time.time())')
npx --yes newman run postman/open-meteo.root-suite.postman_collection.json \
  --suppress-exit-code \
  > /tmp/newman-open-meteo-suite.log 2>&1
NEW_EC=$?
END=$(python3 -c 'import time; print(time.time())')
NEW_SEC=$(python3 -c "print(f'{${END}-${START}:.3f}')")
echo "exit=$NEW_EC wall_seconds=$NEW_SEC"
tail -20 /tmp/newman-open-meteo-suite.log | head -20

echo
echo "=== Summary ==="
echo "testlight_wall_s=$MMT_SEC"
echo "newman_wall_s=$NEW_SEC"
python3 -c "print(f'speedup_testlight_vs_newman={${NEW_SEC}/${MMT_SEC}:.2f}x')"
