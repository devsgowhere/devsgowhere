
import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {

    // get events from content collection
    const events = await getCollection('events');

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