#!/usr/bin/env bash
# Shared pre-release detection for Testlight, the VS Code extension, and the GitHub Action.
# Two channels only:
#   v1.41.2       → stable
#   v1.41.2-pre   → pre-release (also 1.41.2-pre.1)
# A plain X.Y.Z tag is always stable.

is_prerelease() {
  local version="$1"
  echo "$version" | grep -qE -- '-pre([.-]|$)'
}

prerelease_channel() {
  echo "pre"
}

# Marketplace only accepts major.minor.patch. 1.41.2-pre → 1.41.2
marketplace_version() {
  echo "$1" | sed -E 's/-pre([.].*)?$//'
}

# Writes version / prerelease / npm_tag / float_tag to $GITHUB_OUTPUT when set.
emit_github_outputs() {
  local version="$1"
  local out="${GITHUB_OUTPUT:-/dev/stdout}"
  echo "version=${version}" >> "$out"
  echo "marketplace_version=$(marketplace_version "$version")" >> "$out"
  if is_prerelease "$version"; then
    local channel
    channel=$(prerelease_channel "$version")
    echo "prerelease=true" >> "$out"
    echo "npm_tag=${channel}" >> "$out"
    echo "float_tag=${channel}" >> "$out"
    echo "channel=${channel}" >> "$out"
  else
    echo "prerelease=false" >> "$out"
    echo "npm_tag=latest" >> "$out"
    echo "float_tag=latest" >> "$out"
    echo "channel=latest" >> "$out"
  fi
}
