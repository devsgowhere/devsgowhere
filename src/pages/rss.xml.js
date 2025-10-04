import rss from "@astrojs/rss"
import { getCollection } from "astro:content"
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts"

export async function GET(context) {
  const now = new Date()
  const events = (await getCollection("events"))
    .filter((event) => {
      const startDate = new Date(event.data.startDate)
      return startDate >= now
    })
    .sort((a, b) => new Date(a.data.startDate).valueOf() - new Date(b.data.startDate).valueOf())

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: events.map((event) => ({
      ...event.data,
      link: `/events/${event.id}/`,
    })),
  })
}
