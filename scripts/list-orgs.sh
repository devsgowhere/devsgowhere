#!/usr/bin/env bash
set -euo pipefail

# list-orgs.sh
# Prints the names of immediate subdirectories under ./src/content/orgs
# Usage: ./scripts/list-orgs.sh [path]

ROOT_DIR="${1:-./src/content/orgs}"

if [ ! -d "$ROOT_DIR" ]; then
  echo "Directory not found: $ROOT_DIR" >&2
  exit 1
fi

for entry in "$ROOT_DIR"/*; do
  [ -d "$entry" ] || continue
  basename "$entry"
done

exit 0
