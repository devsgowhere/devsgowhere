import type { SearchIndexEntry } from "./events"

/** Fetch the generated event index; an error page or malformed entry is not an empty search result. */
export async function fetchSearchIndex(url: string, signal?: AbortSignal): Promise<SearchIndexEntry[]> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Search index request failed (${response.status})`)

  const data: unknown = await response.json()
  if (
    !Array.isArray(data) ||
    !data.every(
      (entry) =>
        entry !== null &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        entry.id.length > 0 &&
        typeof entry.title === "string" &&
        Array.isArray(entry.tags) &&
        entry.tags.every((tag: unknown) => typeof tag === "string") &&
        entry.org !== null &&
        typeof entry.org === "object" &&
        typeof entry.org.title === "string" &&
        typeof entry.venue === "string" &&
        typeof entry.description === "string",
    )
  ) {
    throw new Error("Invalid event search index")
  }
  return data
}
