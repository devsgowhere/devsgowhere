import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, test } from "vitest"
import {
  eventKey,
  extractLumaEvents,
  extractMeetupEvents,
  getExistingEventKeys,
  getOrgSources,
  selectNewEvents,
  toOrgSource,
} from "./EventDiscovery"

const NOW = new Date("2026-10-15T00:00:00Z")

const page = (nextData: object) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`

describe("toOrgSource", () => {
  test("Meetup group links point at the group's events page", () => {
    expect(toOrgSource("aws", "https://www.meetup.com/aws-sg")).toEqual({
      orgId: "aws",
      platform: "meetup",
      url: "https://www.meetup.com/aws-sg/events/",
    })
    expect(toOrgSource("aws", "https://meetup.com/aws-sg/events/123/")?.url).toBe(
      "https://www.meetup.com/aws-sg/events/",
    )
  })

  test("Luma calendar links are normalised to luma.com", () => {
    expect(toOrgSource("lorong", "https://lu.ma/lorong-ai")).toEqual({
      orgId: "lorong",
      platform: "luma",
      url: "https://luma.com/lorong-ai",
    })
  })

  test("unsupported or invalid links are ignored", () => {
    expect(toOrgSource("x", "https://example.com/events")).toBeNull()
    expect(toOrgSource("x", "https://www.meetup.com/")).toBeNull()
    expect(toOrgSource("x", "not a url")).toBeNull()
  })
})

describe("eventKey", () => {
  test("matches Meetup URLs regardless of host prefix, trailing slash and query", () => {
    expect(eventKey("https://www.meetup.com/aws-sg/events/316763609/")).toBe("meetup:316763609")
    expect(eventKey("https://meetup.com/aws-sg/events/316763609?utm=x")).toBe("meetup:316763609")
  })

  test("matches Luma URLs across lu.ma and luma.com", () => {
    expect(eventKey("https://lu.ma/AIE-hack")).toBe("luma:aie-hack")
    expect(eventKey("https://luma.com/aie-hack?tk=abc")).toBe("luma:aie-hack")
  })
})

describe("extractMeetupEvents", () => {
  const html = page({
    props: {
      pageProps: {
        __APOLLO_STATE__: {
          "Group:1": { urlname: "aws-sg" },
          "Event:1": {
            title: "Upcoming",
            eventUrl: "https://www.meetup.com/aws-sg/events/1/",
            dateTime: "2026-10-28T19:00:00+08:00",
            status: "ACTIVE",
          },
          "Event:2": {
            title: "Past",
            eventUrl: "https://www.meetup.com/aws-sg/events/2/",
            dateTime: "2026-09-17T19:00:00+08:00",
            status: "PAST",
          },
          "Event:3": {
            title: "Cancelled",
            eventUrl: "https://www.meetup.com/aws-sg/events/3/",
            dateTime: "2026-11-01T19:00:00+08:00",
            status: "CANCELLED",
          },
        },
      },
    },
  })

  test("returns only active future events", () => {
    expect(extractMeetupEvents(html, "aws", NOW)).toEqual([
      {
        orgId: "aws",
        url: "https://www.meetup.com/aws-sg/events/1",
        title: "Upcoming",
        startAt: "2026-10-28T19:00:00+08:00",
      },
    ])
  })

  test("throws when the page has no embedded data", () => {
    expect(() => extractMeetupEvents("<html></html>", "aws", NOW)).toThrow()
  })
})

describe("extractLumaEvents", () => {
  const event = (url: string, start_at: string, timezone = "Asia/Singapore") => ({
    event: { url, name: url, start_at, timezone },
  })
  const html = page({
    props: {
      pageProps: {
        initialData: {
          data: {
            upcoming: {
              entries: [
                event("sg-event", "2026-10-21T07:00:00.000Z"),
                event("tokyo-event", "2026-10-22T07:00:00.000Z", "Asia/Tokyo"),
                event("earlier-today", "2026-10-14T10:00:00.000Z"),
              ],
            },
          },
        },
      },
    },
  })

  test("returns future Singapore events as luma.com URLs", () => {
    expect(extractLumaEvents(html, "lorong", NOW)).toEqual([
      { orgId: "lorong", url: "https://luma.com/sg-event", title: "sg-event", startAt: "2026-10-21T07:00:00.000Z" },
    ])
  })
})

describe("selectNewEvents", () => {
  const ev = (orgId: string, url: string, startAt: string) => ({ orgId, url, title: "", startAt })

  test("drops existing, duplicate and beyond-horizon events", () => {
    const events = [
      ev("a", "https://luma.com/existing", "2026-10-20T00:00:00Z"),
      ev("a", "https://luma.com/new", "2026-10-20T00:00:00Z"),
      ev("b", "https://lu.ma/new", "2026-10-20T00:00:00Z"),
      ev("a", "https://luma.com/far-away", "2027-03-01T00:00:00Z"),
    ]
    expect(selectNewEvents(events, new Set(["luma:existing"]), NOW, 60)).toEqual([
      ev("a", "https://luma.com/new", "2026-10-20T00:00:00Z"),
    ])
  })
})

describe("content readers", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-"))
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true })
    fs.writeFileSync(path.join(tmp, file), content)
  }
  write(
    "orgs/aws/index.md",
    '---\ntitle: "AWS"\nwebsite: https://aws.amazon.com\nmeetup: https://www.meetup.com/aws-sg/\n---\n',
  )
  write("orgs/lorong/index.md", '---\ntitle: "Lorong"\nwebsite: "https://lu.ma/lorong-ai"\nmeetup: ""\n---\n')
  write("orgs/rugs/index.md", '---\r\ntitle: "RUGS"\r\nwebsite: https://luma.com/rugs\r\n---\r\n')
  write("orgs/none/index.md", '---\ntitle: "None"\nwebsite: https://example.com\n---\n')
  write("events/aws/20261028-x/index.md", '---\nrsvpButtonUrl: "https://www.meetup.com/aws-sg/events/1/"\n---\n')
  write("events/lorong/20261021-y/index.md", "---\nrsvpButtonUrl: https://lu.ma/sg-event\n---\n")

  test("getOrgSources reads meetup and website fields", () => {
    expect(getOrgSources(path.join(tmp, "orgs"))).toEqual([
      { orgId: "aws", platform: "meetup", url: "https://www.meetup.com/aws-sg/events/" },
      { orgId: "lorong", platform: "luma", url: "https://luma.com/lorong-ai" },
      { orgId: "rugs", platform: "luma", url: "https://luma.com/rugs" },
    ])
  })

  test("getExistingEventKeys reads rsvpButtonUrl from every event", () => {
    expect(getExistingEventKeys(path.join(tmp, "events"))).toEqual(new Set(["meetup:1", "luma:sg-event"]))
  })
})
