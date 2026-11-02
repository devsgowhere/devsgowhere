import { DateTime } from "luxon"
import { describe, expect, test } from "vitest"
import { buildSearchIndex, groupByDate, isUpcoming, pastEvents, startOfToday, upcomingEvents } from "./events"

const event = (id: string, startDate: string, startTime = "19:00") => ({ id, data: { startDate, startTime } })

// 00:30 on 21 Oct 2026 in Singapore is still 20 Oct in UTC
const TODAY = startOfToday(DateTime.fromISO("2026-10-20T16:30:00Z"))

describe("startOfToday", () => {
  test("is midnight in Singapore, not UTC", () => {
    expect(TODAY.toISO()).toBe("2026-10-21T00:00:00.000+08:00")
  })
})

describe("upcoming and past events", () => {
  const events = [
    event("past-b", "2026-10-20"),
    event("today-late", "2026-10-21", "20:00"),
    event("future", "2026-11-05"),
    event("past-a", "2026-09-01"),
    event("today-early", "2026-10-21", "08:00"),
  ]

  test("an event today is upcoming, yesterday's is past", () => {
    expect(isUpcoming(event("a", "2026-10-21"), TODAY)).toBe(true)
    expect(isUpcoming(event("b", "2026-10-20"), TODAY)).toBe(false)
  })

  test("upcoming is soonest first, past is most recent first, and together they cover everything", () => {
    expect(upcomingEvents(events, TODAY).map((e) => e.id)).toEqual(["today-early", "today-late", "future"])
    expect(pastEvents(events, TODAY).map((e) => e.id)).toEqual(["past-b", "past-a"])
  })
})

describe("groupByDate", () => {
  test("groups under date headings in the given order", () => {
    const groups = groupByDate([event("c", "2026-10-28"), event("d", "2026-10-28"), event("e", "2026-10-22")])
    expect(Object.keys(groups)).toEqual(["Wed, 28 October 2026", "Thu, 22 October 2026"])
    expect(groups["Wed, 28 October 2026"].map((e) => e.id)).toEqual(["c", "d"])
  })
})

describe("buildSearchIndex", () => {
  test("includes the organiser's name, venue and a trimmed description", () => {
    const index = buildSearchIndex(
      [
        {
          id: "aws/20261028-meetup",
          data: {
            title: "AWS Meetup",
            tags: ["cloud"],
            venue: "AWS Office",
            description: "x".repeat(500),
            org: { id: "aws" },
          },
        },
        { id: "o/1", data: { title: "No extras", description: "d", org: { id: "unknown" } } },
      ],
      new Map([["aws", "AWS User Group Singapore"]]),
    )
    expect(index[0]).toMatchObject({
      id: "aws/20261028-meetup",
      org: { title: "AWS User Group Singapore" },
      venue: "AWS Office",
      tags: ["cloud"],
    })
    expect(index[0].description).toHaveLength(300)
    expect(index[1]).toEqual({
      id: "o/1",
      title: "No extras",
      tags: [],
      org: { title: "" },
      venue: "",
      description: "d",
    })
  })
})

describe("ongoing multi-day events", () => {
  const multiDay = (endDate?: string | null) => ({
    id: "community/conference",
    data: { startDate: "2026-10-20", startTime: "09:00", endDate },
  })

  test("keeps a conference upcoming throughout its final listed day", () => {
    const conference = multiDay("2026-10-22")
    expect(isUpcoming(conference, TODAY)).toBe(true)
    expect(isUpcoming(conference, TODAY.plus({ days: 1 }))).toBe(true)
    expect(isUpcoming(conference, TODAY.plus({ days: 2 }))).toBe(false)
  })

  test.each([undefined, null, "", "not-a-date", "2026-02-30", "2026-10-19"])(
    "falls back to the start day when the end date is missing, invalid or earlier (%s)",
    (endDate) => {
      expect(isUpcoming(multiDay(endDate), TODAY)).toBe(false)
    },
  )

  test("keeps ongoing events in the same complete and stably sorted partition", () => {
    const events = [event("future", "2026-10-24"), multiDay("2026-10-22"), event("today", "2026-10-21")]
    expect(upcomingEvents(events, TODAY).map((entry) => entry.id)).toEqual(["community/conference", "today", "future"])
    expect(pastEvents(events, TODAY)).toEqual([])
    expect(pastEvents(events, TODAY.plus({ days: 2 })).map((entry) => entry.id)).toEqual([
      "today",
      "community/conference",
    ])
  })
})
