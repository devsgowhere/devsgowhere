import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { upcomingEvents } from "../utils/events"
import { buildEventsFeed } from "../utils/eventsFeed"

// JSON feed of the upcoming events, rebuilt with every (nightly) build; see src/utils/eventsFeed.ts for the shape
export const GET: APIRoute = async ({ site }) => {
  const orgTitles = new Map((await getCollection("orgs")).map((org) => [org.id, org.data.title]))
  const feed = buildEventsFeed(upcomingEvents(await getCollection("events")), orgTitles, site!)

  return new Response(JSON.stringify(feed), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}
