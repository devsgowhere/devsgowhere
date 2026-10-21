import { DateTime } from "luxon"
import { compareEventsByStart } from "./helpers"

const TIMEZONE = "Asia/Singapore"

interface ListedEvent {
  id: string
  data: { startDate: string; startTime: string }
}

/** Midnight today in Singapore: events starting on or after it are upcoming, earlier ones are past. */
export const startOfToday = (now: DateTime = DateTime.now()): DateTime => now.setZone(TIMEZONE).startOf("day")

export const isUpcoming = (event: ListedEvent, today: DateTime = startOfToday()): boolean =>
  DateTime.fromISO(event.data.startDate, { zone: TIMEZONE }) >= today

/** Upcoming events, soonest first. */
export const upcomingEvents = <T extends ListedEvent>(events: T[], today: DateTime = startOfToday()): T[] =>
  events.filter((event) => isUpcoming(event, today)).toSorted(compareEventsByStart)

/** Past events, most recent first. */
export const pastEvents = <T extends ListedEvent>(events: T[], today: DateTime = startOfToday()): T[] =>
  events.filter((event) => !isUpcoming(event, today)).toSorted((a, b) => compareEventsByStart(b, a))

/** Groups already-sorted events under their date heading, e.g. "Wed, 28 October 2026", keeping the order. */
export function groupByDate<T extends ListedEvent>(events: T[]): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const event of events) {
    const heading = DateTime.fromISO(event.data.startDate, { zone: TIMEZONE }).toFormat("ccc, d LLLL y")
    ;(groups[heading] ??= []).push(event)
  }
  return groups
}

export interface SearchIndexEntry {
  id: string
  title: string
  tags: string[]
  org: { title: string }
  venue: string
  description: string
}

const MAX_DESCRIPTION_LENGTH = 300

/** What the events pages' search matches on, one entry per event (see filterEvents in searchUtils.js). */
export function buildSearchIndex(
  events: {
    id: string
    data: { title: string; tags?: string[]; venue?: string | null; description: string; org: { id: string } }
  }[],
  orgTitles: Map<string, string>,
): SearchIndexEntry[] {
  return events.map((event) => ({
    id: event.id,
    title: event.data.title,
    tags: event.data.tags ?? [],
    org: { title: orgTitles.get(event.data.org.id) ?? "" },
    venue: event.data.venue ?? "",
    description: event.data.description.slice(0, MAX_DESCRIPTION_LENGTH),
  }))
}
