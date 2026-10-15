import * as cheerio from "cheerio"
import { describe, expect, test, vi } from "vitest"
import { LumaParser } from "./LumaParser"
import { PageScraper } from "../PageScraper"

describe("LumaParser", () => {
  describe("single day event", () => {
    test("GeekBrunchSG 2025", async () => {
      const parser = new LumaParser()

      const url = "https://lu.ma/85nuq71f"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "GeekBrunchSG 2025",
        startDate: "2025-08-02", // YYYY-MM-DD
        startTime: "11:00", // HH:MM
        endDate: "2025-08-02", // YYYY-MM-DD
        endTime: "14:00", // HH:MM
        venue: "Tenderbest Makcik Tuckshop @ Jalan Kayu",
        venueAddress: "246 Jln Kayu, Singapore 799470",
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "Register on Luma",
        rsvpButtonUrl: url,
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })

    test("TLC August 2025 event", async () => {
      const parser = new LumaParser()

      const url = "https://lu.ma/y79r0r4g"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Round Table: Workflow Engines for Durable Execution",
        startDate: "2025-08-20", // YYYY-MM-DD
        startTime: "19:00", // HH:MM
        endDate: "2025-08-20", // YYYY-MM-DD
        endTime: "21:00", // HH:MM
        venue: "Open Government Products",
        venueAddress: "51 Bras Basah Rd, #04-08 Lazada One, Singapore 189554",
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "Register on Luma",
        rsvpButtonUrl: url,
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })

    test("Manual venue", async () => {
      const parser = new LumaParser()

      const url = "https://lu.ma/i1sng2wi"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "Are We Living in a Black Mirror Episode Now?",
        startDate: "2025-08-19", // YYYY-MM-DD
        startTime: "15:00", // HH:MM
        endDate: "2025-08-19", // YYYY-MM-DD
        endTime: "17:00", // HH:MM
        venue: "Lorong AI (WeWork@22 Cross St.)",
        venueAddress: "",
        // description: '',
        // content: '',
        tags: ["AI"],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "Register on Luma",
        rsvpButtonUrl: url,
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })

  describe("multi day event", () => {
    test("scrapeEventDataFromPage", async () => {
      const parser = new LumaParser()

      const url = "https://lu.ma/lesssg2025"
      const $ = await PageScraper.getPage(url)

      const result = await parser.scrapeEventDataFromPage($, url)

      expect(result).toMatchObject({
        title: "LeSS Conference Singapore 2025",
        startDate: "2025-09-11", // YYYY-MM-DD
        startTime: "09:00", // HH:MM
        endDate: "2025-09-12", // YYYY-MM-DD
        endTime: "18:00", // HH:MM
        venue: "Workcentral",
        venueAddress: "190 Clemenceau Ave, #06-01 Singapore Shopping Centre, Singapore 239924",
        // description: '',
        // content: '',
        tags: [],
        // heroImage: 'path/to/devsgowhere/scraper-output/hero-1752914046954.png',
        rsvpButtonText: "Register on Luma",
        rsvpButtonUrl: url,
      })

      expect(result?.content?.length).toBeGreaterThan(0)
      expect(result?.description?.length).toBeGreaterThan(0)
      expect(result?.heroImage?.length).toBeGreaterThan(0)
    })
  })

  describe("page data", () => {
    const page = (data: object, body = "") =>
      cheerio.load(
        `<html><head><meta property="og:description" content="\u200BSummary text"></head><body>${body}` +
          `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { initialData: { data } } } })}</script>` +
          `</body></html>`,
      )
    const baseEvent = {
      name: "\u200BMeetup",
      start_at: "2026-11-03T10:30:00.000Z",
      end_at: "2026-11-03T13:00:00.000Z",
      timezone: "Asia/Singapore",
      location_type: "offline",
    }
    const scrape = async (data: object, body = "") => {
      const parser = new LumaParser()
      // don't download images in these tests
      vi.spyOn(parser as any, "downloadImage").mockResolvedValue({ originalUrl: "", fileName: null, filePath: null })
      return parser.scrapeEventDataFromPage(page(data, body), "https://luma.com/abc")
    }

    test("public address", async () => {
      const result = await scrape(
        {
          event: {
            ...baseEvent,
            cover_url: "https://images.lumacdn.com/event-covers/j9/cover.png",
            geo_address_visibility: "public",
            geo_address_info: {
              mode: "shown",
              address: "Lorong AI @ One-North",
              full_address: "Lorong AI @ One-North, 69 Ayer Rajah Cres., Singapore 139961",
            },
          },
          categories: [{ name: "AI" }, { name: "Tech" }],
        },
        '<div class="event-about-card"><div class="content"><p>\u200BAbout\u200B the event</p></div></div>',
      )

      expect(result).toMatchObject({
        title: "Meetup",
        description: "Summary text",
        content: "About the event",
        startDate: "2026-11-03",
        startTime: "18:30",
        endDate: "2026-11-03",
        endTime: "21:00",
        venue: "Lorong AI @ One-North",
        venueAddress: "69 Ayer Rajah Cres., Singapore 139961",
        tags: ["AI", "Tech"],
        // the original cover, not the resized thumbnail in the page
        heroImage: "https://images.lumacdn.com/event-covers/j9/cover.png",
      })
    })

    test("address hidden until registration", async () => {
      const result = await scrape({
        event: {
          ...baseEvent,
          geo_address_visibility: "guests-only",
          geo_address_info: { mode: "obfuscated", sublocality: "Queenstown", city: "Singapore" },
        },
      })

      expect(result).toMatchObject({
        venue: "Queenstown, Singapore (address shared after registering)",
        venueAddress: "",
        tags: [],
      })
    })

    test("online event", async () => {
      const result = await scrape({ event: { ...baseEvent, location_type: "online", geo_address_info: null } })

      expect(result).toMatchObject({ venue: "Online event", venueAddress: "" })
    })

    test("cover images are downloaded scaled down as JPEG", () => {
      const parser = new LumaParser() as any
      const downloadUrl = parser.getImageDownloadUrl("https://images.lumacdn.com/uploads/zy/cover.png")

      expect(downloadUrl).toBe(
        "https://images.lumacdn.com/cdn-cgi/image/format=jpeg,fit=scale-down,width=1200,quality=85,background=white/uploads/zy/cover.png",
      )
      expect(parser.getImageFileName(downloadUrl)).toBe("cover.jpg")
      // already-resized URLs and other hosts keep the default behaviour
      expect(parser.getImageDownloadUrl("https://example.com/a.png?x=1")).toBe("https://example.com/a.png")
    })

    test("page without event data", async () => {
      await expect(scrape({ calendar: {} })).rejects.toThrow("No Luma event data found")
    })
  })
})
