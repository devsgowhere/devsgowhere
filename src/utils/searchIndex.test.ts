import { afterEach, describe, expect, test, vi } from "vitest"
import { fetchSearchIndex } from "./searchIndex"

const event = {
  id: "org/event",
  title: "Example event",
  tags: ["AI"],
  org: { title: "Example organiser" },
  venue: "",
  description: "",
}

function respond(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data))))
}

afterEach(() => vi.unstubAllGlobals())

describe("fetchSearchIndex", () => {
  test("accepts the generated shape, including empty optional text and additional fields", async () => {
    const data = [{ ...event, futureField: "ignored" }]
    respond(data)
    await expect(fetchSearchIndex("/events/search-index.json")).resolves.toEqual(data)
  })

  test("an empty generated list is valid", async () => {
    respond([])
    await expect(fetchSearchIndex("/events/search-index.json")).resolves.toEqual([])
  })

  test("rejects an unsuccessful response before treating its body as data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })))
    await expect(fetchSearchIndex("/events/search-index.json")).rejects.toThrow("503")
  })

  test("rejects HTML returned with a successful status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Fallback page</html>")))
    await expect(fetchSearchIndex("/events/search-index.json")).rejects.toThrow()
  })

  test.each(
    [
      null,
      {},
      "error",
      [null],
      [{ ...event, id: "" }],
      [{ ...event, title: 42 }],
      [{ ...event, tags: ["AI", null] }],
      [{ ...event, org: null }],
      [{ ...event, org: {} }],
      [{ ...event, venue: null }],
      [{ ...event, description: undefined }],
    ].map((data) => ({ data })),
  )("rejects malformed index data: $data", async ({ data }) => {
    respond(data)
    await expect(fetchSearchIndex("/events/search-index.json")).rejects.toThrow("Invalid event search index")
  })

  test("passes cancellation through to the request", async () => {
    const controller = new AbortController()
    const fetch = vi.fn().mockRejectedValue(new DOMException("Request aborted", "AbortError"))
    vi.stubGlobal("fetch", fetch)
    controller.abort()
    await expect(fetchSearchIndex("/events/search-index.json", controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    })
    expect(fetch).toHaveBeenCalledWith("/events/search-index.json", { signal: controller.signal })
  })
})
