#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# release-testlight.sh — Build, package, and publish testlight
# ──────────────────────────────────────────────────────────────────────
# This script:
#   1. Builds platform binaries (calls build-binaries.sh)
#   2. Creates .tar.gz / .zip archives per platform
#   3. Builds the Docker image
#   4. Optionally creates a GitHub release and uploads assets
#   5. Optionally publishes to npm
#   6. Optionally pushes the Docker image
#
# Usage:
#   ./scripts/release-testlight.sh                 # build + package only
#   ./scripts/release-testlight.sh --publish       # build + package + publish everywhere
#   ./scripts/release-testlight.sh --publish-npm   # only npm publish
#   ./scripts/release-testlight.sh --publish-github # only GitHub release
#   ./scripts/release-testlight.sh --publish-docker # only Docker push
#   ./scripts/release-testlight.sh --pre-release    # mark as pre-release (npm tag=beta, GH prerelease, Docker :beta)
#   VERSION=1.2.3 ./scripts/release-testlight.sh   # override version
#
# Pre-release examples:
#   VERSION=0.4.0-beta.1 ./scripts/release-testlight.sh --publish --pre-release
#   VERSION=0.4.0-rc.1   ./scripts/release-testlight.sh --publish --pre-release
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts"
BIN_DIR="$REPO_ROOT/bin"
DIST_DIR="$REPO_ROOT/dist-release"
CLI_DIR="$REPO_ROOT/mmtcli"

# Parse version from mmtcli/package.json unless overridden
if [[ -z "${VERSION:-}" ]]; then
  VERSION=$(node -p "require('$CLI_DIR/package.json').version")
fi

PUBLISH_ALL=false
PUBLISH_NPM=false
PUBLISH_GITHUB=false
PUBLISH_DOCKER=false
PRE_RELEASE=false

for arg in "$@"; do
  case "$arg" in
    --publish)        PUBLISH_ALL=true ;;
    --publish-npm)    PUBLISH_NPM=true ;;
    --publish-github) PUBLISH_GITHUB=true ;;
    --publish-docker) PUBLISH_DOCKER=true ;;
    --pre-release)    PRE_RELEASE=true ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if $PUBLISH_ALL; then
  PUBLISH_NPM=true
  PUBLISH_GITHUB=true
  PUBLISH_DOCKER=true
fi

# Auto-detect pre-release from version string (e.g. 0.4.0-beta.1, 0.4.0-rc.1)
if echo "$VERSION" | grep -qE '[-](alpha|beta|rc|dev|canary)'; then
  PRE_RELEASE=true
fi

# Derive the npm dist-tag and Docker floating tag for pre-releases
if $PRE_RELEASE; then
  # Extract the pre-release channel (beta, rc, alpha, etc.)
  PRE_CHANNEL=$(echo "$VERSION" | sed -n 's/.*-\([a-z]*\).*/\1/p')
  if [ -z "$PRE_CHANNEL" ]; then
    PRE_CHANNEL="beta"
  fi
  NPM_TAG="$PRE_CHANNEL"         # npm install mmt-testlight@beta
  DOCKER_FLOAT_TAG="$PRE_CHANNEL" # testlight:beta
else
  NPM_TAG="latest"
  DOCKER_FLOAT_TAG="latest"
fi

echo "═══════════════════════════════════════════════════"
if $PRE_RELEASE; then
  echo "  testlight PRE-RELEASE — v$VERSION ($PRE_CHANNEL)"
else
  echo "  testlight release — v$VERSION"
fi
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. Build binaries ───────────────────────────────────────────────
echo "▶ Step 1: Building binaries..."
bash "$SCRIPTS_DIR/build-binaries.sh"

# ── 2. Create release archives ──────────────────────────────────────
echo ""
echo "▶ Step 2: Creating release archives..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

PLATFORMS=(macos-x64 macos-arm64 linux-x64 linux-arm64 win-x64)

for platform in "${PLATFORMS[@]}"; do
  src_dir="$BIN_DIR/$platform"
  [[ -d "$src_dir" ]] || continue

  if [[ "$platform" == win-* ]]; then
    archive="$DIST_DIR/testlight-v${VERSION}-${platform}.zip"
    (cd "$src_dir" && zip -j "$archive" testlight.exe mmt.exe)
    echo "  → $archive"
  else
    archive="$DIST_DIR/testlight-v${VERSION}-${platform}.tar.gz"
    tar -czf "$archive" -C "$src_dir" testlight mmt
    echo "  → $archive"
  fi
done

# Copy checksums
cp "$BIN_DIR/checksums-sha256.txt" "$DIST_DIR/checksums-sha256.txt"
echo "  → $DIST_DIR/checksums-sha256.txt"

# ── 3. Build Docker image ───────────────────────────────────────────
echo ""
echo "▶ Step 3: Building Docker image..."
if [[ -f "$REPO_ROOT/Dockerfile" ]]; then
  docker build -t "testlight:$VERSION" -t "testlight:$DOCKER_FLOAT_TAG" "$REPO_ROOT"
  echo "  → testlight:$VERSION (float: $DOCKER_FLOAT_TAG)"
else
  echo "  ⚠ Dockerfile not found, skipping Docker build"
fi

# ── 4. Publish to npm ───────────────────────────────────────────────
if $PUBLISH_NPM; then
  echo ""
  echo "▶ Step 4a: Publishing to npm..."
  if $PRE_RELEASE; then
    (cd "$CLI_DIR" && npm publish --access public --tag "$NPM_TAG")
    echo "  → published mmt-testlight@$VERSION to npm (tag: $NPM_TAG)"
  else
    (cd "$CLI_DIR" && npm publish --access public)
    echo "  → published mmt-testlight@$VERSION to npm (tag: latest)"
  fi
fi

# ── 5. Create GitHub Release ────────────────────────────────────────
if $PUBLISH_GITHUB; then
  echo ""
  echo "▶ Step 4b: Creating GitHub release..."
  if ! command -v gh &>/dev/null; then
    echo "  ⚠ GitHub CLI (gh) not installed. Install with: brew install gh" >&2
    echo "  Skipping GitHub release."
  else
    # Create the release
    GH_FLAGS=""
    if $PRE_RELEASE; then
      GH_FLAGS="--prerelease"
    fi
    gh release create "v$VERSION" \
      --title "testlight v$VERSION" \
      --notes "See [CHANGELOG.md](CHANGELOG.md) for details." \
      --repo mshobeyri/multimeter \
      $GH_FLAGS \
      "$DIST_DIR"/testlight-v${VERSION}-*.{tar.gz,zip} \
      "$DIST_DIR/checksums-sha256.txt" \
      || echo "  ⚠ Release v$VERSION may already exist"
    if $PRE_RELEASE; then
      echo "  → GitHub PRE-RELEASE v$VERSION created"
    else
      echo "  → GitHub release v$VERSION created"
    fi
  fi
fi

# ── 6. Push Docker image ────────────────────────────────────────────
if $PUBLISH_DOCKER; then
  echo ""
  echo "▶ Step 4c: Pushing Docker image..."
  DOCKER_REPO="${DOCKER_REPO:-mshobeyri/testlight}"
  docker tag "testlight:$VERSION" "$DOCKER_REPO:$VERSION"
  docker tag "testlight:$DOCKER_FLOAT_TAG" "$DOCKER_REPO:$DOCKER_FLOAT_TAG"
  docker push "$DOCKER_REPO:$VERSION"
  docker push "$DOCKER_REPO:$DOCKER_FLOAT_TAG"
  echo "  → pushed $DOCKER_REPO:$VERSION and :$DOCKER_FLOAT_TAG"
fi

# ── Done ─────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Release v$VERSION complete!"
echo ""
echo "  Archives:  $DIST_DIR/"
echo "  Checksums: $DIST_DIR/checksums-sha256.txt"
[[ -f "$REPO_ROOT/Dockerfile" ]] && echo "  Docker:    testlight:$VERSION"
echo "═══════════════════════════════════════════════════"
