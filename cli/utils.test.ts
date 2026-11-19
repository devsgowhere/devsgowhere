import fs from "fs"
import path from "path"
import { describe, expect, test } from "vitest"
import { EVENT_PLACEHOLDER_IMAGE, ORG_PLACEHOLDER_IMAGE } from "./utils"

describe("placeholder image paths", () => {
  // where EventWriter and OrgWriter put index.md
  const contentFolder = (collection: string, ...rest: string[]) =>
    path.join(process.cwd(), "src", "content", collection, ...rest)

  test("an org's resolves to the placeholder", () => {
    expect(fs.existsSync(path.resolve(contentFolder("orgs", "some-org"), ORG_PLACEHOLDER_IMAGE))).toBe(true)
  })

  test("an event's resolves to the placeholder, one folder deeper than an org's", () => {
    expect(
      fs.existsSync(path.resolve(contentFolder("events", "some-org", "20260101-event"), EVENT_PLACEHOLDER_IMAGE)),
    ).toBe(true)
  })
})
