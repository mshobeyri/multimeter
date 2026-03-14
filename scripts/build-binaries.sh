#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# build-binaries.sh — Build testlight + mmt binaries for all platforms
# ──────────────────────────────────────────────────────────────────────
# Targets:
#   macos-x64, macos-arm64, linux-x64, linux-arm64, win-x64
#
# Output structure (under repo-root/bin/):
#   bin/
#   ├── macos-x64/    testlight  mmt  (symlink)
#   ├── macos-arm64/  testlight  mmt  (symlink)
#   ├── linux-x64/    testlight  mmt  (symlink)
#   ├── linux-arm64/  testlight  mmt  (symlink)
#   ├── win-x64/      testlight.exe  mmt.exe  (copy)
#   ├── docker/       Dockerfile  README.md
#   ├── homebrew/     testlight.rb
#   ├── github-action/ action.yml  README.md
#   ├── npm/          package.json  README.md
#   ├── install.sh
#   └── checksums-sha256.txt
#
# Prerequisites: npm, node ≥ 18, pkg (installed as devDep in mmtcli)
# Usage:
#   ./scripts/build-binaries.sh                       # build all targets
#   ./scripts/build-binaries.sh macos-arm64 linux-x64 # build specific targets
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$REPO_ROOT/bin"
CLI_DIR="$REPO_ROOT/mmtcli"

# ── Platform → pkg target mapping (portable, no associative arrays) ──
pkg_target_for() {
  case "$1" in
    macos-x64)   echo "node18-macos-x64" ;;
    macos-arm64) echo "node18-macos-arm64" ;;
    linux-x64)   echo "node18-linux-x64" ;;
    linux-arm64) echo "node18-linux-arm64" ;;
    win-x64)     echo "node18-win-x64" ;;
    *) return 1 ;;
  esac
}

ALL_PLATFORMS="macos-x64 macos-arm64 linux-x64 linux-arm64 win-x64"

# If arguments given, build only those; otherwise build all
if [ $# -gt 0 ]; then
  PLATFORMS="$*"
else
  PLATFORMS="$ALL_PLATFORMS"
fi

# ── Validate requested platforms ─────────────────────────────────────
for p in $PLATFORMS; do
  if ! pkg_target_for "$p" >/dev/null 2>&1; then
    echo "ERROR: Unknown platform '$p'. Valid: $ALL_PLATFORMS" >&2
    exit 1
  fi
done

echo "─── Building testlight binaries ───"
echo "Platforms: $PLATFORMS"
echo ""

# ── 1. Build core + CLI TypeScript (CJS for pkg) ────────────────────
echo "▸ Compiling core..."
(cd "$REPO_ROOT/core" && npm run build --silent)

echo "▸ Compiling CLI (CJS)..."
(cd "$CLI_DIR" && rm -rf dist-cjs 2>/dev/null || true)
(cd "$CLI_DIR" && npm run build:cjs --silent)

# ── 2. Build each platform binary ───────────────────────────────────
for platform in $PLATFORMS; do
  pkg_target="$(pkg_target_for "$platform")"
  out_dir="$BIN_DIR/$platform"
  mkdir -p "$out_dir"

  # Determine binary name based on platform
  if echo "$platform" | grep -q '^win-'; then
    bin_name="testlight.exe"
    alias_name="mmt.exe"
  else
    bin_name="testlight"
    alias_name="mmt"
  fi

  echo "▸ Building $platform ($pkg_target) → $out_dir/$bin_name"

  (cd "$CLI_DIR" && npx pkg src/pkg-entry.cjs \
    --targets "$pkg_target" \
    --output "$out_dir/$bin_name")

  # Create mmt alias
  if echo "$platform" | grep -q '^win-'; then
    # Windows: copy (symlinks are unreliable on Windows)
    cp "$out_dir/$bin_name" "$out_dir/$alias_name"
    echo "  → copied $alias_name"
  else
    # Unix: symlink mmt → testlight
    (cd "$out_dir" && ln -sf "$bin_name" "$alias_name")
    echo "  → symlinked $alias_name → $bin_name"
  fi
done

# ── 3. Generate checksums ───────────────────────────────────────────
echo ""
echo "▸ Generating checksums..."
CHECKSUM_FILE="$BIN_DIR/checksums-sha256.txt"
: > "$CHECKSUM_FILE"

for platform in $PLATFORMS; do
  out_dir="$BIN_DIR/$platform"
  for f in "$out_dir"/testlight* "$out_dir"/mmt*; do
    [ -f "$f" ] || continue
    [ -L "$f" ] && continue  # skip symlinks
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$f" | sed "s|$BIN_DIR/||" >> "$CHECKSUM_FILE"
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 "$f" | sed "s|$BIN_DIR/||" >> "$CHECKSUM_FILE"
    fi
  done
done

echo "  → $CHECKSUM_FILE"

# ── 4. Copy distribution artefacts into bin/ folders ─────────────────
echo ""
echo "▸ Populating distribution folders..."

# Docker
docker_dir="$BIN_DIR/docker"
mkdir -p "$docker_dir"
cp "$REPO_ROOT/Dockerfile" "$docker_dir/Dockerfile" 2>/dev/null || true
cat > "$docker_dir/README.md" <<'DOCKERREADME'
# testlight Docker Image

## Build

```sh
docker build -t testlight .
```

## Run

```sh
docker run --rm -v "$PWD:/workspace" -w /workspace testlight run tests/suite.mmt
docker run --rm -v "$PWD:/workspace" -w /workspace testlight doc api/catalog.mmt
```

Both `testlight` and `mmt` entrypoints are available:

```sh
docker run --rm --entrypoint mmt testlight --version
```
DOCKERREADME
echo "  → $docker_dir/"

# Homebrew
homebrew_dir="$BIN_DIR/homebrew"
mkdir -p "$homebrew_dir"
if [ -f "$REPO_ROOT/packaging/homebrew/testlight.rb" ]; then
  cp "$REPO_ROOT/packaging/homebrew/testlight.rb" "$homebrew_dir/testlight.rb"
fi
echo "  → $homebrew_dir/"

# GitHub Action
action_dir="$BIN_DIR/github-action"
mkdir -p "$action_dir"
if [ -d "$REPO_ROOT/.github/actions/testlight" ]; then
  cp "$REPO_ROOT/.github/actions/testlight/action.yml" "$action_dir/action.yml" 2>/dev/null || true
  cp "$REPO_ROOT/.github/actions/testlight/README.md" "$action_dir/README.md" 2>/dev/null || true
fi
echo "  → $action_dir/"

# npm reference
npm_dir="$BIN_DIR/npm"
mkdir -p "$npm_dir"
cat > "$npm_dir/README.md" <<'NPMREADME'
# testlight on npm

Install globally:

```sh
npm install -g mmt-testlight
```

Or run without installing:

```sh
npx testlight run tests/suite.mmt
npx mmt run tests/suite.mmt
```

Both `testlight` and `mmt` commands are available.
NPMREADME
# Copy the CLI package.json as reference
cp "$CLI_DIR/package.json" "$npm_dir/package.json" 2>/dev/null || true
echo "  → $npm_dir/"

# Install script
if [ -f "$REPO_ROOT/scripts/install-testlight.sh" ]; then
  cp "$REPO_ROOT/scripts/install-testlight.sh" "$BIN_DIR/install.sh"
  chmod +x "$BIN_DIR/install.sh"
  echo "  → $BIN_DIR/install.sh"
fi

# ── 5. Summary ──────────────────────────────────────────────────────
echo ""
echo "─── Build complete ───"
for platform in $PLATFORMS; do
  out_dir="$BIN_DIR/$platform"
  echo "  $platform/:"
  ls -lh "$out_dir/" | grep -E 'testlight|mmt' | awk '{print "    "$NF" ("$5")"}'
done
echo ""
echo "  Distribution folders:"
echo "    docker/          Dockerfile + README"
echo "    homebrew/        Homebrew formula"
echo "    github-action/   GitHub Action (action.yml)"
echo "    npm/             npm package reference"
echo "    install.sh       One-line installer script"
echo ""
echo "Checksums: $CHECKSUM_FILE"
