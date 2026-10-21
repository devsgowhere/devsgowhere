import { describe, expect, test } from "vitest"
import { buildEventsFeed, FEED_VERSION, toFeedEvent } from "./eventsFeed"

const SITE = new URL("https://devsgowhere.com")
const ORGS = new Map([
  ["stack_govtech", "STACK by GovTech"],
  ["taqelah-sg", "TAQELAH Singapore"],
])

type Data = Parameters<typeof toFeedEvent>[0]["data"]

const event = (id: string, data: Partial<Data> = {}) => ({
  id,
  data: {
    title: "STACK Meetup [Cybersecurity]",
    description: "A meetup.",
    venue: "GovTech HQ",
    venueAddress: "10 Pasir Panjang Rd, Singapore",
    startDate: "2026-10-22",
    startTime: "18:30",
    endTime: "20:30",
    rsvpButtonUrl: "https://www.meetup.com/stack-community/events/316176090",
    tags: ["cybersecurity"],
    org: { id: "stack_govtech" },
    ...data,
  },
})

describe("toFeedEvent", () => {
  test("maps an event to the documented shape", () => {
    expect(toFeedEvent(event("stack_govtech/20261022-stack-meetup"), ORGS, SITE)).toEqual({
      id: "stack_govtech/20261022-stack-meetup",
      title: "STACK Meetup [Cybersecurity]",
      description: "A meetup.",
      url: "https://devsgowhere.com/events/stack_govtech/20261022-stack-meetup/",
      rsvpUrl: "https://www.meetup.com/stack-community/events/316176090",
      start: "2026-10-22T18:30:00+08:00",
      end: "2026-10-22T20:30:00+08:00",
      timezone: "Asia/Singapore",
      venue: "GovTech HQ",
      venueAddress: "10 Pasir Panjang Rd, Singapore",
      org: { id: "stack_govtech", title: "STACK by GovTech", url: "https://devsgowhere.com/orgs/stack_govtech/" },
      tags: ["cybersecurity"],
      updatedAt: null,
    })
  })

  test("uses null, not empty strings, for missing values", () => {
    const feedEvent = toFeedEvent(
      event("a/1", { venue: "", venueAddress: "  ", rsvpButtonUrl: null, endTime: null, tags: undefined }),
      ORGS,
      SITE,
    )
    expect(feedEvent).toMatchObject({ venue: null, venueAddress: null, rsvpUrl: null, end: null, tags: [] })
    expect(toFeedEvent(event("a/1", { description: " \n " }), ORGS, SITE).description).toBeNull()
  })

  test("an end time without an end date is on the start date, an end date moves it", () => {
    expect(toFeedEvent(event("a/1", { endTime: "01:00", startTime: "22:00" }), ORGS, SITE).end).toBeNull()
    expect(
      toFeedEvent(event("a/1", { endDate: "2026-10-23", endTime: "01:00", startTime: "22:00" }), ORGS, SITE).end,
    ).toBe("2026-10-23T01:00:00+08:00")
    expect(toFeedEvent(event("a/1", { endDate: "2026-10-24", endTime: "17:00" }), ORGS, SITE).end).toBe(
      "2026-10-24T17:00:00+08:00",
    )
  })

  test("has no end when it is missing its time or isn't after the start", () => {
    expect(toFeedEvent(event("a/1", { endDate: "2026-10-23", endTime: null }), ORGS, SITE).end).toBeNull()
    expect(toFeedEvent(event("a/1", { startTime: "18:30", endTime: "17:00" }), ORGS, SITE).end).toBeNull()
  })

  test("uses the event's own timezone for the offset", () => {
    const feedEvent = toFeedEvent(
      event("a/1", { timezone: "Asia/Kolkata", startTime: "10:00", endTime: "12:00" }),
      ORGS,
      SITE,
    )
    expect(feedEvent).toMatchObject({
      timezone: "Asia/Kolkata",
      start: "2026-10-22T10:00:00+05:30",
      end: "2026-10-22T12:00:00+05:30",
    })
  })

  test("tidies descriptions and tags, and formats the update date", () => {
    const feedEvent = toFeedEvent(
      event("a/1", {
        description: "  Line one\nline   two  ",
        tags: ["#java", "##java", "spring boot", " "],
        updatedDate: new Date("2026-10-20T00:00:00Z"),
      }),
      ORGS,
      SITE,
    )
    expect(feedEvent).toMatchObject({
      description: "Line one line two",
      tags: ["java", "spring boot"],
      updatedAt: "2026-10-20",
    })
  })

  test("falls back to the org id when it has no title", () => {
    expect(toFeedEvent(event("a/1", { org: { id: "unknown_org" } }), ORGS, SITE).org.title).toBe("unknown_org")
  })

  test("throws, naming the event, on an invalid date or timezone", () => {
    expect(() => toFeedEvent(event("a/bad", { startDate: "2026-13-40" }), ORGS, SITE)).toThrow("Event a/bad")
    expect(() => toFeedEvent(event("a/tz", { timezone: "Mars/Olympus" }), ORGS, SITE)).toThrow("Event a/tz")
  })
})

describe("buildEventsFeed", () => {
  test("wraps the events with the version and build time, soonest first", () => {
    const feed = buildEventsFeed(
      [
        event("b/2", { startDate: "2026-11-05" }),
        event("a/1", { startDate: "2026-10-22", startTime: "19:00" }),
        event("a/0", { startDate: "2026-10-22", startTime: "08:00" }),
      ],
      ORGS,
      SITE,
      new Date("2026-10-21T16:00:00.293Z"),
    )
    expect(feed.version).toBe(FEED_VERSION)
    expect(feed.version).toBe(1)
    expect(feed.generatedAt).toBe("2026-10-21T16:00:00Z")
    expect(feed.events.map((e) => e.id)).toEqual(["a/0", "a/1", "b/2"])
  })

  test("an empty list is a valid feed", () => {
    expect(buildEventsFeed([], ORGS, SITE).events).toEqual([])
  })
})
