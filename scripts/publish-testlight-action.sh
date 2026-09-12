#!/usr/bin/env bash
# Copy mmtaction/ (GitHub Action product) to mshobeyri/testlight-action and tag it.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-$(node -p "require('$REPO_ROOT/mmtcli/package.json').version")}"
PRERELEASE="${PRERELEASE:-}"
ACTION_REPO="${ACTION_REPO:-mshobeyri/testlight-action}"

if [ -z "$PRERELEASE" ]; then
  # shellcheck source=scripts/version-channel.sh
  . "$REPO_ROOT/scripts/version-channel.sh"
  if is_prerelease "$VERSION"; then
    PRERELEASE=true
  else
    PRERELEASE=false
  fi
fi

if [ "$PRERELEASE" = "true" ]; then
  echo "Skip Testlight Action publish for pre-release v${VERSION} (stable tags only)."
  exit 0
fi

if [ -n "${CI:-}" ] && [ -z "${TESTLIGHT_ACTION_TOKEN:-}" ]; then
  echo "TESTLIGHT_ACTION_TOKEN is required to publish $ACTION_REPO"
  exit 1
fi

if [ -n "${TESTLIGHT_ACTION_TOKEN:-}" ]; then
  export GH_TOKEN="$TESTLIGHT_ACTION_TOKEN"
fi
gh auth setup-git

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

gh repo clone "$ACTION_REPO" "$WORKDIR/action"
SRC="$REPO_ROOT/mmtaction"
cp "$SRC/action.yml" "$WORKDIR/action/action.yml"
cp "$REPO_ROOT/LICENSE.md" "$WORKDIR/action/LICENSE.md"
cp "$SRC/README.md" "$WORKDIR/action/README.md"

rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude '**/.DS_Store' \
  "$SRC/examples/" "$WORKDIR/action/examples/"

mkdir -p "$WORKDIR/action/.github/workflows"
cp "$SRC/examples/ci.yml" "$WORKDIR/action/.github/workflows/ci.yml"
rm -f "$WORKDIR/action/.github/workflows/samples.yml"
rm -f "$WORKDIR/action/azure-pipelines.yml"

cd "$WORKDIR/action"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if [ -n "${GH_TOKEN:-}" ]; then
  git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${ACTION_REPO}.git"
fi
git add action.yml README.md LICENSE.md examples .github/workflows/ci.yml
git rm -f --ignore-unmatch azure-pipelines.yml .github/workflows/samples.yml
if git diff --cached --quiet; then
  echo "No action file changes for v${VERSION}"
else
  git commit -m "Release Testlight Action v${VERSION}"
fi

git tag -f "v${VERSION}"
git push origin HEAD:main
git push -f origin "v${VERSION}"

major="${VERSION%%.*}"
git tag -f "v${major}"
git push -f origin "v${major}"

if gh release view "v${VERSION}" >/dev/null 2>&1; then
  echo "Release v${VERSION} already exists on $ACTION_REPO"
else
  gh release create "v${VERSION}" \
    --title "Testlight Action v${VERSION}" \
    --notes "$(cat <<EOF
Run Multimeter (\`.mmt\`) API tests, test suites, and docs in GitHub Actions.

Installs \`mmt-testlight@${VERSION}\` (or \`latest\` / \`pre\` via the \`version\` input).

## Usage

\`\`\`yaml
- uses: actions/checkout@v6
- uses: ${ACTION_REPO}@v${VERSION%%.*}
  with:
    file: tests/suite.mmt
    report: junit
    report-file: results/junit.xml
\`\`\`

Docs: https://mmt.dev/docs/features/testlight/install · https://mmt.dev/docs/tasks/run-in-ci
EOF
)"
fi

echo "Published $ACTION_REPO@v${VERSION}"
echo "Marketplace listing cannot be set from CI (2FA). If this version is not on the listing yet:"
echo "  https://github.com/${ACTION_REPO}/releases/edit/v${VERSION}"
