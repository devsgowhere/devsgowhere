import { afterEach, describe, expect, test, vi } from "vitest"
import * as cheerio from "cheerio"
import { Settings } from "luxon"
import { PageScraper } from "./PageScraper"
import { EventbriteParser } from "./parsers/EventbriteParser"
import { LumaParser } from "./parsers/LumaParser"
import { MeetupParser } from "./parsers/MeetupParser"
import type { ScrapedEventData } from "./types"

const scraped: ScrapedEventData = {
  title: "Community meetup",
  startDate: "2026-11-05",
  startTime: "18:30",
  endDate: "2026-11-05",
  endTime: "20:30",
  venue: "Community space",
}

const createEvent = (data: ScrapedEventData) =>
  new PageScraper("scraper-output", null).createEventDataFromScrapedData(data, "https://luma.com/example", "community")

const providers = [
  {
    name: "Meetup",
    parse: (start: unknown, end: unknown = "2026-11-05T12:30:00Z") =>
      new MeetupParser().scrapeEventDataFromEvent(
        { title: "Meetup event", dateTime: start, endTime: end, venue: { name: "Community space" } },
        "https://www.meetup.com/community/events/123/",
      ),
  },
  {
    name: "Luma",
    parse: (start: unknown, end: unknown = "2026-11-05T12:30:00Z") =>
      new LumaParser().scrapeEventDataFromPage(
        cheerio.load(
          `<script id="__NEXT_DATA__">${JSON.stringify({
            props: {
              pageProps: {
                initialData: {
                  data: {
                    event: {
                      name: "Luma event",
                      start_at: start,
                      end_at: end,
                      timezone: "Asia/Singapore",
                      location_type: "online",
                    },
                  },
                },
              },
            },
          })}</script>`,
        ),
        "https://luma.com/example",
      ),
  },
  {
    name: "Eventbrite",
    parse: (start: unknown, end: unknown = "2026-11-05T12:30:00Z") =>
      new EventbriteParser().scrapeEventDataFromPage(
        cheerio.load(
          `<script type="application/ld+json">${JSON.stringify({
            "@type": "Event",
            name: "Eventbrite event",
            startDate: start,
            endDate: end,
            location: { "@type": "VirtualLocation" },
          })}</script>`,
        ),
        "https://www.eventbrite.sg/e/example-123",
      ),
  },
]

const originalZone = Settings.defaultZone
afterEach(() => {
  vi.useRealTimers()
  Settings.defaultZone = originalZone
})

describe("automated scraped event timing", () => {
  test.each([{ startDate: undefined }, { startTime: undefined }, { startDate: "", startTime: "" }])(
    "rejects missing timing rather than filling in a date or 19:00 (%j)",
    async (missing) => {
      await expect(createEvent({ ...scraped, ...missing })).rejects.toThrow(/valid event start date\/time/)
    },
  )

  test.each([
    { startDate: "2026-02-30" },
    { startDate: "2026-13-05" },
    { startDate: "2026-11" },
    { startDate: "2026-11-05T18:30:00+08:00" },
    { startTime: "24:00" },
    { startTime: "18:60" },
    { startTime: "6:30pm" },
    { startTime: "18:30:00" },
  ])("rejects invalid or non-canonical timing (%j)", async (invalid) => {
    await expect(createEvent({ ...scraped, ...invalid })).rejects.toThrow(/valid event start date\/time/)
  })

  test.each([
    { startDate: "2026-11-05", startTime: "00:00" },
    { startDate: "2028-02-29", startTime: "23:59" },
  ])("preserves valid parser date/time output exactly (%j)", async (timing) => {
    const event = await createEvent({ ...scraped, ...timing })
    expect(event).toMatchObject({
      ...timing,
      title: scraped.title,
      endDate: scraped.endDate,
      endTime: scraped.endTime,
      org: "community",
      rsvpButtonUrl: "https://luma.com/example",
    })
  })
})

describe.each(providers)("$name source timestamps", ({ parse }) => {
  test.each(["2031-06-15T12:00:00Z", "2031-06-16T12:00:00Z"])(
    "rejects incomplete starts instead of inventing date/time components at %s",
    async (now) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(now))
      Settings.defaultZone = "Asia/Singapore"

      for (const start of [
        undefined,
        null,
        "",
        "18:30",
        "18:30:00Z",
        "2026-11-05",
        "20261105",
        "2026-11T18:30",
        "2026T18:30",
        "2026-W45T18:30",
        "2026-11-05T18",
      ]) {
        await expect(createEvent(await parse(start)), `incomplete source: ${start}`).rejects.toThrow(
          /valid event start date\/time/,
        )
      }
    },
  )

  test.each([
    ["2026-11-05T10:30:00Z", "2026-11-05", "18:30"],
    ["2026-11-05T18:30:00+08:00", "2026-11-05", "18:30"],
    ["2026-11-05T23:30:00-07:00", "2026-11-06", "14:30"],
    ["20261105T103000Z", "2026-11-05", "18:30"],
    ["2026-11-05t10:30:00.123z", "2026-11-05", "18:30"],
    ["2026-11-05T10:30Z", "2026-11-05", "18:30"],
    ["2026-309T10:30:00Z", "2026-11-05", "18:30"],
    ["2026-W45-4T10:30:00Z", "2026-11-05", "18:30"],
    ["2026-11-05T24:00:00+08:00", "2026-11-06", "00:00"],
  ])("preserves complete source %s", async (start, startDate, startTime) => {
    expect(await createEvent(await parse(start))).toMatchObject({ startDate, startTime })
  })

  test("preserves the existing local-zone interpretation of complete unzoned timestamps", async () => {
    Settings.defaultZone = "Asia/Singapore"
    expect(await createEvent(await parse("2026-11-05T18:30:00"))).toMatchObject({
      startDate: "2026-11-05",
      startTime: "18:30",
    })
  })

  test.each([null, "", "18:30", "2026-11-05", "not-a-date", "2026-02-30T12:00:00Z"])(
    "keeps a complete start without inventing optional end components from %s",
    async (end) => {
      const result = await parse("2026-11-05T10:30:00Z", end)
      expect(result).toMatchObject({ startDate: "2026-11-05", startTime: "18:30" })
      expect(result.endDate || "").toBe("")
      expect(result.endTime || "").toBe("")
      await expect(createEvent(result)).resolves.toMatchObject({ startDate: "2026-11-05", startTime: "18:30" })
    },
  )
})

test("rejects unknown displayed month names instead of substituting January", async () => {
  const parser = new EventbriteParser()
  const reference = new Date("2026-11-01T00:00:00Z")
  const invalidStart = parser.dateTimeParser("Smarch 11 · 6 - 9pm GMT+8", reference)
  await expect(createEvent({ title: scraped.title, ...invalidStart })).rejects.toThrow(/valid event start date\/time/)
  const invalidEnd = parser.dateTimeParser("November 11 · 6pm - Smarch 12 · 9pm", reference)
  expect(invalidEnd).toMatchObject({ startDate: "2026-11-11", startTime: "18:00" })
  expect(invalidEnd.endDate).toBeUndefined()
  expect(invalidEnd.endTime).toBeUndefined()
})

test.each(["", '<div class="date-info__full-datetime">Tue, 10 Nov 2026 11:00 - 12:00 GMT+8</div>'])(
  "uses Eventbrite's complete JSON-LD start without an end instead of the rendered date (%s)",
  async (body) => {
    const result = await new EventbriteParser().scrapeEventDataFromPage(
      cheerio.load(
        `<script type="application/ld+json">${JSON.stringify({
          "@type": "Event",
          name: "Eventbrite event",
          startDate: "2026-11-05T10:30:00Z",
          location: { "@type": "VirtualLocation" },
        })}</script>${body}`,
      ),
      "https://www.eventbrite.sg/e/example-123",
    )
    expect(result).toMatchObject({ startDate: "2026-11-05", startTime: "18:30" })
    expect(result.endDate).toBeUndefined()
    expect(result.endTime).toBeUndefined()
    await expect(createEvent(result)).resolves.toMatchObject({ startDate: "2026-11-05", startTime: "18:30" })
  },
)
