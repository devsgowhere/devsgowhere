import * as cheerio from "cheerio"
import type { BaseParser } from "./parsers/BaseParser"
import { EventbriteParser } from "./parsers/EventbriteParser"
import { LumaParser } from "./parsers/LumaParser"
import { MeetupParser } from "./parsers/MeetupParser"
import type { EventData, OrgData, ScrapedEventData, ScrapedOrgData } from "./types"
import { saveAsHtml } from "./utils"

export class PageScraper {
  public outputDir: string

  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  private getParser(url: string): BaseParser {
    switch (true) {
      case url.includes("meetup.com"):
        return new MeetupParser(this.outputDir)
      case url.includes("lu.ma"):
      case url.includes("luma.com"):
        return new LumaParser(this.outputDir)
      case url.includes("eventbrite.com"):
      case url.includes("eventbrite.sg"):
        return new EventbriteParser(this.outputDir)
      default:
        throw new Error("Sorry! This event platform is not supported yet.")
    }
  }

  /**
   * Scrapes event data from the provided URL using Puppeteer.
   * @param url The URL of the event page to scrape.
   * @param headless Whether to run the browser in headless mode (for CI environments).
   * @returns A promise that resolves to an object containing the scraped event data.
   */
  async scrapeEventData(url: string): Promise<ScrapedEventData> {
    const parser = this.getParser(url)

    console.log(`Fetching ${url}...`)
    const $ = await PageScraper.getPage(url)
    saveAsHtml($, url, this.outputDir)

    try {
      console.log(`Scraping event data...`)
      const result = await parser.scrapeEventDataFromPage($, url)
      return result
    } catch (error: any) {
      console.error(`Error scraping event data: ${error.message}`)
      throw error
    }
  }

  /**
   * Scrapes org data from the provided URL using Puppeteer.
   * @param url The URL of the org page to scrape.
   * @param headless Whether to run the browser in headless mode (for CI environments).
   * @returns A promise that resolves to an object containing the scraped event data.
   */
  async scrapeOrgData(url: string): Promise<ScrapedOrgData> {
    const parser = this.getParser(url)

    console.log(`Fetching ${url}...`)
    const $ = await PageScraper.getPage(url)
    saveAsHtml($, url, this.outputDir)

    try {
      console.log(`Scraping org data...`)
      const result = await parser.scrapeOrgDataFromPage($, url)
      return result
    } catch (error: any) {
      console.error(`Error scraping org data: ${error.message}`)
      throw error
    }
  }

  /**
   * Creates EventData from scraped data without user input (for CI mode)
   * @param scrapedData The scraped event data
   * @param originalUrl The original event URL
   * @param specifiedOrgId Organization ID specified via --orgID parameter
   * @returns Complete EventData object with defaults filled in
   */
  async createEventDataFromScrapedData(
    scrapedData: ScrapedEventData,
    originalUrl: string,
    specifiedOrgId: string,
  ): Promise<EventData> {
    console.log("\n✅ Scraped data preview:")
    if (scrapedData.title) console.log(`Title: ${scrapedData.title}`)
    if (scrapedData.startDate) console.log(`Date: ${scrapedData.startDate}`)
    if (scrapedData.startTime) console.log(`Start Time: ${scrapedData.startTime}`)
    if (scrapedData.venue) console.log(`Venue: ${scrapedData.venue}`)
    if (scrapedData.venueAddress) console.log(`Venue Address: ${scrapedData.venueAddress}`)
    if (scrapedData.description) console.log(`Description: ${scrapedData.description.substring(0, 100)}...`)
    if (scrapedData.tags && scrapedData.tags.length > 0) console.log(`Tags: ${scrapedData.tags.join(", ")}`)
    if (scrapedData.rsvpButtonText) console.log(`RSVP Button Text: ${scrapedData.rsvpButtonText}`)
    if (scrapedData.rsvpButtonUrl) console.log(`RSVP URL: ${scrapedData.rsvpButtonUrl}`)
    if (scrapedData.heroImage) console.log(`Hero Image: ${scrapedData.heroImage}`)

    // Validate required fields and provide defaults
    const eventData: EventData = {
      org: specifiedOrgId,
      title: scrapedData.title || "Untitled Event",
      description: scrapedData.description || "Event description not available",
      content: scrapedData.content || "",
      venue: scrapedData.venue || "TBD",
      venueAddress: scrapedData.venueAddress || "",
      startDate: scrapedData.startDate || new Date().toISOString().split("T")[0],
      startTime: scrapedData.startTime || "19:00",
      endDate: scrapedData.endDate,
      endTime: scrapedData.endTime,
      tags: scrapedData.tags || [],
      heroImage: scrapedData.heroImage || "https://placecats.com/300/200?fit=contain&position=top",
      rsvpButtonUrl: originalUrl,
      rsvpButtonText: scrapedData.rsvpButtonText || "RSVP",
    }

    // Validate critical fields
    if (!eventData.title || eventData.title === "Untitled Event") {
      throw new Error("❌ Could not extract event title from the URL")
    }
    if (!eventData.startDate || !eventData.startTime) {
      throw new Error("❌ Could not extract event date/time from the URL")
    }
    if (!eventData.venue || eventData.venue === "TBD") {
      console.warn("⚠️  Could not extract venue information from the URL")
    }

    console.log("\n🤖 Using automated event data for CI mode")
    return eventData
  }

  /**
   * Creates OrgData from scraped data without user input (for CI mode)
   * @param scrapedData The scraped org data
   * @param originalUrl The original org URL
   * @param specifiedOrgId Organization ID specified via --orgID parameter
   * @returns Complete OrgData object with defaults filled in
   */
  async createOrgDataFromScrapedData(
    scrapedData: ScrapedOrgData,
    originalUrl: string,
    specifiedOrgId: string,
  ): Promise<OrgData> {
    console.log("\n✅ Scraped data preview:")
    if (scrapedData.title) console.log(`Title: ${scrapedData.title}`)
    if (scrapedData.description) console.log(`Description: ${scrapedData.description.substring(0, 100)}...`)
    if (scrapedData.tags && scrapedData.tags.length > 0) console.log(`Tags: ${scrapedData.tags.join(", ")}`)
    if (scrapedData.heroImage) console.log(`Hero Image: ${scrapedData.heroImage}`)
    if (scrapedData.logoImage) console.log(`Logo Image: ${scrapedData.logoImage}`)
    if (scrapedData.website) console.log(`Website URL: ${scrapedData.website}`)
    if (scrapedData.twitter) console.log(`Twitter URL: ${scrapedData.twitter}`)
    if (scrapedData.facebook) console.log(`Facebook URL: ${scrapedData.facebook}`)
    if (scrapedData.instagram) console.log(`Instagram Handle: ${scrapedData.instagram}`)
    if (scrapedData.linkedin) console.log(`Linkedin URL: ${scrapedData.linkedin}`)
    if (scrapedData.youtube) console.log(`Youtube URL: ${scrapedData.youtube}`)
    if (scrapedData.tiktok) console.log(`Tiktok URL: ${scrapedData.tiktok}`)
    if (scrapedData.discord) console.log(`Discord URL: ${scrapedData.discord}`)
    if (scrapedData.github) console.log(`Github URL: ${scrapedData.github}`)
    if (scrapedData.telegram) console.log(`Telegram URL: ${scrapedData.telegram}`)
    if (scrapedData.meetup) console.log(`Meetup URL: ${scrapedData.meetup}`)

    // Validate required fields and provide defaults
    const orgData: OrgData = {
      org: specifiedOrgId,
      title: scrapedData.title || "Untitled Organization",
      description: scrapedData.description || "Organization description missing",
      content: scrapedData.content || "",
      tags: scrapedData.tags || [],
      heroImage: scrapedData.heroImage || "https://placecats.com/300/200?fit=contain&position=top",
      logoImage: scrapedData.logoImage || "https://placecats.com/300/200?fit=contain&position=top",
      website: scrapedData.website || (originalUrl.includes("meetup.com") ? "" : originalUrl),
      twitter: scrapedData.twitter || "",
      facebook: scrapedData.facebook || "",
      instagram: scrapedData.instagram || "",
      linkedin: scrapedData.linkedin || "",
      youtube: scrapedData.youtube || "",
      tiktok: scrapedData.tiktok || "",
      discord: scrapedData.discord || "",
      github: scrapedData.github || "",
      telegram: scrapedData.telegram || "",
      meetup: scrapedData.meetup || (originalUrl.includes("meetup.com") ? originalUrl : ""),
    }

    // Validate critical fields
    if (!orgData.title || orgData.title === "Untitled Organization") {
      throw new Error("❌ Could not extract org title from the URL")
    }

    console.log("\n🤖 Using automated org data for CI mode")
    return orgData
  }

  public static async getPage(url: string): Promise<cheerio.CheerioAPI> {
    const request = await fetch(url)
    if (!request.ok) throw new Error(`Failed to fetch page: ${request.status} ${request.statusText}`)

    const body = await request.text()
    return cheerio.load(body)
  }
}
