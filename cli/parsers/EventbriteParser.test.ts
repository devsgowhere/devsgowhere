import * as cheerio from "cheerio"
import { describe, expect, test } from "vitest"
import { EventbriteParser } from "./EventbriteParser"
import { PageScraper } from "../PageScraper"

// dates without a year are resolved relative to this
const REFERENCE_DATE = new Date("2025-08-01T00:00:00+08:00")

describe("EventbriteParser", () => {
  describe("dateTimeParser", () => {
    test("should parse single day event date and time", () => {
      const parser = new EventbriteParser()

      const result = parser.dateTimeParser("Thursday, September 11 · 5:30 - 8pm GMT+8. Doors at 5:30pm", REFERENCE_DATE)
      expect(result).toEqual({
        startDate: "2025-09-11",
        startTime: "17:30",
        endDate: "2025-09-11",
        endTime: "20:00",
      })

      const result2 = parser.dateTimeParser("Tuesday, October 28 · 6 - 9pm GMT+8", REFERENCE_DATE)
      expect(result2).toEqual({
        startDate: "2025-10-28",
        startTime: "18:00",
        endDate: "2025-10-28",
        endTime: "21:00",
      })
    })

    test("should parse multi day event date and time", () => {
      const parser = new EventbriteParser()

      const result1 = parser.dateTimeParser("October 8 · 9am - October 9 · 5pm GMT+8", REFERENCE_DATE)
      expect(result1).toEqual({
        startDate: "2025-10-08",
        startTime: "09:00",
        endDate: "2025-10-09",
        endTime: "17:00",
      })

      const result2 = parser.dateTimeParser("September 18 · 9am - September 19 · 4pm WIB", REFERENCE_DATE)
      expect(result2).toEqual({
        startDate: "2025-09-18",
        startTime: "09:00",
        endDate: "2025-09-19",
        endTime: "16:00",
      })
    })

    test("should parse alternative format", () => {
      const parser = new EventbriteParser()

      const result1 = parser.dateTimeParser("Wed, 8 Apr 2026 10:00 - Thu, 9 Apr 2026 17:00 GMT+8")
      expect(result1).toEqual({
        startDate: "2026-04-08",
        startTime: "10:00",
        endDate: "2026-04-09",
        endTime: "17:00",
      })

      const result2 = parser.dateTimeParser("Thu, 9 Apr 2026 10:00 - Fri, 10 Apr 2026 17:00 GMT+8")
      expect(result2).toEqual({
        startDate: "2026-04-09",
        startTime: "10:00",
        endDate: "2026-04-10",
        endTime: "17:00",
      })

      const result3 = parser.dateTimeParser("Tue, 28 Oct 2025 08:00 - 11:10 GMT+8")
      expect(result3).toEqual({
        startDate: "2025-10-28",
        startTime: "08:00",
        endDate: "2025-10-28",
        endTime: "11:10",
      })
    })

    test("should roll dates without a year over to the next upcoming year", () => {
      const parser = new EventbriteParser()

      // already more than 30 days past → next year
      expect(parser.dateTimeParser("Monday, January 5 · 6 - 9pm GMT+8", new Date("2026-10-15"))).toMatchObject({
        startDate: "2027-01-05",
        endDate: "2027-01-05",
      })
      // recently past (e.g. scraping an event that just happened) → same year
      expect(parser.dateTimeParser("Thursday, September 11 · 5:30 - 8pm GMT+8", new Date("2025-09-20"))).toMatchObject({
        startDate: "2025-09-11",
      })
      // multi-day event across new year
      expect(parser.dateTimeParser("December 30 · 9am - January 2 · 5pm GMT+8", new Date("2025-12-01"))).toEqual({
        startDate: "2025-12-30",
        startTime: "09:00",
        endDate: "2026-01-02",
        endTime: "17:00",
      })
    })

    test("should not throw on unparseable text", () => {
      const parser = new EventbriteParser()

      expect(() => parser.dateTimeParser("")).not.toThrow()
      expect(() => parser.dateTimeParser("Date and time TBA")).not.toThrow()
    })
  })

  describe("structured data", () => {
    const page = (jsonLd: object[]) =>
      `<html><head>${jsonLd.map((d) => `<script type="application/ld+json">${JSON.stringify(d)}</script>`).join("")}</head><body></body></html>`

    test("reads event details from schema.org JSON-LD", async () => {
      const parser = new EventbriteParser()
      const $ = cheerio.load(
        page([
          { "@type": "WebPage", name: "Page" },
          {
            "@type": "EducationEvent",
            name: "Workshop",
            description: "A workshop",
            startDate: "2026-11-03T18:30:00+08:00",
            endDate: "2026-11-03T21:00:00+08:00",
            location: {
              "@type": "Place",
              name: "Some Hub",
              address: { "@type": "PostalAddress", streetAddress: "1 Example Road, Singapore, 123456" },
            },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [{ item: { name: "Singapore Events" } }, { item: { name: "Singapore Workshops" } }],
          },
        ]),
      )

      const result = await parser.scrapeEventDataFromPage($, "https://www.eventbrite.sg/e/workshop-1")

      expect(result).toMatchObject({
        title: "Workshop",
        description: "A workshop",
        startDate: "2026-11-03",
        startTime: "18:30",
        endDate: "2026-11-03",
        endTime: "21:00",
        venue: "Some Hub",
        venueAddress: "1 Example Road, Singapore, 123456",
        tags: ["Singapore Events", "Singapore Workshops"],
      })
    })

    test("online events have no address", async () => {
      const parser = new EventbriteParser()
      const $ = cheerio.load(
        page([
          {
            "@type": "Event",
            name: "Webinar",
            startDate: "2026-11-03T10:00:00Z",
            endDate: "2026-11-03T11:00:00Z",
            location: { "@type": "VirtualLocation", url: "https://www.eventbrite.sg/e/webinar-2" },
          },
        ]),
      )

      const result = await parser.scrapeEventDataFromPage($, "https://www.eventbrite.sg/e/webinar-2")

      expect(result).toMatchObject({
        startDate: "2026-11-03",
        startTime: "18:00", // converted to Singapore time
        venue: "Online event",
        venueAddress: "",
      })
    })
  })

  // Both live tests use the same (multi-day) event, once per Eventbrite domain
  describe("eventbrite.sg", () => {
    test("Tech Week Singapore 2025", async () => {
      const parser = new EventbriteParser()

      const url = "https://www.eventbrite.sg/e/tech-week-singapore-2025-tickets-1604379886429"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Tech Week Singapore 2025",
        startDate: "2025-10-08", // YYYY-MM-DD
        startTime: "09:00", // HH:MM
        endDate: "2025-10-09", // YYYY-MM-DD
        endTime: "17:00", // HH:MM
        venue: "Sands Expo & Convention Centre",
        venueAddress: "10 Bayfront Avenue, Singapore, 018956",
        // description: '',
        // content: '',
        tags: [
          "Singapore Events",
          "Central Singapore Events",
          "Things to do in Singapore",
          "Singapore conferences",
          "Singapore Science & Tech conferences",
        ],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "RSVP on Eventbrite",
        rsvpButtonUrl: url,
      })

      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })

  describe("eventbrite.com", () => {
    test("Tech Week Singapore 2025", async () => {
      const parser = new EventbriteParser()

      const url = "https://www.eventbrite.com/e/tech-week-singapore-2025-tickets-1604379886429"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Tech Week Singapore 2025",
        startDate: "2025-10-08", // YYYY-MM-DD
        startTime: "09:00", // HH:MM
        endDate: "2025-10-09", // YYYY-MM-DD
        endTime: "17:00", // HH:MM
        venue: "Sands Expo & Convention Centre",
        venueAddress: "10 Bayfront Avenue, Singapore, 018956",
        // description: '',
        // content: '',
        tags: [
          "Singapore Events",
          "Central Singapore Events",
          "Things to do in Singapore",
          "Singapore conferences",
          "Singapore Science & Tech conferences",
        ],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "RSVP on Eventbrite",
        rsvpButtonUrl: url,
      })

      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })
})
