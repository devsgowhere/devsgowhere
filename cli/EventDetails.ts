import { DateTime } from "luxon"
import { eventKey } from "./EventDiscovery"
import { orgFromSubmission } from "./EventRequest"
import type { EventData } from "./types"

/**
 * Turns a "Submit an event (other websites)" issue (.github/ISSUE_TEMPLATE/new-event-details.yml) into event data,
 * using the submitted fields as they are instead of scraping a page. Everything here is untrusted input.
 */

/** The form's field labels, as they appear as "### <label>" headings in the issue body. */
export const DETAILS_FIELDS = {
  title: "Event title",
  org: "Organisation",
  newOrgName: "New organisation name",
  startDate: "Start date",
  startTime: "Start time",
  endDate: "End date",
  endTime: "End time",
  venue: "Venue",
  venueAddress: "Venue address",
  description: "Short description",
  content: "Full details",
  rsvpUrl: "Registration link",
  rsvpText: "Registration button text",
  tags: "Tags",
  image: "Event image",
} as const

const TIMEZONE = "Asia/Singapore"
const MAX_TAGS = 10

/** Hosts GitHub serves issue attachments from; images from anywhere else aren't downloaded. */
const IMAGE_URL_PATTERN =
  /https:\/\/(?:github\.com\/user-attachments\/assets\/[\w-]+|(?:private-)?user-images\.githubusercontent\.com\/[^\s)"'>]+)/

/** Splits an issue-form body into { label: value }, with "_No response_" (an empty optional field) as "". */
export function parseIssueForm(body: string): Record<string, string> {
  return Object.fromEntries(
    body
      .replace(/\r\n/g, "\n")
      .split(/^### /m)
      .slice(1)
      .map((section) => {
        const [label, ...value] = section.split("\n")
        const text = value.join("\n").trim()
        return [label.trim(), text === "_No response_" ? "" : text]
      }),
  )
}

/** Accepts 24h "18:30" / "9:05" and 12h "6:30pm" / "6 PM"; returns "HH:MM" or null. */
export function parseTime(value: string): string | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2] ?? "0")
  const meridiem = match[3]
  if (!meridiem && match[2] === undefined) return null // a bare "18" is too ambiguous
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    hour = (hour % 12) + (meridiem === "pm" ? 12 : 0)
  }
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/** The first GitHub attachment image URL in the field (markdown image, <img> tag or bare link). */
export function extractImageUrl(value: string): string | null {
  return value.match(IMAGE_URL_PATTERN)?.[0] ?? null
}

/** Org IDs as scripts/create-org.sh makes them: lowercase, spaces to underscores, nothing else but [a-z0-9_-]. */
export function orgIdFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
}

/** Markdown from the form, with HTML tags neutralised (Astro renders raw HTML in Markdown); `>` quotes still work. */
export function safeMarkdown(text: string): string {
  return text.replace(/</g, "&lt;")
}

export interface EventDetailsContext {
  orgIds: Set<string>
  existingKeys: Set<string>
  /** "today" for rejecting past events */
  now: Date
}

export type EventDetailsResult =
  | {
      ok: true
      event: Omit<EventData, "heroImage">
      /** GitHub attachment to download as the hero image; null uses the placeholder */
      imageUrl: string | null
      /** Set when the org doesn't exist yet and must be created with this title */
      newOrgTitle: string | null
    }
  | { ok: false; errors: string[] }

export function validateEventDetails(fields: Record<string, string>, context: EventDetailsContext): EventDetailsResult {
  const field = (key: keyof typeof DETAILS_FIELDS) => (fields[DETAILS_FIELDS[key]] ?? "").trim()
  const errors: string[] = []

  const title = field("title").replace(/\s+/g, " ")
  if (!title) errors.push("Add the event's title.")

  // Organisation: from the dropdown, or a new one named in "New organisation name"
  const choice = orgFromSubmission(field("org"), "")
  let orgId = choice.orgId
  let newOrgTitle: string | null = null
  if (choice.isNewOrg) {
    const name = field("newOrgName").replace(/\s+/g, " ")
    orgId = orgIdFromName(name)
    if (!name || !orgId) {
      errors.push(`Choose your organisation, or fill in "New organisation name" if it isn't listed.`)
    } else if (!context.orgIds.has(orgId)) {
      newOrgTitle = name
    }
  } else if (!context.orgIds.has(orgId)) {
    errors.push("Choose your organisation from the list.")
  }

  const today = DateTime.fromJSDate(context.now).setZone(TIMEZONE).toISODate()!
  const readDate = (key: "startDate" | "endDate"): string | null => {
    const value = field(key)
    if (!value) return null
    const date = DateTime.fromFormat(value, "yyyy-MM-dd", { zone: TIMEZONE })
    if (!date.isValid) {
      errors.push(`"${DETAILS_FIELDS[key]}" should be a date written as YYYY-MM-DD, e.g. 2026-11-05.`)
      return null
    }
    return date.toISODate()
  }
  const readTime = (key: "startTime" | "endTime"): string | null => {
    const value = field(key)
    if (!value) return null
    const time = parseTime(value)
    if (!time) errors.push(`"${DETAILS_FIELDS[key]}" should be a time like 18:30 or 6:30pm.`)
    return time
  }

  const startDate = readDate("startDate")
  const startTime = readTime("startTime")
  let endDate = readDate("endDate")
  const endTime = readTime("endTime")
  if (!field("startDate")) errors.push("Add the event's start date.")
  if (!field("startTime")) errors.push("Add the event's start time.")
  if (startDate && startDate < today) errors.push("The start date has already passed.")
  if (endTime && !endDate) endDate = startDate
  if (startDate && endDate && `${endDate} ${endTime ?? "23:59"}` < `${startDate} ${startTime ?? "00:00"}`) {
    errors.push("The event ends before it starts.")
  }

  const venue = field("venue").replace(/\s+/g, " ")
  if (!venue) errors.push('Add the venue, or "Online" for an online event.')

  const description = field("description").replace(/\s+/g, " ")
  if (!description) errors.push("Add a short description of the event.")

  let rsvpUrl = ""
  try {
    const url = new URL(field("rsvpUrl"))
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error()
    rsvpUrl = url.href
  } catch {
    errors.push("Add a valid registration link (starting with https://).")
  }
  if (rsvpUrl && context.existingKeys.has(eventKey(rsvpUrl))) {
    errors.push("An event with this registration link is already listed on DevsGoWhere.")
  }

  const tags = [
    ...new Set(
      field("tags")
        .split(/[,\n]/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ]
  if (tags.length > MAX_TAGS) errors.push(`Use at most ${MAX_TAGS} tags.`)

  const imageField = field("image")
  const imageUrl = extractImageUrl(imageField)
  if (imageField && !imageUrl) {
    errors.push('Drag the event image into the "Event image" box so it uploads to GitHub, or leave it empty.')
  }

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    event: {
      org: orgId,
      title,
      description,
      content: safeMarkdown(field("content") || description),
      startDate: startDate!,
      startTime: startTime!,
      ...(endDate && { endDate }),
      ...(endTime && { endTime }),
      venue,
      venueAddress: field("venueAddress").replace(/\s+/g, " "),
      tags,
      rsvpButtonUrl: rsvpUrl,
      rsvpButtonText: field("rsvpText").replace(/\s+/g, " ") || "Register",
    },
    imageUrl,
    newOrgTitle,
  }
}
