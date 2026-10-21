import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { buildSearchIndex, upcomingEvents } from "../../utils/events"

// search index of the upcoming events (the events page)
export const GET: APIRoute = async () => {
  const orgTitles = new Map((await getCollection("orgs")).map((org) => [org.id, org.data.title]))
  const index = buildSearchIndex(upcomingEvents(await getCollection("events")), orgTitles)

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
