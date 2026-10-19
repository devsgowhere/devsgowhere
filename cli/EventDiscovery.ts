import fs from "fs"
import path from "path"
import type { MeetupEvent } from "./MeetupApi"

export type Platform = "meetup" | "luma"

export interface OrgSource {
  orgId: string
  platform: Platform
  /** Page listing the org's upcoming events */
  url: string
}

export interface DiscoveredEvent {
  orgId: string
  url: string
  title: string
  /** ISO 8601 start datetime */
  startAt: string
}

const SUPPORTED_TIMEZONE = "Asia/Singapore"

/**
 * Turns an org link into the page that lists its upcoming events, or null if the platform isn't supported.
 * e.g. https://www.meetup.com/aws-sg → https://www.meetup.com/aws-sg/events/
 *      https://lu.ma/lorong-ai → https://luma.com/lorong-ai
 */
export function toOrgSource(orgId: string, link: string): OrgSource | null {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, "")
  const firstSegment = url.pathname.split("/").filter(Boolean)[0]
  if (!firstSegment) return null

  if (host === "meetup.com") {
    return { orgId, platform: "meetup", url: `https://www.meetup.com/${firstSegment}/events/` }
  }
  if (host === "lu.ma" || host === "luma.com") {
    return { orgId, platform: "luma", url: `https://luma.com/${firstSegment}` }
  }
  return null
}

/**
 * Reads every org's `meetup` and `website` frontmatter fields and returns the ones pointing at a supported
 * platform (Meetup group or Luma calendar).
 */
export function getOrgSources(orgsDir: string): OrgSource[] {
  const sources: OrgSource[] = []
  for (const orgId of fs.readdirSync(orgsDir).sort()) {
    const file = path.join(orgsDir, orgId, "index.md")
    if (orgId.startsWith(".") || !fs.existsSync(file)) continue

    const content = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? ""
    const seen = new Set<string>()
    for (const field of ["meetup", "website"]) {
      const value = frontmatter.match(new RegExp(`^${field}:\\s*["']?([^"'\\s]+)`, "m"))?.[1]
      const source = value ? toOrgSource(orgId, value) : null
      if (source && !seen.has(source.url)) {
        seen.add(source.url)
        sources.push(source)
      }
    }
  }
  return sources
}

/**
 * Normalises an event URL into a key used for duplicate detection, so that e.g.
 * lu.ma/abc, https://luma.com/abc?tk=1 and https://www.meetup.com/x/events/123/ vs .../123 match.
 */
export function eventKey(link: string): string {
  let url: URL
  try {
    url = new URL(link.trim())
  } catch {
    return link.trim()
  }
  const host = url.hostname.replace(/^www\./, "")
  const segments = url.pathname.split("/").filter(Boolean)

  if (host === "meetup.com") {
    const eventId = url.pathname.match(/\/events\/(\d+)/)?.[1]
    if (eventId) return `meetup:${eventId}`
  }
  if ((host === "lu.ma" || host === "luma.com") && segments.length === 1) {
    return `luma:${segments[0].toLowerCase()}`
  }
  return `${host}/${segments.join("/")}`.toLowerCase()
}

/** Collects the duplicate-detection keys of every rsvpButtonUrl already in the events collection. */
export function getExistingEventKeys(eventsDir: string): Set<string> {
  const keys = new Set<string>()
  for (const entry of fs.readdirSync(eventsDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue
    const content = fs.readFileSync(path.join(entry.parentPath, entry.name), "utf8")
    const rsvpUrl = content.match(/^rsvpButtonUrl:\s*["']?([^"'\s]+)/m)?.[1]
    if (rsvpUrl) keys.add(eventKey(rsvpUrl))
  }
  return keys
}

function readNextData(html: string): any {
  const json = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1]
  if (!json) throw new Error("No __NEXT_DATA__ found on page")
  return JSON.parse(json)
}

/** Extracts upcoming, active events from a Meetup group's /events/ page. */
export function extractMeetupEvents(html: string, orgId: string, now: Date): DiscoveredEvent[] {
  const state = readNextData(html).props?.pageProps?.__APOLLO_STATE__
  if (!state) throw new Error("No Apollo state found on Meetup page")

  return Object.entries<any>(state)
    .filter(([key, event]) => key.startsWith("Event:") && event.status === "ACTIVE" && event.eventUrl && event.dateTime)
    .filter(([, event]) => new Date(event.dateTime) > now)
    .map(([, event]) => ({
      orgId,
      url: event.eventUrl.replace(/\/$/, ""),
      title: event.title ?? "",
      startAt: event.dateTime,
    }))
}

/** The Meetup group URL name of a source, e.g. "aws-sg" for https://www.meetup.com/aws-sg/events/. */
export function meetupUrlname(source: OrgSource): string {
  return new URL(source.url).pathname.split("/").filter(Boolean)[0]
}

/** Same as extractMeetupEvents, for events returned by the Meetup API (`MeetupApi.getUpcomingEvents`). */
export function meetupApiEvents(events: MeetupEvent[], orgId: string, now: Date): DiscoveredEvent[] {
  return events
    .filter((event) => event.status === "ACTIVE" && event.eventUrl && event.dateTime)
    .filter((event) => new Date(event.dateTime) > now)
    .map((event) => ({
      orgId,
      url: event.eventUrl.replace(/\/$/, ""),
      title: event.title ?? "",
      startAt: event.dateTime,
    }))
}

/**
 * Extracts upcoming events from a Luma calendar page.
 * Events in other timezones are skipped, since Luma calendars often list events outside Singapore.
 */
export function extractLumaEvents(html: string, orgId: string, now: Date): DiscoveredEvent[] {
  const data = readNextData(html).props?.pageProps?.initialData?.data
  if (!data) throw new Error("No calendar data found on Luma page")

  const entries: any[] = data.upcoming?.entries ?? data.featured_items ?? []
  return entries
    .map((entry) => entry.event)
    .filter((event) => event?.url && event.start_at && new Date(event.start_at) > now)
    .filter((event) => (event.timezone ?? SUPPORTED_TIMEZONE) === SUPPORTED_TIMEZONE)
    .map((event) => ({
      orgId,
      url: `https://luma.com/${event.url}`,
      title: event.name ?? "",
      startAt: event.start_at,
    }))
}

export function extractEvents(source: OrgSource, html: string, now: Date): DiscoveredEvent[] {
  return source.platform === "meetup"
    ? extractMeetupEvents(html, source.orgId, now)
    : extractLumaEvents(html, source.orgId, now)
}

/**
 * Drops events that are already in the content collection, start beyond the horizon, or were already
 * discovered via another org (first org wins).
 */
export function selectNewEvents(
  events: DiscoveredEvent[],
  existingKeys: Set<string>,
  now: Date,
  horizonDays: number,
): DiscoveredEvent[] {
  const horizon = now.getTime() + horizonDays * 24 * 60 * 60 * 1000
  const seen = new Set(existingKeys)
  const result: DiscoveredEvent[] = []
  for (const event of events) {
    const key = eventKey(event.url)
    if (seen.has(key) || new Date(event.startAt).getTime() > horizon) continue
    seen.add(key)
    result.push(event)
  }
  return result
}
