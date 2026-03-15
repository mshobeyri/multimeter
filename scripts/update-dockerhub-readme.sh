#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────
# Update Docker Hub repository description from packaging/docker/README.md
#
# Usage:
#   ./scripts/update-dockerhub-readme.sh
#
# Requires:
#   DOCKERHUB_USERNAME  (default: mshobeyri)
#   DOCKERHUB_TOKEN     — a Personal Access Token (create at https://hub.docker.com/settings/security)
#
# Or pass credentials interactively when prompted.
# ──────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NAMESPACE="${DOCKERHUB_USERNAME:-mshobeyri}"
REPO_NAME="mmt-testlight"
README_PATH="$REPO_ROOT/packaging/docker/README.md"
SHORT_DESC="Multimeter CLI — run .mmt API tests, suites, and generate docs from the terminal or CI/CD"

if [ ! -f "$README_PATH" ]; then
  echo "ERROR: $README_PATH not found" >&2
  exit 1
fi

# Get credentials
if [ -z "${DOCKERHUB_TOKEN:-}" ]; then
  echo -n "Docker Hub username [$NAMESPACE]: "
  read -r input_user
  [ -n "$input_user" ] && NAMESPACE="$input_user"

  echo -n "Docker Hub Personal Access Token: "
  read -rs input_token
  echo
  DOCKERHUB_TOKEN="$input_token"
fi

# Authenticate and get JWT
echo "Logging in to Docker Hub..."
JWT=$(curl -s -X POST "https://hub.docker.com/v2/users/login/" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$NAMESPACE\",\"password\":\"$DOCKERHUB_TOKEN\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

if [ -z "$JWT" ]; then
  echo "ERROR: Failed to authenticate with Docker Hub" >&2
  exit 1
fi

echo "Authenticated. Updating $NAMESPACE/$REPO_NAME description..."

# Read README and escape for JSON
FULL_DESC=$(python3 -c "
import json, sys
with open('$README_PATH') as f:
    print(json.dumps(f.read()))
")

# Patch repository description
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X PATCH "https://hub.docker.com/v2/repositories/$NAMESPACE/$REPO_NAME/" \
  -H "Authorization: JWT $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"description\":\"$SHORT_DESC\",\"full_description\":$FULL_DESC}")

if [ "$HTTP_CODE" = "200" ]; then
  echo "Done! Description updated at https://hub.docker.com/r/$NAMESPACE/$REPO_NAME"
else
  echo "ERROR: Docker Hub returned HTTP $HTTP_CODE" >&2
  exit 1
fi
