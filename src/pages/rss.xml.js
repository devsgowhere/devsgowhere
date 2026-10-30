import { getEvents } from "../utils/getEvents"
import rss from "@astrojs/rss"
import { compareEventsByStart } from "../utils/helpers"
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts"

export async function GET(context) {
  const now = new Date()
  const events = (await getEvents())
    .filter((event) => {
      const startDate = new Date(event.data.startDate)
      return startDate >= now
    })
    .sort(compareEventsByStart)

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
