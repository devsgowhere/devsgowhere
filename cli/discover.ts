#!/usr/bin/env node

/**
 * Discovers upcoming events from each org's Meetup group / Luma calendar and writes the ones not yet in
 * src/content/events. Used by the scheduled event-discovery workflow.
 *
 *   npm run discover-events -- [--dry-run] [--org=<org_id>] [--days=60]
 */

import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import {
  extractEvents,
  getExistingEventKeys,
  getOrgSources,
  selectNewEvents,
  type DiscoveredEvent,
} from "./EventDiscovery"
import { EventWriter } from "./EventWriter"
import { PageScraper } from "./PageScraper"

const argv = yargs(hideBin(process.argv))
  .option("dry-run", {
    type: "boolean",
    default: false,
    description: "List new events without scraping or writing them",
  })
  .option("org", {
    type: "string",
    description: "Only check this org ID",
  })
  .option("days", {
    type: "number",
    default: 60,
    description: "Only add events starting within this many days",
  })
  .option("output-dir", {
    type: "string",
    default: "scraper-output",
    description: "Directory for scraper output files (and discovery-summary.md)",
  })
  .help()
  .alias("help", "h")
  .parseSync()

const DELAY_MS = 2000
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const contentDir = path.join(process.cwd(), "src", "content")
  const outputDir = path.join(process.cwd(), argv.outputDir)
  fs.mkdirSync(outputDir, { recursive: true })

  const now = new Date()
  const sources = getOrgSources(path.join(contentDir, "orgs")).filter((s) => !argv.org || s.orgId === argv.org)
  const existingKeys = getExistingEventKeys(path.join(contentDir, "events"))
  console.log(`Checking ${sources.length} org sources (${existingKeys.size} events already in content)`)

  const discovered: DiscoveredEvent[] = []
  const sourceErrors: string[] = []
  for (const source of sources) {
    try {
      const $ = await PageScraper.getPage(source.url)
      const events = extractEvents(source, $.html(), now)
      console.log(`[${source.orgId}] ${source.url}: ${events.length} upcoming`)
      discovered.push(...events)
    } catch (error: any) {
      console.warn(`[${source.orgId}] ${source.url}: ${error.message}`)
      sourceErrors.push(`\`${source.orgId}\` ${source.url}: ${error.message}`)
    }
    await sleep(DELAY_MS)
  }

  const newEvents = selectNewEvents(discovered, existingKeys, now, argv.days)
  console.log(`\n${newEvents.length} new events within ${argv.days} days`)
  for (const event of newEvents) console.log(`  ${event.startAt}  ${event.orgId}  ${event.url}  ${event.title}`)
  if (argv.dryRun) return

  const scraper = new PageScraper(outputDir)
  const writer = new EventWriter()
  const added: DiscoveredEvent[] = []
  const eventErrors: string[] = []
  for (const event of newEvents) {
    try {
      const scraped = await scraper.scrapeEventData(event.url)
      const eventData = await scraper.createEventDataFromScrapedData(scraped, event.url, event.orgId)
      writer.createEventFile(eventData)
      added.push(event)
    } catch (error: any) {
      console.warn(`Failed to add ${event.url}: ${error.message}`)
      eventErrors.push(`\`${event.orgId}\` ${event.url}: ${error.message}`)
    }
    await sleep(DELAY_MS)
  }

  fs.writeFileSync(path.join(outputDir, "discovery-summary.md"), summary(added, eventErrors, sourceErrors), "utf8")
}

function summary(added: DiscoveredEvent[], eventErrors: string[], sourceErrors: string[]): string {
  const lines = [
    "Events discovered automatically from each org's Meetup group / Luma calendar by the event discovery workflow.",
    "Scheduled runs merge this PR automatically once the site builds; if it's still open, auto-merge was off or failed.",
    "Fix any wrong details (venue, description, hero image) on `main`.",
    "",
    `### Added (${added.length})`,
    ...added.map((e) => `- \`${e.orgId}\` ${e.startAt.slice(0, 10)} [${e.title}](${e.url})`),
  ]
  if (eventErrors.length)
    lines.push("", `### Failed to scrape (${eventErrors.length})`, ...eventErrors.map((e) => `- ${e}`))
  if (sourceErrors.length)
    lines.push("", `### Org pages that failed (${sourceErrors.length})`, ...sourceErrors.map((e) => `- ${e}`))
  return lines.join("\n") + "\n"
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
