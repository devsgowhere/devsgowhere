import { getCollection } from "astro:content"
import type { APIRoute } from "astro"
import { Settings, DateTime } from "luxon"

Settings.defaultZone = "Asia/Singapore"

export const GET: APIRoute = async () => {
  // get upcoming events from content collection
  const beginningOfDay = DateTime.now().set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
  const events = (await getCollection("events"))
    .filter((event) => {
      const startDate = DateTime.fromISO(event.data.startDate)
      return startDate >= beginningOfDay
    })
    .sort((a, b) => new Date(a.data.startDate).valueOf() - new Date(b.data.startDate).valueOf())

  const index = events.map((event) => ({
    id: event.id,
    title: event.data.title,
    tags: event.data.tags || [],
  }))

  return new Response(JSON.stringify(index), {
    headers: {
      "Content-Type": "application/json",
    },
  })
}
