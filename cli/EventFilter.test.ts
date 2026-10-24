import { describe, expect, test } from "vitest"
import type { DiscoveredEvent } from "./EventDiscovery"
import { applySkipEvents, matchedSkipKeyword, nonTechTag } from "./EventFilter"

const ev = (orgId: string, title: string): DiscoveredEvent => ({
  orgId,
  title,
  url: `https://luma.com/${title}`,
  startAt: "2026-11-01T02:00:00.000Z",
})

describe("matchedSkipKeyword", () => {
  test("matches a keyword anywhere in the title, ignoring case", () => {
    expect(matchedSkipKeyword("Morning YOGA & Connection", ["dinner", "yoga"])).toBe("yoga")
  })

  test("matches nothing without keywords, or with blank ones", () => {
    expect(matchedSkipKeyword("Morning Yoga")).toBeUndefined()
    expect(matchedSkipKeyword("Morning Yoga", [" ", ""])).toBeUndefined()
    expect(matchedSkipKeyword("Python night", ["yoga"])).toBeUndefined()
  })
})

describe("nonTechTag", () => {
  test("flags an event whose only topics are non-tech", () => {
    expect(nonTechTag(["Wellness"])).toBe("Wellness")
    expect(nonTechTag(["Food & Drink", "Social"])).toBe("Food & Drink")
  })

  test("keeps an event that also has a tech tag", () => {
    expect(nonTechTag(["AI", "Arts & Culture"])).toBeUndefined()
    expect(nonTechTag(["Wellness", "Software Development"])).toBeUndefined()
  })

  test("keeps untagged events and unknown tags", () => {
    expect(nonTechTag([])).toBeUndefined()
    expect(nonTechTag()).toBeUndefined()
    expect(nonTechTag(["Founders"])).toBeUndefined()
  })
})

describe("applySkipEvents", () => {
  test("only applies an org's keywords to its own events, and reports what it dropped", () => {
    const skipped: string[] = []
    const events = [ev("sq", "Morning Yoga"), ev("sq", "Founders' Monday"), ev("other", "Yoga for devs")]
    const kept = applySkipEvents(events, new Map([["sq", ["yoga"]]]), skipped)
    expect(kept.map((e) => e.title)).toEqual(["Founders' Monday", "Yoga for devs"])
    expect(skipped).toEqual([`sq https://luma.com/Morning Yoga "Morning Yoga" (title has "yoga")`])
  })
})
