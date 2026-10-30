import { getCollection } from "astro:content"

/** All events that aren't `hidden: true` in their frontmatter, so hidden ones are never listed or built. */
export const getEvents = () => getCollection("events", ({ data }) => !data.hidden)
