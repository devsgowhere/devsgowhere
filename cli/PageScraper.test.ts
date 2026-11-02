import { describe, expect, test } from "vitest"
import * as cheerio from "cheerio"
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

  test.each([
    [
      "Meetup",
      () =>
        new MeetupParser().scrapeEventDataFromEvent(
          { title: "Meetup event", dateTime: "2026-11-05T10:30:00Z", venue: { name: "Community space" } },
          "https://www.meetup.com/community/events/123/",
        ),
    ],
    [
      "Luma",
      () =>
        new LumaParser().scrapeEventDataFromPage(
          cheerio.load(
            `<script id="__NEXT_DATA__">${JSON.stringify({
              props: {
                pageProps: {
                  initialData: {
                    data: {
                      event: {
                        name: "Luma event",
                        start_at: "2026-11-05T10:30:00Z",
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
    ],
    [
      "Eventbrite",
      () =>
        new EventbriteParser().scrapeEventDataFromPage(
          cheerio.load(
            `<script type="application/ld+json">${JSON.stringify({
              "@type": "Event",
              name: "Eventbrite event",
              startDate: "2026-11-05T10:30:00Z",
              endDate: "2026-11-05T12:30:00Z",
              location: { "@type": "VirtualLocation" },
            })}</script>`,
          ),
          "https://www.eventbrite.sg/e/example-123",
        ),
    ],
  ] as const)("accepts canonical timing from the actual %s parser", async (_platform, parse) => {
    const event = await createEvent(await parse())
    expect(event).toMatchObject({ startDate: "2026-11-05", startTime: "18:30" })
  })
})
