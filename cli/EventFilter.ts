import type { DiscoveredEvent } from "./EventDiscovery"

/**
 * Filters for the event discovery job, to leave out events that aren't about tech.
 * - Per org: `skipEvents: ["yoga", "dinner"]` in the org's frontmatter skips events whose title contains any of the
 *   words (case-insensitive). For orgs that mix tech talks with social or wellness events.
 * - Everywhere: events tagged with a non-tech topic (Luma categories, Meetup topics) are skipped, unless they also
 *   carry a tech tag. Untagged events are kept.
 * Skipped events are only logged. Events added by hand or from the submission forms aren't filtered.
 */

const NON_TECH_TAGS = new Set([
  "wellness",
  "fitness",
  "arts & culture",
  "food & drink",
  "sports",
  "music",
  "nightlife",
  "social",
])

const TECH_TAG =
  /\b(ai|tech|software|developer|programming|engineering|data|cloud|devops|security|machine learning|crypto|blockchain|web3|open source)\b/i

/** The keyword that makes `title` a skipped event for the org, if any. */
export function matchedSkipKeyword(title: string, skipEvents: string[] = []): string | undefined {
  const lowerTitle = title.toLowerCase()
  return skipEvents.find((keyword) => keyword.trim() && lowerTitle.includes(keyword.trim().toLowerCase()))
}

/** Why an event with these tags is not a tech event, if it isn't: a non-tech tag and no tech tag. */
export function nonTechTag(tags: string[] = []): string | undefined {
  if (tags.some((tag) => TECH_TAG.test(tag))) return undefined
  return tags.find((tag) => NON_TECH_TAGS.has(tag.trim().toLowerCase()))
}

/** Drops events whose title matches their org's `skipEvents`; `skipped` gets one line per dropped event. */
export function applySkipEvents(
  events: DiscoveredEvent[],
  skipEventsByOrg: Map<string, string[]>,
  skipped: string[] = [],
): DiscoveredEvent[] {
  return events.filter((event) => {
    const keyword = matchedSkipKeyword(event.title, skipEventsByOrg.get(event.orgId))
    if (keyword) skipped.push(`${event.orgId} ${event.url} "${event.title}" (title has "${keyword}")`)
    return !keyword
  })
}
