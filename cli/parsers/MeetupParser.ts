import type { CheerioAPI } from "cheerio"
import { DateTime } from "luxon"
import type { ScrapedEventData, ScrapedOrgData } from "../types"
import { BaseParser } from "./BaseParser"

export class MeetupParser extends BaseParser {
  override async scrapeEventDataFromPage($: CheerioAPI, url: string): Promise<ScrapedEventData> {
    const scrapedData: ScrapedEventData = {}

    let defaultData: any = {}
    const nextData = $("#__NEXT_DATA__").text()
    if (nextData) defaultData = JSON.parse(nextData)

    console.log(`Extracting event title...`)
    const eventTitle = $("main h1").first().text().trim()
    console.log(`Event title: ${eventTitle}`)
    scrapedData.title = eventTitle

    console.log(`Extracting event start time...`)
    const eventStartTime = $("main aside time").attr("datetime")?.trim() || ""

    if (eventStartTime) {
      console.log(`Event start time: ${eventStartTime}`)
      const startDateTime = DateTime.fromISO(eventStartTime).setZone("Asia/Singapore")
      scrapedData.startDate = `${startDateTime.toFormat("yyyy-MM-dd")}`
      scrapedData.startTime = `${startDateTime.toFormat("HH:mm")}`
    } else {
      console.warn(`No start time found for the event.`)
      scrapedData.startDate = ""
      scrapedData.startTime = ""
    }

    console.log(`Extracting event end time...`)
    const eventEndTime = defaultData.props.pageProps.event?.endTime
    if (eventEndTime) {
      // Example: Saturday, Aug 23 · 10:00 AM to 1:00 PM SST
      console.log(`Event end time: ${eventEndTime}`)
      const endDateTime = DateTime.fromISO(eventStartTime).setZone("Asia/Singapore")
      scrapedData.endDate = `${endDateTime.toFormat("yyyy-MM-dd")}`
      scrapedData.endTime = `${endDateTime.toFormat("HH:mm")}`
    } else {
      console.warn(`No end time found for the event.`)
      scrapedData.endDate = ""
      scrapedData.endTime = ""
    }

    console.log(`Extracting event venue name...`)
    const eventVenue = $("main aside p").eq(2).text().trim()
    if (eventVenue) {
      console.log(`Event venue: ${eventVenue}`)
      scrapedData.venue = eventVenue
    } else {
      console.warn(`No venue name found for the event.`)
      scrapedData.venue = ""
    }

    console.log(`Extracting event venue address...`)
    const eventVenueAddress = $("main aside p").eq(3).text().trim()
    if (eventVenueAddress) {
      console.log(`Event venue address: ${eventVenueAddress}`)
      scrapedData.venueAddress = eventVenueAddress
    } else {
      console.warn(`No venue address found for the event.`)
      scrapedData.venueAddress = ""
    }

    console.log(`Extracting event description...`)
    // const ogHeaderDescription = $('meta[property="og:description"]').attr("content")
    scrapedData.description = scrapedData.title || ""

    // get event details from "main #event-details" as html
    console.log(`Extracting event content...`)
    const eventContent = defaultData.props.pageProps.event.description
    if (eventContent) {
      console.log(`Event content extracted.`)
      scrapedData.content = eventContent
    } else {
      console.warn(`No content found for the event.`)
      scrapedData.content = ""
    }

    console.log(`Extracting event tags...`)
    scrapedData.tags = []

    const venueTags = [
      defaultData.props.pageProps.event.venue?.city,
      defaultData.props.pageProps.event.venue?.state,
      defaultData.props.pageProps.event.venue?.country?.toUpperCase(),
    ].filter((tag) => tag && tag.length > 0).join(", ")
    if (venueTags && venueTags.length > 0) {
      scrapedData.tags = [`Events in ${venueTags}`]
    }

    defaultData.props.pageProps.event.topics.edges.forEach((edge: any) => {
      if (edge.node.name && !scrapedData.tags?.includes(edge.node.name)) {
        scrapedData.tags = scrapedData.tags || []
        scrapedData.tags.push(edge.node.name)
      }
    })

    console.log(`Extracting hero image...`)
    // const heroImageUrl = $("main aside img").attr("src")?.trim() || ""
    const heroImageUrl = defaultData.props.pageProps.event?.featuredEventPhoto?.source || ""

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

    // set rsvp button url to the original url
    scrapedData.rsvpButtonText = "RSVP on Meetup"
    scrapedData.rsvpButtonUrl = url

    return scrapedData
  }

  override async scrapeOrgDataFromPage($: CheerioAPI, url: string): Promise<ScrapedOrgData> {
    const scrapedData: ScrapedOrgData = {}

    // org title: get text content from "main h1"
    console.log(`Extracting org title...`)
    const orgTitle = $("main section h1").first().text().trim()
    console.log(`Org title: ${orgTitle}`)
    scrapedData.title = orgTitle

    // get org description from "main #about-section + div"
    console.log(`Extracting org description...`)
    const orgDescription = $("#about-section").parent().next().text().trim()
    if (orgDescription) {
      console.log(`Event description: ${orgDescription}`)
      scrapedData.description = orgDescription.substring(0, 160) // truncate to 160 characters for SEO
    } else {
      console.warn(`No org description found.`)
      scrapedData.description = ""
    }

    // get org details from "main #about-section + div" as html
    console.log(`Extracting org content...`)
    const orgContent = $("#about-section").parent().next().html()
    if (orgContent) {
      console.log(`Org content extracted.`)
      // Convert HTML description to markdown
      scrapedData.content = this.convertHtmlToMarkdown(orgContent)
    } else {
      console.warn(`No content found for the org.`)
      scrapedData.content = ""
    }

    // get tags from "main .tag--topic"
    // - there may be multiple tags, so we need to get all of them and put them in an array
    console.log(`Extracting org tags...`)
    const orgTags = $("#topics-section")
      .parent()
      .parent()
      .next()
      .find("span")
      .map((_, el) => $(el).text().trim())
      .get()
    if (orgTags.length > 0) {
      console.log(`Org tags: ${orgTags.join(", ")}`)
      scrapedData.tags = orgTags
    } else {
      console.warn(`No tags found for the org.`)
      scrapedData.tags = []
    }

    // get the src for hero image from "main img"
    console.log(`Extracting hero image...`)
    const heroImageUrl = $("main section img").first().attr("src")?.trim() || ""

    // download the hero image to 'scraper-output' folder
    if (heroImageUrl) {
      console.log(`Hero image found: ${heroImageUrl}`)
      scrapedData.heroImage = heroImageUrl

      const downloadResult = await this.downloadImage(heroImageUrl)
      if (downloadResult.filePath) scrapedData.heroImage = downloadResult.filePath
    } else {
      console.warn(`No hero image found for the org.`)
      scrapedData.heroImage = ""
    }

    // get website from "main a[data-event-label='group-other-button']" href
    console.log(`Extracting org website...`)
    const website = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-other-button']")
      .parent()
      .attr("href")
    if (website) {
      console.log(`Org website found: ${website}`)
      scrapedData.website = website
    } else {
      console.warn(`No website found for the org.`)
    }

    // get twitter from "main a[data-event-label='group-twitter-button']" href
    console.log(`Extracting org twitter...`)
    const twitter = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-twitter-button']")
      .parent()
      .attr("href")
    if (twitter) {
      console.log(`Org twitter found: ${twitter}`)
      scrapedData.twitter = twitter
    } else {
      console.warn(`No twitter found for the org.`)
    }

    // get facebook from "main a[data-event-label='group-facebook-button']" href
    console.log(`Extracting org facebook...`)
    const facebook = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-facebook-button']")
      .parent()
      .attr("href")
    if (facebook) {
      console.log(`Org facebook found: ${facebook}`)
      scrapedData.facebook = facebook
    } else {
      console.warn(`No facebook found for the org.`)
    }

    // get instagram from "main a[data-event-label='group-instagram-button']" href
    console.log(`Extracting org instagram...`)
    const instagram = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-instagram-button']")
      .parent()
      .attr("href")
    if (instagram && URL.canParse(instagram)) {
      const handle = new URL(instagram).pathname.split("/")[1]
      console.log(`Org instagram handle found: ${handle}`)
      scrapedData.instagram = handle
    } else {
      console.warn(`No instagram found for the org.`)
    }

    // get linkedin from "main a[data-event-label='group-linkedin-button']" href
    console.log(`Extracting org linkedin...`)
    const linkedin = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-linkedin-button']")
      .parent()
      .attr("href")
    if (linkedin) {
      console.log(`Org linkedin found: ${linkedin}`)
      scrapedData.linkedin = linkedin
    } else {
      console.warn(`No linkedin found for the org.`)
    }

    // get youtube from "main a[data-event-label='group-youtube-button']" href
    console.log(`Extracting org youtube...`)
    const youtube = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-youtube-button']")
      .parent()
      .attr("href")
    if (youtube) {
      console.log(`Org youtube found: ${youtube}`)
      scrapedData.youtube = youtube
    } else {
      console.warn(`No youtube found for the org.`)
    }

    // get tiktok from "main a[data-event-label='group-tiktok-button']" href
    console.log(`Extracting org tiktok...`)
    const tiktok = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-tiktok-button']")
      .parent()
      .attr("href")
    if (tiktok) {
      console.log(`Org tiktok found: ${tiktok}`)
      scrapedData.tiktok = tiktok
    } else {
      console.warn(`No tiktok found for the org.`)
    }

    // get discord from "main a[data-event-label='group-discord-button']" href
    console.log(`Extracting org discord...`)
    const discord = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-discord-button']")
      .parent()
      .attr("href")
    if (discord) {
      console.log(`Org discord found: ${discord}`)
      scrapedData.discord = discord
    } else {
      console.warn(`No discord found for the org.`)
    }

    // get github from "main a[data-event-label='group-github-button']" href
    console.log(`Extracting org github...`)
    const github = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-github-button']")
      .parent()
      .attr("href")
    if (github) {
      console.log(`Org github found: ${github}`)
      scrapedData.github = github
    } else {
      console.warn(`No github found for the org.`)
    }

    // get telegram from "main a[data-event-label='group-telegram-button']" href
    console.log(`Extracting org telegram...`)
    const telegram = $("#social-networks-section")
      .parent()
      .parent()
      .next()
      .find("[data-event-label='group-telegram-button']")
      .parent()
      .attr("href")
    if (telegram) {
      console.log(`Org telegram found: ${telegram}`)
      scrapedData.telegram = telegram
    } else {
      console.warn(`No telegram found for the org.`)
    }

    // add group meetup url
    console.log(`Adding org meetup: ${url}`)
    scrapedData.meetup = url

    console.log("Org scraping complete.")
    return scrapedData
  }
}
