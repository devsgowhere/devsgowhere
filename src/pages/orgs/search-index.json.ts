import { getCollection } from "astro:content"
import type { APIRoute } from "astro"

export const GET: APIRoute = async () => {
  // get orgs from content collection
  const orgs = await getCollection("orgs")

  const index = orgs.map((org) => ({
    id: org.id,
    title: org.data.title,
    tags: org.data.tags || [],
  }))

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
