import * as cheerio from "cheerio"
import { DateTime } from "luxon"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { isUpcoming } from "../src/utils/events"
import { toFeedEvent } from "../src/utils/eventsFeed"
import { PageScraper } from "./PageScraper"
import { EventbriteParser } from "./parsers/EventbriteParser"
import { LumaParser } from "./parsers/LumaParser"
import { MeetupParser } from "./parsers/MeetupParser"

const START = "2026-11-12T01:00:00Z"
const END = "2026-11-14T10:00:00Z"
const scraper = new PageScraper("unused", null)
const eventbriteUrl = "https://www.eventbrite.sg/e/offline-fixture-1"

const eventbritePage = (startDate: unknown, endDate: unknown, displayed = "") =>
  cheerio.load(
    `<script type="application/ld+json">${JSON.stringify({
      "@type": "Event",
      name: "Offline fixture",
      startDate,
      endDate,
      location: { "@type": "VirtualLocation" },
    })}</script><div class="date-info__full-datetime">${displayed}</div>`,
  )

const providers = [
  {
    name: "Eventbrite",
    scrape: (start: unknown, end: unknown) =>
      new EventbriteParser().scrapeEventDataFromPage(eventbritePage(start, end), eventbriteUrl),
  },
  {
    name: "Luma",
    scrape: (start: unknown, end: unknown) => {
      const nextData = {
        props: {
          pageProps: {
            initialData: {
              data: {
                event: {
                  name: "Offline fixture",
                  start_at: start,
                  end_at: end,
                  timezone: "Asia/Singapore",
                  location_type: "online",
                },
              },
            },
          },
        },
      }
      return new LumaParser().scrapeEventDataFromPage(
        cheerio.load(`<script id="__NEXT_DATA__">${JSON.stringify(nextData)}</script>`),
        "https://luma.com/offline-fixture",
      )
    },
  },
  {
    name: "Meetup",
    scrape: (start: unknown, end: unknown) => {
      const nextData = { props: { pageProps: { event: { title: "Offline fixture", dateTime: start, endTime: end } } } }
      return new MeetupParser().scrapeEventDataFromPage(
        cheerio.load(`<script id="__NEXT_DATA__">${JSON.stringify(nextData)}</script>`),
        "https://www.meetup.com/offline-fixture/events/123",
      )
    },
  },
]

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline fixtures must not fetch"))
})

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled()
  vi.restoreAllMocks()
})

describe("PageScraper automatic timing validation", () => {
  test.each([
    {},
    { startDate: "2026-11-12" },
    { startTime: "09:00" },
    { startDate: "Invalid DateTime", startTime: "09:00" },
    { startDate: "2026-02-30", startTime: "09:00" },
    { startDate: "2026-11-12", startTime: "24:00" },
    { startDate: "2026-11-12", startTime: "9:00" },
    { startDate: "2026-11-12", startTime: "09:60" },
  ])("rejects missing or invalid start fields: %j", async (timing) => {
    await expect(
      scraper.createEventDataFromScrapedData({ title: "Offline fixture", ...timing }, eventbriteUrl, "fixture-org"),
    ).rejects.toThrow("valid event start date/time")
  })
})

describe.each(providers)("$name offline timing", ({ scrape }) => {
  test("keeps explicit multi-day timing through automatic event creation", async () => {
    const result = await scraper.createEventDataFromScrapedData(await scrape(START, END), eventbriteUrl, "fixture-org")
    expect(result).toMatchObject({
      startDate: "2026-11-12",
      startTime: "09:00",
      endDate: "2026-11-14",
      endTime: "18:00",
    })
  })

  test.each([
    undefined,
    null,
    "",
    "not-a-date",
    "2026-11-12",
    "2026-11",
    "2026",
    "T09:00",
    "2026-11-12T09",
    "2026-02-30T09:00:00+08:00",
    "2026-11-12T25:00:00+08:00",
    "2026-11-12T09:00:00+24:00",
    "2026-11-12T09:00:00+08:60",
    123,
    {},
  ])("rejects incomplete or invalid source start %j even with a valid end", async (start) => {
    const scraped = await scrape(start, END)
    expect(scraped.startDate).toBeFalsy()
    expect(scraped.startTime).toBeFalsy()
    await expect(scraper.createEventDataFromScrapedData(scraped, eventbriteUrl, "fixture-org")).rejects.toThrow(
      "valid event start date/time",
    )
  })

  test.each([
    undefined,
    null,
    "",
    "not-a-date",
    "2026-11-14",
    "T18:00",
    "2026-11-14T18:00:00+24:00",
    "2026-11-14T18:00:00+08:60",
    "2026-11-11T10:00:00Z",
    {},
  ])("preserves the valid start without inventing an optional end: %j", async (end) => {
    const scraped = await scrape(START, end)
    const result = await scraper.createEventDataFromScrapedData(scraped, eventbriteUrl, "fixture-org")
    expect(result).toMatchObject({ startDate: "2026-11-12", startTime: "09:00" })
    expect(result.endDate).toBeFalsy()
    expect(result.endTime).toBeFalsy()
  })

  test("accepts an explicit end equal to the start", async () => {
    const scraped = await scrape(START, START)
    const result = await scraper.createEventDataFromScrapedData(scraped, eventbriteUrl, "fixture-org")
    expect(result).toMatchObject({
      startDate: "2026-11-12",
      startTime: "09:00",
      endDate: "2026-11-12",
      endTime: "09:00",
    })
  })
})

describe("Eventbrite offline source selection", () => {
  const displayed = "Thu, 12 Nov 2026 09:00 - Sat, 14 Nov 2026 18:00 GMT+8"
  const scrape = async (start: unknown, end: unknown, text = displayed) => {
    const parser = new EventbriteParser()
    const scraped = await parser.scrapeEventDataFromPage(eventbritePage(start, end, text), eventbriteUrl)
    return scraper.createEventDataFromScrapedData(scraped, eventbriteUrl, "fixture-org")
  }

  test.each([undefined, "2026-11-12", "not-a-date", "2026-11-12T09:00:00+24:00"])(
    "uses a validated rendered interval when structured start %j is unusable",
    async (start) => {
      expect(await scrape(start, "2026-11-15T10:00:00Z")).toMatchObject({
        startDate: "2026-11-12",
        startTime: "09:00",
        endDate: "2026-11-14",
        endTime: "18:00",
      })
    },
  )

  test.each([undefined, "2026-11-14", "not-a-date", "2026-11-11T10:00:00Z"])(
    "recovers a matching rendered multi-day end when structured end %j is unusable",
    async (end) => {
      const result = await scrape(START, end)
      expect(result).toMatchObject({
        startDate: "2026-11-12",
        startTime: "09:00",
        endDate: "2026-11-14",
        endTime: "18:00",
      })
      const event = { id: "fixture-org/offline-fixture", data: { ...result, org: { id: result.org } } }
      expect(isUpcoming(event, DateTime.fromISO("2026-11-13T00:00:00+08:00"))).toBe(true)
      expect(toFeedEvent(event, new Map(), new URL("https://devsgowhere.com")).end).toBe("2026-11-14T18:00:00+08:00")
    },
  )

  test("keeps a valid structured interval ahead of matching rendered timing", async () => {
    expect(await scrape(START, "2026-11-13T10:00:00Z")).toMatchObject({
      startDate: "2026-11-12",
      startTime: "09:00",
      endDate: "2026-11-13",
      endTime: "18:00",
    })
  })

  test.each(["Date and time TBA", "31 Nov 2026 09:00 - 18:00 GMT+8", "Smarch 12 · 9am - 6pm"])(
    "rejects the page when neither source supplies a valid start: %s",
    async (text) => {
      await expect(scrape("2026-11-12", END, text)).rejects.toThrow("valid event start date/time")
    },
  )

  test("does not recover a displayed end before a structured start with seconds", async () => {
    const result = await scrape("2026-11-12T09:00:30+08:00", undefined, "12 Nov 2026 09:00 - 09:00 GMT+8")
    expect(result).toMatchObject({ startDate: "2026-11-12", startTime: "09:00" })
    expect(result.endDate).toBeFalsy()
    expect(result.endTime).toBeFalsy()
  })

  test.each([
    "Fri, 13 Nov 2026 09:00 - Sat, 14 Nov 2026 18:00 GMT+8",
    "Thu, 12 Nov 2026 10:00 - Sat, 14 Nov 2026 18:00 GMT+8",
    "Thu, 12 Nov 2026 09:00 - 08:00 GMT+8",
    "Thu, 12 Nov 2026 09:00 - 31 Nov 2026 18:00 GMT+8",
    "Thu, 12 Nov 2026 09:00 - 25:00 GMT+8",
  ])("does not attach a conflicting or invalid rendered end: %s", async (text) => {
    const result = await scrape(START, undefined, text)
    expect(result).toMatchObject({ startDate: "2026-11-12", startTime: "09:00" })
    expect(result.endDate).toBeFalsy()
    expect(result.endTime).toBeFalsy()
  })

  test("keeps the structured occurrence when both displayed start and end conflict", async () => {
    expect(await scrape(START, END, "Fri, 13 Nov 2026 19:00 - 21:00 GMT+8")).toMatchObject({
      startDate: "2026-11-12",
      startTime: "09:00",
      endDate: "2026-11-14",
      endTime: "18:00",
    })
  })
})
