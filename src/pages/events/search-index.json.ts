
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {

    // get upcoming events from content collection
    const now = new Date();
    const events = (await getCollection("events"))
        .filter((event) => {
            const startDate = new Date(event.data.startDate);
            startDate.setDate(startDate.getDate() + 1) // Add 1 day
            return startDate >= now;
        })
        .sort(
            (a, b) =>
                new Date(a.data.startDate).valueOf() -
                new Date(b.data.startDate).valueOf(),
        );

    const index = events.map((event) => ({
        id: event.id,
        title: event.data.title,
        tags: event.data.tags || []
    }));

    return new Response(JSON.stringify(index),
        {
            headers: {
                "Content-Type": "application/json",
            },
        }
    )
}