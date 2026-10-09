#!/usr/bin/env bash
set -euo pipefail

# scripts/fork-update.sh
# Routine to update/rebase the fork onto an upstream inspector tag.

if [ $# -lt 1 ]; then
  echo "Usage: $0 <inspector-tag>"
  echo "Example: $0 @mcp-use/inspector@20.3.15"
  exit 1
fi

TAG_ARG="$1"

# Normalize tag if passed as just version number
if git rev-parse -q --verify "$TAG_ARG^{commit}" >/dev/null; then
  TAG="$TAG_ARG"
elif git rev-parse -q --verify "@mcp-use/inspector@$TAG_ARG^{commit}" >/dev/null; then
  TAG="@mcp-use/inspector@$TAG_ARG"
else
  TAG="$TAG_ARG"
fi

# Ensure working directory is clean
if ! git diff-index --quiet HEAD --; then
  echo "Error: Working directory has uncommitted changes. Please commit or stash before updating." >&2
  exit 1
fi

echo "==> 1. Fetching upstream tags..."
git fetch upstream --tags

if ! git rev-parse -q --verify "$TAG^{commit}" >/dev/null; then
  echo "Error: Tag '$TAG' not found in git repository." >&2
  exit 1
fi

START_TIME=$(date +%s)
echo "==> 2. Rebasing onto $TAG..."
git rebase "$TAG"

echo "==> 3. Installing dependencies..."
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript install

echo "==> 4. Building workspace dependencies and inspector..."
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/client build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/agent build
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/inspector build

echo "==> 5. Running unit tests..."
NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false pnpm --dir libraries/typescript --filter @mcp-use/inspector test

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "==> 6. Listing fork hooks in upstream files:"
echo "--------------------------------------------------"
git grep -n "fork:" || echo "(No hook lines found)"
echo "--------------------------------------------------"

echo ""
echo "=================================================="
echo "Update completed successfully!"
echo "Target tag:   $TAG"
echo "Duration:     ${MINUTES}m ${SECONDS}s (${DURATION}s)"
echo "Next step:    Record this update in FORK.md:"
echo "  Last update: $(date +%Y-%m-%d), to $TAG, took ${MINUTES}m ${SECONDS}s, conflicts: none."
echo "=================================================="
