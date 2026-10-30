import { getEvents } from "../../../utils/getEvents"
import type { APIRoute } from "astro"
import { getCollection } from "astro:content"
import { buildSearchIndex, pastEvents } from "../../../utils/events"

// search index of the past events (the past events page)
export const GET: APIRoute = async () => {
  const orgTitles = new Map((await getCollection("orgs")).map((org) => [org.id, org.data.title]))
  const index = buildSearchIndex(pastEvents(await getEvents()), orgTitles)

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
