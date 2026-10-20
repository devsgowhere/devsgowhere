#!/usr/bin/env bash
set -euo pipefail

# notify-telegram-failure.sh
# Send a Telegram alert about a failed workflow run.
# Reads the run from the environment: WORKFLOW_NAME, RUN_URL, CONCLUSION, and optionally RUN_TITLE (commit message or
# PR title), BRANCH, EVENT (what triggered it), ATTEMPT (re-run number) and FAILED_JOBS (one job name per line).
# Usage: TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... ./scripts/notify-telegram-failure.sh
# Set DRY_RUN=1 to print the message instead of sending it.

if [ -z "${DRY_RUN:-}" ] && { [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; }; then
  echo "::warning::TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping Telegram notification"
  exit 0
fi

case "${CONCLUSION:?CONCLUSION required}" in
  timed_out) outcome="timed out" ;;
  startup_failure) outcome="failed to start" ;;
  *) outcome="failed" ;;
esac

# scheduled and manual runs are titled with the workflow's name, which the first line already shows
[ "${RUN_TITLE:-}" = "${WORKFLOW_NAME:-}" ] && RUN_TITLE=""

attempt=""
[ "${ATTEMPT:-1}" -gt 1 ] 2>/dev/null && attempt=" (attempt ${ATTEMPT})"

details="${RUN_TITLE:+${RUN_TITLE}
}${BRANCH:+Branch: ${BRANCH}}${EVENT:+${BRANCH:+, }trigger: ${EVENT}}"
jobs=""
if [ -n "${FAILED_JOBS:-}" ]; then
  jobs="
Failed: $(printf "%s" "${FAILED_JOBS}" | paste -sd ',' - | sed 's/,/, /g')"
fi

message="🚨 ${WORKFLOW_NAME:?WORKFLOW_NAME required} ${outcome}${attempt}
${details}${jobs}

${RUN_URL:?RUN_URL required}"

if [ -n "${DRY_RUN:-}" ]; then
  printf "%s\n" "${message}"
  exit 0
fi

curl -fsS -o /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${message}" \
  --data-urlencode "disable_web_page_preview=true"
echo "Telegram notification sent"
