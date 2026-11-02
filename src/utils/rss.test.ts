import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { GET } from "../pages/rss.xml.js"

const listed = (id: string, startDate: string, startTime: string) => ({
  id,
  data: { title: id, description: id, startDate, startTime, org: { id: "community" } },
})
const fixtures = [
  listed("today-evening", "2026-11-03", "19:00"),
  listed("tomorrow", "2026-11-04", "09:00"),
  listed("yesterday", "2026-11-02", "19:00"),
  listed("today-morning", "2026-11-03", "08:00"),
]

vi.mock("./getEvents", () => ({ getEvents: async () => fixtures }))

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe("RSS upcoming events", () => {
  test.each([
    "2026-11-02T16:01:00Z", // just after Singapore midnight
    "2026-11-03T01:00:00Z", // after UTC midnight, when the old date-only comparison dropped today's events
    "2026-11-03T15:59:00Z", // just before the next Singapore day
  ])("keeps all of today's events throughout the Singapore day (%s)", async (now) => {
    vi.setSystemTime(new Date(now))
    const response = await GET({ site: new URL("https://devsgowhere.com") })
    const xml = await response.text()
    expect(xml).toContain("/events/today-morning/")
    expect(xml).toContain("/events/today-evening/")
    expect(xml).toContain("/events/tomorrow/")
    expect(xml).not.toContain("/events/yesterday/")
    expect(xml.indexOf("/events/today-morning/")).toBeLessThan(xml.indexOf("/events/today-evening/"))
  })

  test("moves the completed day to past at Singapore midnight", async () => {
    vi.setSystemTime(new Date("2026-11-03T16:00:00Z"))
    const response = await GET({ site: new URL("https://devsgowhere.com") })
    const xml = await response.text()
    expect(xml).toContain("/events/tomorrow/")
    expect(xml).not.toContain("/events/today-morning/")
    expect(xml).not.toContain("/events/today-evening/")
  })
})
