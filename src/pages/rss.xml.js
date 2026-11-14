import { getEvents } from "../utils/getEvents"
import rss from "@astrojs/rss"
import { upcomingEvents } from "../utils/events"
import { SITE_TITLE, SITE_DESCRIPTION } from "../consts"

export async function GET(context) {
  const events = upcomingEvents(await getEvents())

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
