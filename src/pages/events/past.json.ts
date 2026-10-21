import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { pastEvents } from "../../utils/events"
import { buildEventsFeed } from "../../utils/eventsFeed"

// JSON feed of the past events, same shape as /events.json (still soonest first, so oldest to newest)
export const GET: APIRoute = async ({ site }) => {
  const orgTitles = new Map((await getCollection("orgs")).map((org) => [org.id, org.data.title]))
  const feed = buildEventsFeed(pastEvents(await getCollection("events")), orgTitles, site!)

  return new Response(JSON.stringify(feed), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
