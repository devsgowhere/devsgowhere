import { DateTime } from "luxon"

// Require a full calendar, week or ordinal date and hours/minutes. Luxon validates the remaining ISO syntax.
const COMPLETE_DATE_TIME = /^(?:(?:[+-]\d{6}|\d{4})-?\d{2}-?\d{2}|\d{4}-?(?:W\d{2}-?\d|\d{3}))[Tt]\d{2}:?\d{2}/

/** Unlike fromISO alone, never fill a missing source date with today or a missing time with midnight. */
export function parseSourceDateTime(source: unknown): DateTime {
  if (typeof source !== "string" || !COMPLETE_DATE_TIME.test(source)) {
    return DateTime.invalid("unparsable", "Source timestamp must include a complete date and time")
  }
  return DateTime.fromISO(source)
}
