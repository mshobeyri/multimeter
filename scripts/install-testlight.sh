#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# install-testlight.sh — One-line installer for testlight CLI
# ──────────────────────────────────────────────────────────────────────
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/mshobeyri/multimeter/main/scripts/install-testlight.sh | bash
#
# Options (env vars):
#   VERSION=1.2.3       Install a specific version (default: latest stable)
#   PRERELEASE=1        Install the latest pre-release instead of stable
#   CHANNEL=beta        Install latest from a specific channel (beta, rc, alpha)
#   INSTALL_DIR=~/.local/bin   Where to place the binary (default: /usr/local/bin or ~/.local/bin)
#
# Pre-release examples:
#   PRERELEASE=1 curl -fsSL .../install-testlight.sh | bash
#   CHANNEL=rc   curl -fsSL .../install-testlight.sh | bash
#   VERSION=0.4.0-beta.1 curl -fsSL .../install-testlight.sh | bash
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="mshobeyri/multimeter"

# ── Detect platform & architecture ───────────────────────────────────
detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="macos" ;;
    Linux)  os="linux" ;;
    MINGW*|MSYS*|CYGWIN*) os="win" ;;
    *)
      echo "ERROR: Unsupported OS: $os" >&2
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)
      echo "ERROR: Unsupported architecture: $arch" >&2
      exit 1
      ;;
  esac

  # Windows only has x64 builds
  if [[ "$os" == "win" && "$arch" == "arm64" ]]; then
    echo "WARN: No Windows arm64 build; falling back to x64" >&2
    arch="x64"
  fi

  echo "${os}-${arch}"
}

# ── Resolve version from GitHub ─────────────────────────────────────────
resolve_version() {
  if [[ -n "${VERSION:-}" ]]; then
    echo "$VERSION"
    return
  fi

  local prerelease="${PRERELEASE:-}"
  local channel="${CHANNEL:-}"

  # If CHANNEL is set, treat it as a pre-release request
  if [[ -n "$channel" ]]; then
    prerelease=1
  fi

  if [[ -n "$prerelease" && "$prerelease" != "0" ]]; then
    # Fetch the latest pre-release (optionally filtered by channel)
    local releases
    releases=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases?per_page=20")

    local version
    if [[ -n "$channel" ]]; then
      # Find latest pre-release matching the channel (e.g. beta, rc)
      version=$(echo "$releases" \
        | grep '"tag_name"' \
        | grep -i "$channel" \
        | head -1 \
        | sed 's/.*"v\(.*\)".*/\1/')
    else
      # Find any pre-release (tag contains a hyphen)
      version=$(echo "$releases" \
        | grep '"tag_name"' \
        | grep '"v[0-9]*\.[0-9]*\.[0-9]*-' \
        | head -1 \
        | sed 's/.*"v\(.*\)".*/\1/')
    fi

    if [[ -n "$version" ]]; then
      echo "$version"
      return
    fi
    echo "WARN: No pre-release found${channel:+ for channel '$channel'}; falling back to latest stable" >&2
  fi

  # Default: latest stable release
  local latest
  latest=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed 's/.*"v\(.*\)".*/\1/')

  if [[ -z "$latest" ]]; then
    echo "ERROR: Could not determine latest version" >&2
    exit 1
  fi
  echo "$latest"
}

# ── Determine install directory ──────────────────────────────────────
resolve_install_dir() {
  if [[ -n "${INSTALL_DIR:-}" ]]; then
    echo "$INSTALL_DIR"
    return
  fi

  # Prefer /usr/local/bin if writable, otherwise ~/.local/bin
  if [[ -w "/usr/local/bin" ]]; then
    echo "/usr/local/bin"
  else
    echo "${HOME}/.local/bin"
  fi
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
  local platform version install_dir url archive_ext tmp_dir

  platform=$(detect_platform)
  version=$(resolve_version)
  install_dir=$(resolve_install_dir)

  echo "Installing testlight v${version} for ${platform}..."
  echo "  Target: ${install_dir}"

  if [[ "$platform" == win-* ]]; then
    archive_ext="zip"
  else
    archive_ext="tar.gz"
  fi

  url="https://github.com/${REPO}/releases/download/v${version}/testlight-v${version}-${platform}.${archive_ext}"

  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' EXIT

  echo "  Downloading: $url"
  curl -fsSL "$url" -o "$tmp_dir/testlight.${archive_ext}"

  echo "  Extracting..."
  if [[ "$archive_ext" == "zip" ]]; then
    unzip -q "$tmp_dir/testlight.zip" -d "$tmp_dir"
  else
    tar -xzf "$tmp_dir/testlight.tar.gz" -C "$tmp_dir"
  fi

  # Install binaries
  mkdir -p "$install_dir"

  if [[ "$platform" == win-* ]]; then
    cp "$tmp_dir/testlight.exe" "$install_dir/testlight.exe"
    cp "$tmp_dir/mmt.exe" "$install_dir/mmt.exe"
  else
    cp "$tmp_dir/testlight" "$install_dir/testlight"
    chmod +x "$install_dir/testlight"
    # Create mmt symlink
    ln -sf "$install_dir/testlight" "$install_dir/mmt"
  fi

  echo ""
  echo "✓ testlight v${version} installed to ${install_dir}"
  if echo "$version" | grep -qE '[-](alpha|beta|rc|dev|canary)'; then
    echo "  (pre-release)"
  fi
  echo "  Both 'testlight' and 'mmt' commands are available."

  # Check if install_dir is in PATH
  if ! echo "$PATH" | tr ':' '\n' | grep -qx "$install_dir"; then
    echo ""
    echo "  ⚠ ${install_dir} is not in your PATH. Add it:"
    echo "    export PATH=\"${install_dir}:\$PATH\""
  fi
}

main
