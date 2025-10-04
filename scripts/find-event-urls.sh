#!/usr/bin/env bash
set -euo pipefail

# find-rsvp.sh
# Print only unique HTTP(S) URLs extracted from rsvpButtonUrl lines in Markdown files.
# Usage: ./scripts/find-rsvp.sh [path]

ROOT_DIR="${1:-.}"

matches=$(grep -RIn --include='*.md' --binary-files=without-match --exclude-dir=.git --exclude-dir=node_modules 'rsvpButtonUrl' "${ROOT_DIR}" 2>/dev/null || true)

if [ -z "${matches}" ]; then
  exit 1
fi

printf "%s\n" "${matches}" \
  | sed -E "s/.*rsvpButtonUrl:[[:space:]]*[\"']?([^\"' ]+).*/\\1/" \
  | grep -E '^https?://' \
  | sort -u

exit 0
