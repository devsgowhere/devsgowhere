import { getCollection } from "astro:content"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  // get orgs from content collection
  const orgs = await getCollection("orgs")

  const listing = orgs.map((org) => org.id).sort()

  return new Response(listing.join("\n"), {
    headers: {
      "Content-Type": "text/plain",
    },
  })
}
