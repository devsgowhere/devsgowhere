import { DateTime } from "luxon"
import { compareEventsByStart } from "./helpers"

const TIMEZONE = "Asia/Singapore"

interface ListedEvent {
  id: string
  data: { startDate: string; startTime: string; endDate?: string | null }
}

/** Midnight today in Singapore, the shared day boundary for event listings and feeds. */
export const startOfToday = (now: DateTime = DateTime.now()): DateTime => now.setZone(TIMEZONE).startOf("day")

/** Keep events through their last listed day; unusable end dates fall back to the start day. */
export const isUpcoming = (event: ListedEvent, today: DateTime = startOfToday()): boolean => {
  const start = DateTime.fromISO(event.data.startDate, { zone: TIMEZONE })
  const end = event.data.endDate ? DateTime.fromISO(event.data.endDate, { zone: TIMEZONE }) : start
  const lastDay = end.isValid && end >= start ? end : start
  return lastDay >= today
}

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
