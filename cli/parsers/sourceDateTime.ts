import { DateTime } from "luxon"

const COMPLETE_DATE_TIME = /^(?:(?:[+-]\d{6}|\d{4})-?\d{2}-?\d{2}|\d{4}-?(?:W\d{2}-?\d|\d{3}))[Tt]\d{2}:?\d{2}/

export function parseSourceDateTime(source: unknown): DateTime {
  if (typeof source !== "string" || !COMPLETE_DATE_TIME.test(source)) {
    return DateTime.invalid("unparsable", "Source timestamp must include a complete date and time")
  }
  const offset = source.match(/[+-](\d{2})(?::?(\d{2}))?(?:\[[^\]]+\])?$/)
  if (offset && (Number(offset[1]) > 23 || Number(offset[2] ?? 0) > 59)) {
    return DateTime.invalid("unparsable", "Source timestamp contains an invalid UTC offset")
  }
  return DateTime.fromISO(source)
}
