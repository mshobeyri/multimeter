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
cp "$SRC/ci/samples.yml" "$WORKDIR/action/.github/workflows/samples.yml"
cp "$SRC/examples/azure-pipelines.yml" "$WORKDIR/action/azure-pipelines.yml"

cd "$WORKDIR/action"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
if [ -n "${GH_TOKEN:-}" ]; then
  git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${ACTION_REPO}.git"
fi
git add action.yml README.md LICENSE.md examples .github/workflows/samples.yml azure-pipelines.yml
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
