#!/usr/bin/env bash
set -euo pipefail

# notify-telegram.sh
# Send a Telegram message about an event discovery PR, listing the events from the discovery summary.
# Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... ./scripts/notify-telegram.sh <summary.md> <pr_url> <created|updated>
# Set DRY_RUN=1 to print the message instead of sending it.

SUMMARY_FILE="${1:?summary file required}"
PR_URL="${2:?PR URL required}"
OPERATION="${3:-updated}"
MAX_EVENTS=20

if [ -z "${DRY_RUN:-}" ] && { [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; }; then
  echo "::warning::TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping Telegram notification"
  exit 0
fi

# Event lines look like: - `org_id` 2026-10-22 [Event title](https://...)
events=$(sed -n '/^### Added/,/^$/p' "${SUMMARY_FILE}" | grep '^- ' || true)
count=$(printf "%s" "${events}" | grep -c '^- ' || true)
listing=$(printf "%s\n" "${events}" \
  | head -n "${MAX_EVENTS}" \
  | sed -E 's/^- `([^`]*)` ([0-9-]+) \[(.*)\]\(.*\)$/• \2  \3 (\1)/')
if [ "${count}" -gt "${MAX_EVENTS}" ]; then
  listing="${listing}
…and $((count - MAX_EVENTS)) more"
fi

if [ "${OPERATION}" = "created" ]; then
  heading="📅 Event discovery found ${count} new event(s) for DevsGoWhere"
else
  heading="📅 Event discovery PR updated: ${count} event(s) awaiting review"
fi

message="${heading}
${listing:+
${listing}
}
Review: ${PR_URL}"

if [ -n "${DRY_RUN:-}" ]; then
  printf "%s\n" "${message}"
  exit 0
fi

curl -fsS -o /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${message}" \
  --data-urlencode "disable_web_page_preview=true"
echo "Telegram notification sent"
