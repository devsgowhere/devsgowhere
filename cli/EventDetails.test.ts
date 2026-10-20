import { describe, expect, test } from "vitest"
import { eventKey } from "./EventDiscovery"
import { extractImageUrl, orgIdFromName, parseIssueForm, parseTime, validateEventDetails } from "./EventDetails"
import { NEW_ORG_OPTION } from "./IssueTemplate"

const NOW = new Date("2026-10-20T04:00:00Z") // 12:00 in Singapore

const context = {
  orgIds: new Set(["taqelah-sg", "singapore_rust_meetup"]),
  existingKeys: new Set([eventKey("https://forms.gle/already-listed")]),
  now: NOW,
}

const IMAGE = "https://github.com/user-attachments/assets/0f3c0a6e-1b2c-4d5e-8f90-123456789abc"

/** An issue body as GitHub renders the "Submit an event (other websites)" form. */
function body(overrides: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    "Event title": "Testing Tea Time: November",
    Organisation: "TAQELAH Singapore (taqelah-sg)",
    "New organisation name": "_No response_",
    "Start date": "2026-11-05",
    "Start time": "6:30pm",
    "End date": "_No response_",
    "End time": "21:00",
    Venue: "National Library Building",
    "Venue address": "100 Victoria St, Singapore 188064",
    "Short description": "An evening of\ntesting stories.",
    "Full details": "## Agenda\n\n- Talks <script>alert(1)</script>\n\n> Bring a friend",
    "Registration link": "https://forms.gle/abc123",
    "Registration button text": "_No response_",
    Tags: "testing, #qa, testing",
    "Event image": `![banner](${IMAGE})`,
    "Notes for the team": "_No response_",
    ...overrides,
  }
  return Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}`)
    .join("\n\n")
}

const validate = (overrides: Record<string, string> = {}) =>
  validateEventDetails(parseIssueForm(body(overrides)), context)

describe("parseIssueForm", () => {
  test("splits sections by heading and blanks out empty answers", () => {
    const fields = parseIssueForm("### Event title\r\n\r\nHello\r\n\r\n### Tags\n\n_No response_")
    expect(fields).toEqual({ "Event title": "Hello", Tags: "" })
  })
})

describe("parseTime", () => {
  test.each([
    ["18:30", "18:30"],
    ["9:05", "09:05"],
    ["6:30pm", "18:30"],
    ["6 PM", "18:00"],
    ["12am", "00:00"],
    ["12:15pm", "12:15"],
  ])("%s → %s", (input, expected) => expect(parseTime(input)).toBe(expected))

  test.each(["18", "25:00", "13pm", "7.30pm", "evening"])("rejects %s", (input) => expect(parseTime(input)).toBeNull())
})

describe("extractImageUrl", () => {
  test("finds GitHub attachments in markdown, <img> tags or bare links, and nothing else", () => {
    expect(extractImageUrl(`![x](${IMAGE})`)).toBe(IMAGE)
    expect(extractImageUrl(`<img width="800" alt="x" src="${IMAGE}" />`)).toBe(IMAGE)
    expect(extractImageUrl(IMAGE)).toBe(IMAGE)
    expect(extractImageUrl("![x](https://example.com/banner.png)")).toBeNull()
  })
})

describe("orgIdFromName", () => {
  test("matches scripts/create-org.sh", () => {
    expect(orgIdFromName(" Singapore Rust Meetup! ")).toBe("singapore_rust_meetup")
    expect(orgIdFromName("C++ SG / Embedded")).toBe("c_sg_embedded")
  })
})

describe("validateEventDetails", () => {
  test("turns a complete submission into event data", () => {
    expect(validate()).toEqual({
      ok: true,
      event: {
        org: "taqelah-sg",
        title: "Testing Tea Time: November",
        description: "An evening of testing stories.",
        content: "## Agenda\n\n- Talks &lt;script>alert(1)&lt;/script>\n\n> Bring a friend",
        startDate: "2026-11-05",
        startTime: "18:30",
        endDate: "2026-11-05",
        endTime: "21:00",
        venue: "National Library Building",
        venueAddress: "100 Victoria St, Singapore 188064",
        tags: ["testing", "qa"],
        rsvpButtonUrl: "https://forms.gle/abc123",
        rsvpButtonText: "Register",
      },
      imageUrl: IMAGE,
      newOrgTitle: null,
    })
  })

  test("uses the short description as the content and the placeholder when optional fields are empty", () => {
    const result = validate({ "Full details": "_No response_", "Event image": "_No response_", "End time": "" })
    expect(result).toMatchObject({ ok: true, imageUrl: null, event: { content: "An evening of testing stories." } })
    expect(result.ok && result.event).not.toHaveProperty("endDate")
  })

  test("creates an org from 'New organisation name', unless it already exists", () => {
    expect(validate({ Organisation: NEW_ORG_OPTION, "New organisation name": "Kopi Testers" })).toMatchObject({
      ok: true,
      event: { org: "kopi_testers" },
      newOrgTitle: "Kopi Testers",
    })
    expect(validate({ Organisation: NEW_ORG_OPTION, "New organisation name": "Singapore Rust Meetup" })).toMatchObject({
      ok: true,
      event: { org: "singapore_rust_meetup" },
      newOrgTitle: null,
    })
  })

  test("reports every problem at once", () => {
    const result = validate({
      "Event title": " ",
      Organisation: NEW_ORG_OPTION,
      "Start date": "5 Nov 2026",
      "Start time": "evening",
      Venue: "",
      "Short description": "",
      "Registration link": "forms.gle/abc",
      Tags: "a, b, c, d, e, f, g, h, i, j, k",
      "Event image": "![x](https://example.com/x.png)",
    })
    expect(result).toEqual({
      ok: false,
      errors: [
        "Add the event's title.",
        'Choose your organisation, or fill in "New organisation name" if it isn\'t listed.',
        '"Start date" should be a date written as YYYY-MM-DD, e.g. 2026-11-05.',
        '"Start time" should be a time like 18:30 or 6:30pm.',
        'Add the venue, or "Online" for an online event.',
        "Add a short description of the event.",
        "Add a valid registration link (starting with https://).",
        "Use at most 10 tags.",
        'Drag the event image into the "Event image" box so it uploads to GitHub, or leave it empty.',
      ],
    })
  })

  test("rejects past events, events ending before they start, duplicates and unknown orgs", () => {
    expect(validate({ "Start date": "2026-10-19" })).toMatchObject({ errors: ["The start date has already passed."] })
    expect(validate({ "End date": "2026-11-04" })).toMatchObject({ errors: ["The event ends before it starts."] })
    expect(validate({ "End time": "17:00" })).toMatchObject({ errors: ["The event ends before it starts."] })
    expect(validate({ "Registration link": "https://forms.gle/already-listed" })).toMatchObject({
      errors: ["An event with this registration link is already listed on DevsGoWhere."],
    })
    expect(validate({ Organisation: "Ghost Org (ghost)" })).toMatchObject({
      errors: ["Choose your organisation from the list."],
    })
  })
})
