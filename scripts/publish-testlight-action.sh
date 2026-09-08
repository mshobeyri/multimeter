#!/usr/bin/env bash
# Copy the in-repo composite action to mshobeyri/testlight-action and tag it.
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

if [ -n "${CI:-}" ] && [ -z "${TESTLIGHT_ACTION_TOKEN:-}" ]; then
  echo "Skip publishing $ACTION_REPO: set repo secret TESTLIGHT_ACTION_TOKEN"
  exit 0
fi

if [ -n "${TESTLIGHT_ACTION_TOKEN:-}" ]; then
  export GH_TOKEN="$TESTLIGHT_ACTION_TOKEN"
fi

WORKDIR="$(mktemp -d)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

gh repo clone "$ACTION_REPO" "$WORKDIR/action"
cp "$REPO_ROOT/.github/actions/testlight/action.yml" "$WORKDIR/action/action.yml"
cp "$REPO_ROOT/LICENSE.md" "$WORKDIR/action/LICENSE.md"

# Keep the published README consumer-facing (no in-repo local-copy note).
cat > "$WORKDIR/action/README.md" <<EOF
# Testlight GitHub Action

Run Multimeter (\`.mmt\`) API tests, test suites, and generate documentation in GitHub Actions.

## Usage

\`\`\`yaml
- uses: actions/checkout@v4
- uses: ${ACTION_REPO}@v${VERSION}
  with:
    file: tests/suite.mmt
    env-file: tests/env.mmt
    preset: ci
    report: junit
    report-file: results/junit.xml
\`\`\`

Docs: [Install Testlight](https://mmt.dev/docs/features/testlight/install) · [Run in CI](https://mmt.dev/docs/tasks/run-in-ci)

The \`version\` input defaults to \`latest\`. Pass \`pre\` or \`X.Y.Z\` to pin \`mmt-testlight\`.
EOF

cd "$WORKDIR/action"
git add action.yml README.md LICENSE.md
if git diff --cached --quiet; then
  echo "No action file changes for v${VERSION}"
else
  git commit -m "Release Testlight Action v${VERSION}"
fi

git tag -f "v${VERSION}"
git push origin HEAD:main
git push -f origin "v${VERSION}"

# Floating @v1 is stable only. Pre-releases keep a versioned tag only.
if [ "$PRERELEASE" != "true" ]; then
  major="${VERSION%%.*}"
  git tag -f "v${major}"
  git push -f origin "v${major}"
fi

if gh release view "v${VERSION}" >/dev/null 2>&1; then
  echo "Release v${VERSION} already exists on $ACTION_REPO"
else
  pre_flag=()
  if [ "$PRERELEASE" = "true" ]; then
    pre_flag=(--prerelease)
  fi
  gh release create "v${VERSION}" "${pre_flag[@]}" \
    --title "Testlight Action v${VERSION}" \
    --notes "Matches Testlight / Multimeter ${VERSION}. Installs \`mmt-testlight@${VERSION}\`."
fi

echo "Published $ACTION_REPO@v${VERSION}"
