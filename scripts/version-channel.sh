#!/usr/bin/env bash
# vX.Y.Z = stable. vX.Y.Z-pre = pre. Marketplace identity is always X.Y.Z.

is_prerelease() {
  local version="$1"
  echo "$version" | grep -qE -- '-pre([.-]|$)'
}

prerelease_channel() {
  echo "pre"
}

marketplace_version() {
  echo "$1" | sed 's/-pre$//'
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
