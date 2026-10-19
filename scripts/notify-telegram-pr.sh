#!/usr/bin/env bash
set -euo pipefail

# notify-telegram-pr.sh
# Send a Telegram message about a pull request opened by a contributor (e.g. a meetup organizer).
# Reads the PR from the environment: PR_TITLE, PR_URL, PR_AUTHOR, PR_FILES (changed file count), PR_DRAFT (true/false).
# Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... ./scripts/notify-telegram-pr.sh
# Set DRY_RUN=1 to print the message instead of sending it.

if [ -z "${DRY_RUN:-}" ] && { [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; }; then
  echo "::warning::TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping Telegram notification"
  exit 0
fi

draft=""
[ "${PR_DRAFT:-false}" = "true" ] && draft=" (draft)"

message="🙋 New pull request${draft} from ${PR_AUTHOR:?PR_AUTHOR required}: ${PR_TITLE:?PR_TITLE required}
${PR_FILES:-?} file(s) changed

${PR_URL:?PR_URL required}"

if [ -n "${DRY_RUN:-}" ]; then
  printf "%s\n" "${message}"
  exit 0
fi

curl -fsS -o /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${message}" \
  --data-urlencode "disable_web_page_preview=true"
echo "Telegram notification sent"
