#!/usr/bin/env bash
# Update mshobeyri/homebrew-multimeter from GitHub Release checksums (stable only).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:?VERSION is required}"
CHECKSUMS="${CHECKSUMS:?CHECKSUMS file is required}"
TAP_REPO="${TAP_REPO:-mshobeyri/homebrew-multimeter}"
FORMULA_SRC="$REPO_ROOT/packaging/homebrew/mmt-testlight.rb"
TOKEN="${HOMEBREW_TAP_TOKEN:-${TESTLIGHT_ACTION_TOKEN:-}}"

if [[ "$VERSION" == *-* ]]; then
  echo "Skip Homebrew: version '${VERSION}' is not stable"
  exit 0
fi

if [[ -z "$TOKEN" ]]; then
  echo "HOMEBREW_TAP_TOKEN (or TESTLIGHT_ACTION_TOKEN) is required to publish $TAP_REPO"
  exit 1
fi

if [[ ! -f "$CHECKSUMS" ]]; then
  echo "Missing checksums file: $CHECKSUMS"
  exit 1
fi

export GH_TOKEN="$TOKEN"

UPDATED="$(python3 - "$FORMULA_SRC" "$VERSION" "$CHECKSUMS" <<'PY'
import re
import sys
from pathlib import Path

src, version, checksums_path = sys.argv[1], sys.argv[2], sys.argv[3]
text = Path(src).read_text()
text, n = re.subn(r'(version ")[^"]+(")', rf'\g<1>{version}\2', text, count=1)
if n != 1:
    raise SystemExit('Could not replace Homebrew formula version')

checksums = {}
for line in Path(checksums_path).read_text().splitlines():
    parts = line.split()
    if len(parts) >= 2:
        checksums[Path(parts[1]).name] = parts[0]

needed = [
    'testlight-macos-arm64.tar.gz',
    'testlight-macos-x64.tar.gz',
    'testlight-linux-arm64.tar.gz',
    'testlight-linux-x64.tar.gz',
]
missing = [name for name in needed if name not in checksums]
if missing:
    raise SystemExit(f'Missing checksums: {", ".join(missing)}')

for name, sha in checksums.items():
    if name not in needed:
        continue
    pattern = rf'(url "[^"]*{re.escape(name)}"[^\n]*\n\s*sha256 ")[0-9a-fA-F]+(")'
    text, n = re.subn(pattern, rf'\g<1>{sha}\2', text, count=1)
    if n != 1:
        raise SystemExit(f'Could not replace sha256 for {name}')

sys.stdout.write(text)
PY
)"

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

gh repo clone "$TAP_REPO" "$WORKDIR/tap"
if [[ -d "$WORKDIR/tap/Formula" ]]; then
  dest="$WORKDIR/tap/Formula/mmt-testlight.rb"
else
  dest="$WORKDIR/tap/mmt-testlight.rb"
fi
printf '%s' "$UPDATED" > "$dest"

cd "$WORKDIR/tap"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add "$dest"
if git diff --cached --quiet; then
  echo "Homebrew formula already at $VERSION"
  exit 0
fi
git commit -m "mmt-testlight ${VERSION}"
git push origin HEAD
echo "Published $TAP_REPO mmt-testlight ${VERSION}"
