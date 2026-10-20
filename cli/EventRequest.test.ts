import { describe, expect, test } from "vitest"
import { eventKey } from "./EventDiscovery"
import { orgFromSubmission, validateEventRequest } from "./EventRequest"
import { NEW_ORG_OPTION } from "./IssueTemplate"

const context = {
  orgIds: new Set(["aws_user_group_singapore", "taqelah-sg"]),
  existingKeys: new Set([eventKey("https://luma.com/ttc2027")]),
}

const validate = (url: string, orgId: string, isNewOrg = false) =>
  validateEventRequest({ url, orgId, isNewOrg }, context)

describe("validateEventRequest", () => {
  test("accepts an event for an existing org and strips tracking parameters", () => {
    expect(
      validate(" https://www.meetup.com/aws-sg/events/316763609/?utm_source=x#top ", "aws_user_group_singapore"),
    ).toEqual({
      ok: true,
      url: "https://www.meetup.com/aws-sg/events/316763609/",
      orgId: "aws_user_group_singapore",
      createsOrg: false,
    })
    expect(validate("https://lu.ma/abc123?tk=xyz", "taqelah-sg")).toMatchObject({
      ok: true,
      url: "https://lu.ma/abc123",
    })
    expect(validate("https://www.eventbrite.sg/e/some-event-123?aff=ebdssbdestsearch", "taqelah-sg")).toMatchObject({
      ok: true,
      url: "https://www.eventbrite.sg/e/some-event-123",
    })
  })

  test("creates a new org only from a Meetup event, and only when asked", () => {
    expect(validate("https://www.meetup.com/new-group/events/1/", "new_group", true)).toMatchObject({
      ok: true,
      createsOrg: true,
    })
    expect(validate("https://www.meetup.com/new-group/events/1/", "new_group")).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("no organisation with the ID `new_group`")],
    })
    expect(validate("https://luma.com/abc", "new_group", true)).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("only be created automatically from Meetup events")],
    })
  })

  test("rejects events that are already listed", () => {
    expect(validate("https://lu.ma/ttc2027", "taqelah-sg")).toEqual({
      ok: false,
      errors: ["This event is already listed on DevsGoWhere."],
    })
  })

  test("rejects unsupported links and unsafe org IDs", () => {
    expect(validate("https://example.com/event", "../orgs", true)).toEqual({
      ok: false,
      errors: [
        "Events from `example.com` aren't supported yet. Use a Meetup, Luma or Eventbrite event link.",
        "The organisation ID `../orgs` should only contain letters, numbers, `-` and `_`.",
      ],
    })
    expect(validate("javascript:alert(1)", "taqelah-sg")).toMatchObject({ ok: false })
    expect(validate("https://www.meetup.com/aws-sg/", "aws_user_group_singapore")).toMatchObject({
      ok: false,
      errors: [expect.stringContaining("isn't an event page")],
    })
  })
})

describe("orgFromSubmission", () => {
  test("reads the org ID from the dropdown answer", () => {
    expect(orgFromSubmission("TAQELAH Singapore (taqelah-sg)", "ignored")).toEqual({
      orgId: "taqelah-sg",
      isNewOrg: false,
    })
  })

  test("uses the typed ID when the org isn't listed", () => {
    expect(orgFromSubmission(NEW_ORG_OPTION, " singapore_rust_meetup ")).toEqual({
      orgId: "singapore_rust_meetup",
      isNewOrg: true,
    })
  })

  test("a new org without an ID is reported", () => {
    const org = orgFromSubmission(NEW_ORG_OPTION, "")
    expect(validateEventRequest({ url: "https://www.meetup.com/x/events/1/", ...org }, context)).toEqual({
      ok: false,
      errors: ['Choose your organisation, or fill in "New organisation ID" if it isn\'t listed.'],
    })
  })
})
