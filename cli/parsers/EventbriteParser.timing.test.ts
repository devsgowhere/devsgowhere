import { describe, expect, test } from "vitest"
import { EventbriteParser } from "./EventbriteParser"

const parser = new EventbriteParser()
const reference = new Date("2026-11-01T00:00:00+08:00")

describe("Eventbrite rendered timing validation", () => {
  test.each(["Smarch 12 · 9am - 6pm", "November 31 · 9am - 6pm", "November 12 · 13am - 6pm"])(
    "rejects invalid rendered starts: %s",
    (text) => {
      expect(parser.dateTimeParser(text, reference)).toEqual({})
    },
  )

  test.each([
    "November 12 · 9am",
    "November 12 · 9am - Smarch 14 · 6pm",
    "November 12 · 9am - November 31 · 6pm",
    "November 12 · 9am - 8am",
    "November 12 · 9am - 13pm",
    "November 12 · 9am - 6:60pm",
    "November 12 · 9am - unknown",
    "12 Nov 2026 09:00",
    "12 Nov 2026 09:00 - 31 Nov 2026 18:00",
    "12 Nov 2026 09:00 - 08:00",
  ])("keeps a validated start independently of an unusable end: %s", (text) => {
    expect(parser.dateTimeParser(text, reference)).toEqual({ startDate: "2026-11-12", startTime: "09:00" })
  })

  test.each(["Nov", "November", "november"])("preserves existing month-prefix support: %s", (month) => {
    expect(parser.dateTimeParser(`${month} 12 · 9am - ${month} 14 · 6pm`, reference)).toEqual({
      startDate: "2026-11-12",
      startTime: "09:00",
      endDate: "2026-11-14",
      endTime: "18:00",
    })
  })

  test("does not infer an AM/PM period when neither endpoint supplies one", () => {
    expect(parser.dateTimeParser("November 12 · 9 - 6", reference)).toEqual({})
  })
})
