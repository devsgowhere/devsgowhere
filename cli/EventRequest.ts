import { eventKey } from "./EventDiscovery"

/** An event submitted through the "New event" issue form. */
export interface EventRequest {
  url: string
  orgId: string
  /** The submitter ticked "This is a new organisation" */
  isNewOrg: boolean
}

export interface EventRequestContext {
  /** Existing org folder names */
  orgIds: Set<string>
  /** eventKey()s of every rsvpButtonUrl already in content */
  existingKeys: Set<string>
}

export type EventRequestResult =
  { ok: true; url: string; orgId: string; createsOrg: boolean } | { ok: false; errors: string[] }

const ORG_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

/** Hosts the create-event CLI has a parser for (see PageScraper.getParser). */
function platformOf(host: string): "meetup" | "luma" | "eventbrite" | null {
  host = host.toLowerCase().replace(/^www\./, "")
  if (host === "meetup.com") return "meetup"
  if (host === "lu.ma" || host === "luma.com") return "luma"
  if (/^eventbrite\.(com|sg|co\.uk|com\.au)$/.test(host)) return "eventbrite"
  return null
}

/**
 * Checks an event request before the CLI runs: the URL must be an event page on a supported platform, the org
 * must exist (or be a new Meetup group, the only platform the CLI can create orgs from) and the event must not
 * be listed already. Errors are written for the person who opened the issue.
 */
export function validateEventRequest(request: EventRequest, context: EventRequestContext): EventRequestResult {
  const errors: string[] = []
  const orgId = request.orgId.trim()
  let url: URL | null = null

  try {
    url = new URL(request.url.trim())
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error()
  } catch {
    errors.push(`The event URL \`${request.url.trim()}\` isn't a valid link.`)
  }

  const platform = url && platformOf(url.hostname)
  if (url && !platform) {
    errors.push(`Events from \`${url.hostname}\` aren't supported yet. Use a Meetup, Luma or Eventbrite event link.`)
  }
  if (url && platform === "meetup" && !/\/events\/\d+/.test(url.pathname)) {
    errors.push(
      "That Meetup link isn't an event page. It should look like `https://www.meetup.com/<group>/events/<id>/`.",
    )
  }

  const orgExists = context.orgIds.has(orgId)
  if (!ORG_ID_PATTERN.test(orgId)) {
    errors.push(`The organisation ID \`${orgId}\` should only contain letters, numbers, \`-\` and \`_\`.`)
  } else if (!orgExists && !request.isNewOrg) {
    errors.push(
      `There's no organisation with the ID \`${orgId}\`. Check the [list of organisation IDs](https://devsgowhere.com/orgs/list-orgs.txt), or tick "This is a new organisation".`,
    )
  } else if (!orgExists && platform && platform !== "meetup") {
    errors.push(
      `New organisations can only be created automatically from Meetup events. Please ask us to add \`${orgId}\` first, or use an existing organisation ID.`,
    )
  }

  if (url && platform && context.existingKeys.has(eventKey(url.href))) {
    errors.push("This event is already listed on DevsGoWhere.")
  }

  if (errors.length) return { ok: false, errors }
  // drop tracking parameters (e.g. Luma's ?tk=, Eventbrite's ?aff=) and fragments
  return { ok: true, url: `${url!.origin}${url!.pathname}`, orgId, createsOrg: !orgExists }
}
