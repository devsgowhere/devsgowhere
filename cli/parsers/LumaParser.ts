import type { CheerioAPI } from "cheerio"
import { DateTime } from "luxon"
import path from "path"
import type { ScrapedEventData, ScrapedOrgData } from "../types"
import { BaseParser } from "./BaseParser"

const LUMA_IMAGE_HOST = "images.lumacdn.com"
const LUMA_IMAGE_OPTIONS = "format=jpeg,fit=scale-down,width=1200,quality=85,background=white"

export class LumaParser extends BaseParser {
  /**
   * Download Luma covers through their image CDN, scaled down to at most 1200px wide (originals can be 4096px and
   * ~10MB). The CDN re-encodes to JPEG regardless of the source format, so ask for JPEG explicitly.
   */
  protected override getImageDownloadUrl(imageUrl: string): string {
    const url = new URL(imageUrl)
    if (url.hostname !== LUMA_IMAGE_HOST || url.pathname.startsWith("/cdn-cgi/"))
      return super.getImageDownloadUrl(imageUrl)
    return `https://${LUMA_IMAGE_HOST}/cdn-cgi/image/${LUMA_IMAGE_OPTIONS}${url.pathname}`
  }

  protected override getImageFileName(imageUrl: string): string {
    const url = new URL(imageUrl)
    if (!url.pathname.startsWith(`/cdn-cgi/image/${LUMA_IMAGE_OPTIONS}/`)) return super.getImageFileName(imageUrl)
    return `${path.basename(url.pathname, path.extname(url.pathname))}.jpg`
  }

  override async scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {}

    let defaultData: any = {}
    const nextData = $("#__NEXT_DATA__").text()
    if (nextData) defaultData = JSON.parse(nextData)

    const data = defaultData.props?.pageProps?.initialData?.data
    const event = data?.event
    if (!event) throw new Error("No Luma event data found on page (private or removed event, or not an event page?)")

    // =======================================================================
    // Extract event title
    console.log(`Extracting event title...`)
    const eventTitle = stripZeroWidth(event.name || $("h1").first().text()).trim()
    if (eventTitle) {
      console.log(`Event title: ${eventTitle}`)
      scrapedData.title = eventTitle
    } else {
      console.warn(`No title found for the event.`)
      scrapedData.title = ""
    }

    // =======================================================================
    // Extract event date and time
    console.log(`Extracting event date and time...`)

    const eventTimeZone = event.timezone || "Asia/Singapore"
    console.log(`Event start date time: ${event.start_at}`)
    console.log(`Event end date time: ${event.end_at}`)

    const startDateTime = DateTime.fromISO(event.start_at || "").setZone(eventTimeZone)
    if (startDateTime.isValid) {
      scrapedData.startDate = startDateTime.toFormat("yyyy-MM-dd") // YYYY-MM-DD
      scrapedData.startTime = startDateTime.toFormat("HH:mm") // HH:MM
    } else {
      console.warn(`No start time found for the event.`)
      scrapedData.startDate = ""
      scrapedData.startTime = ""
    }

    const endDateTime = DateTime.fromISO(event.end_at || "").setZone(eventTimeZone)
    if (endDateTime.isValid) {
      scrapedData.endDate = endDateTime.toFormat("yyyy-MM-dd") // YYYY-MM-DD
      scrapedData.endTime = endDateTime.toFormat("HH:mm") // HH:MM
    }

    // =======================================================================
    // Extract venue information
    console.log(`Extracting venue information...`)
    const venue = this.getVenue(event)
    scrapedData.venue = venue.venue
    scrapedData.venueAddress = venue.venueAddress
    console.log(`Event venue: ${venue.venue} / ${venue.venueAddress}`)

    // =======================================================================
    // Extract event description and content
    console.log(`Extracting event description and content...`)

    const descriptionTag = $(".event-about-card .content").html() || ""
    scrapedData.content = stripZeroWidth(this.convertHtmlToMarkdown(descriptionTag)).trim()

    const ogHeaderDescription = $('meta[property="og:description"]').attr("content") || ""
    scrapedData.description = stripZeroWidth(ogHeaderDescription).trim()

    // =======================================================================
    // Extract tags from Luma's event categories (e.g. "AI", "Tech")
    console.log(`Extracting event tags...`)
    scrapedData.tags = (data.categories || [])
      .map((category: any) => category?.name?.trim())
      .filter((name: string | undefined) => !!name)

    // =======================================================================
    // Extract hero image: the original cover, rather than the resized thumbnail rendered in the page
    console.log(`Extracting hero image...`)
    const heroImageUrl =
      event.cover_url ||
      $('img[src*="event-covers"], img[src*="lumacdn.com"], [data-testid="event-image"] img').attr("src")

    // download the hero image to 'scraper-output' folder
    if (heroImageUrl) {
      console.log(`Hero image found: ${heroImageUrl}`)
      scrapedData.heroImage = heroImageUrl

      const downloadResult = await this.downloadImage(heroImageUrl)
      if (downloadResult.filePath) scrapedData.heroImage = downloadResult.filePath
    } else {
      console.warn(`No hero image found for the event.`)
      scrapedData.heroImage = ""
    }

    // =======================================================================
    // Set RSVP button information
    scrapedData.rsvpButtonText = "Register on Luma"
    scrapedData.rsvpButtonUrl = url

    return scrapedData
  }

  /**
   * Venue name and street address from Luma's event data.
   * - Online events: "Online event", no address.
   * - Address hidden until registration: Luma only gives the area, e.g. "Queenstown, Singapore". The address is
   *   left empty because it feeds the map and calendar location.
   * - Otherwise: e.g. "Lorong AI @ One-North" / "69 Ayer Rajah Cres., Singapore 139961".
   */
  private getVenue(event: any): { venue: string; venueAddress: string } {
    const geo = event.geo_address_info || {}

    if (event.location_type && event.location_type !== "offline") {
      return { venue: "Online event", venueAddress: "" }
    }

    if (event.geo_address_visibility === "guests-only" || geo.mode === "obfuscated" || !geo.address) {
      const area = [geo.sublocality, geo.city]
        .filter((part, index, parts) => part && parts.indexOf(part) === index)
        .join(", ")
      return { venue: area ? `${area} (address shared after registering)` : "", venueAddress: "" }
    }

    const venue = geo.address.trim()
    const fullAddress = (geo.full_address || "").trim()
    const venueAddress = fullAddress.startsWith(`${venue}, `) ? fullAddress.substring(venue.length + 2) : fullAddress
    return { venue, venueAddress: venueAddress === venue ? "" : venueAddress }
  }

  override async scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData> {
    throw new Error(`Scraping org data not implemented in ${this.constructor.name}`)
  }
}

/** Luma's rich text is sprinkled with zero-width spaces (U+200B) and similar invisible characters. */
function stripZeroWidth(text: string): string {
  return text.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
}
