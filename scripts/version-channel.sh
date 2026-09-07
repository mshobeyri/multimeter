#!/usr/bin/env bash
# Shared pre-release detection for Testlight, the VS Code extension, and the GitHub Action.
# X.Y.0 is a pre-release (same convention as the Marketplace). Suffixes like -beta.1 also are.

is_prerelease() {
  local version="$1"
  if echo "$version" | grep -qE '[-](alpha|beta|rc|dev|canary)'; then
    return 0
  fi
  echo "$version" | grep -qE '^[0-9]+\.[0-9]+\.0$'
}

prerelease_channel() {
  local version="$1"
  local channel
  channel=$(echo "$version" | sed -n 's/.*-\([a-z]*\).*/\1/p')
  if [ -z "$channel" ]; then
    channel="beta"
  fi
  echo "$channel"
}

# Writes version / prerelease / npm_tag / float_tag to $GITHUB_OUTPUT when set.
emit_github_outputs() {
  local version="$1"
  local out="${GITHUB_OUTPUT:-/dev/stdout}"
  echo "version=${version}" >> "$out"
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
