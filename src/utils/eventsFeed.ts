import { DateTime } from "luxon"
import { compareEventsByStart } from "./helpers"

/**
 * The events JSON feed (/events.json for upcoming events, /events/past.json for past ones), for other sites to list
 * DevsGoWhere's events, e.g. Engineers.SG builds its iCal feed from it. One object so fields can be added later;
 * bump FEED_VERSION only for changes that break existing readers.
 */
export const FEED_VERSION = 1

interface FeedSourceEvent {
  id: string
  data: {
    title: string
    description: string
    venue?: string | null
    venueAddress?: string | null
    startDate: string
    startTime: string
    endDate?: string | null
    endTime?: string | null
    timezone?: string
    rsvpButtonUrl?: string | null
    tags?: string[]
    updatedDate?: Date | null
    org: { id: string }
  }
}

export interface FeedEvent {
  /** "<org_id>/<YYYYMMDD-slug>", the event's folder. Stable: it doesn't change when an event is rescheduled */
  id: string
  title: string
  /** Short description, one line of plain text; null when the event has none */
  description: string | null
  /** The event's page on devsgowhere.com */
  url: string
  /** Where to register, if the event has a registration link */
  rsvpUrl: string | null
  /** ISO 8601 with the UTC offset, e.g. 2026-10-22T18:30:00+08:00 */
  start: string
  /** Same format; null when the event has no usable end time */
  end: string | null
  /** IANA timezone of the event, e.g. Asia/Singapore */
  timezone: string
  venue: string | null
  venueAddress: string | null
  org: { id: string; title: string; url: string }
  tags: string[]
  /** Date (YYYY-MM-DD) the event was last updated, when it records one */
  updatedAt: string | null
}

export interface EventsFeed {
  version: number
  /** When the feed was built (UTC) */
  generatedAt: string
  /** Soonest first */
  events: FeedEvent[]
}

const orNull = (value: string | null | undefined): string | null => value?.trim() || null

/** A local date and time in a timezone as ISO 8601 with the offset; throws on a bad date, time or timezone. */
function toIso(date: string, time: string, zone: string, id: string): DateTime {
  const dateTime = DateTime.fromISO(`${date}T${time}`, { zone })
  if (!dateTime.isValid)
    throw new Error(`Event ${id} has an invalid date, time or timezone: ${dateTime.invalidExplanation}`)
  return dateTime
}

const iso = (dateTime: DateTime): string => dateTime.toISO({ suppressMilliseconds: true })!

export function toFeedEvent(event: FeedSourceEvent, orgTitles: Map<string, string>, site: URL): FeedEvent {
  const { data } = event
  const zone = data.timezone || "Asia/Singapore"
  const start = toIso(data.startDate, data.startTime, zone, event.id)

  // an end time without an end date means the same day; an end that isn't after the start is a data error, so none
  let end: DateTime | null = data.endTime ? toIso(data.endDate || data.startDate, data.endTime, zone, event.id) : null
  if (end && end < start) end = null

  return {
    id: event.id,
    title: data.title.trim(),
    description: orNull(data.description.replace(/\s+/g, " ")),
    url: new URL(`/events/${event.id}/`, site).href,
    rsvpUrl: orNull(data.rsvpButtonUrl),
    start: iso(start),
    end: end && iso(end),
    timezone: zone,
    venue: orNull(data.venue),
    venueAddress: orNull(data.venueAddress),
    org: {
      id: data.org.id,
      title: orgTitles.get(data.org.id) ?? data.org.id,
      url: new URL(`/orgs/${data.org.id}/`, site).href,
    },
    // some tags were saved with a leading "#" (the site adds its own when showing them)
    tags: [...new Set((data.tags ?? []).map((tag) => tag.replace(/^#+/, "").trim()).filter(Boolean))],
    updatedAt: data.updatedDate ? DateTime.fromJSDate(data.updatedDate, { zone: "utc" }).toISODate() : null,
  }
}

/** The feed for the given events, soonest first (whatever order they come in). */
export function buildEventsFeed(
  events: FeedSourceEvent[],
  orgTitles: Map<string, string>,
  site: URL,
  now: Date = new Date(),
): EventsFeed {
  return {
    version: FEED_VERSION,
    // whole seconds: toISO only drops the milliseconds when they're zero
    generatedAt: iso(DateTime.fromJSDate(now, { zone: "utc" }).startOf("second")),
    events: events.toSorted(compareEventsByStart).map((event) => toFeedEvent(event, orgTitles, site)),
  }
}
