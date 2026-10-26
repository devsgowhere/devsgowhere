import fs from "fs"
import { parse } from "yaml"
import { describe, expect, test } from "vitest"
import { classifyLinks, ORG_FIELDS, validateOrgDetails } from "./OrgDetails"

const ATTACHMENT = "https://github.com/user-attachments/assets/1a2b3c4d-0000-1111-2222-333344445555"
const context = { orgIds: new Set(["ios-dev-scout", "kopijs"]) }
const fields = (overrides: Record<string, string> = {}) => ({
  "Organisation name": "Rust Singapore",
  "Short description": "A monthly meetup for Rustaceans in Singapore.",
  ...overrides,
})
const errorsOf = (overrides: Record<string, string>) => {
  const result = validateOrgDetails(fields(overrides), context)
  return result.ok ? [] : result.errors
}

describe("classifyLinks", () => {
  test("sorts links into org fields by host, one per line in any order", () => {
    const { links, extra, invalid } = classifyLinks(
      [
        "https://www.meetup.com/rust-sg/?utm=1",
        "- https://www.instagram.com/rust.sg/",
        "linkedin.com/company/rust-sg",
        "https://x.com/rustsg",
        "https://t.me/rustsg",
      ].join("\n"),
    )
    expect(links).toEqual({
      meetup: "https://www.meetup.com/rust-sg/",
      instagram: "rust.sg",
      linkedin: "https://linkedin.com/company/rust-sg",
      twitter: "https://x.com/rustsg",
      telegram: "https://t.me/rustsg",
    })
    expect(extra).toEqual([])
    expect(invalid).toEqual([])
  })

  test("a Luma calendar is the website, ahead of the org's own site", () => {
    const { links, extra } = classifyLinks("https://rust.sg\nhttps://luma.com/rust-sg")
    expect(links.website).toBe("https://luma.com/rust-sg")
    expect(extra).toEqual(["https://rust.sg/"])
  })

  test("the first of a kind wins, and later ones are extras", () => {
    const { links, extra } = classifyLinks(
      "https://rust.sg\nhttps://rust.org\nhttps://github.com/a\nhttps://github.com/b",
    )
    expect(links).toEqual({ website: "https://rust.sg/", github: "https://github.com/a" })
    expect(extra).toEqual(["https://github.com/b", "https://rust.org/"])
  })

  test("reports anything that isn't a web address", () => {
    expect(classifyLinks("not a link\nftp://x.sg\nrust.sg").invalid).toEqual(["not a link", "ftp://x.sg"])
  })
})

describe("validateOrgDetails", () => {
  test("accepts the minimum: a name and a description", () => {
    const result = validateOrgDetails(fields(), context)
    expect(result).toMatchObject({
      ok: true,
      logoUrl: null,
      coverUrl: null,
      org: {
        org: "rust_singapore",
        title: "Rust Singapore",
        description: "A monthly meetup for Rustaceans in Singapore.",
        content: "A monthly meetup for Rustaceans in Singapore.",
        tags: [],
      },
    })
  })

  test("uses the links, tags, images and About text", () => {
    const result = validateOrgDetails(
      fields({
        About: "We meet monthly.\n\n<script>x</script>",
        Links: "https://www.meetup.com/rust-sg/\nhttps://rust.sg\nhttps://rust.org",
        Tags: "#rust, systems\nrust",
        Logo: `![logo](${ATTACHMENT})`,
        "Cover image": `<img src="${ATTACHMENT}">`,
      }),
      context,
    )
    expect(result).toMatchObject({
      ok: true,
      logoUrl: ATTACHMENT,
      coverUrl: ATTACHMENT,
      org: { meetup: "https://www.meetup.com/rust-sg/", website: "https://rust.sg/", tags: ["rust", "systems"] },
    })
    const content = result.ok ? result.org.content : ""
    expect(content).toContain("&lt;script>")
    expect(content).toContain("### More links\n\n- https://rust.org/")
  })

  test("rejects an org that's already listed, however it's spelled", () => {
    expect(errorsOf({ "Organisation name": "iOS Dev Scout" })[0]).toContain("already listed")
    expect(errorsOf({ "Organisation name": "KopiJS" })[0]).toContain("`kopijs`")
  })

  test("asks for the missing and invalid fields", () => {
    expect(errorsOf({ "Organisation name": "", "Short description": "" })).toEqual([
      "Add the organisation's name.",
      "Add a short description of the organisation.",
    ])
    expect(errorsOf({ "Short description": "x".repeat(161) })[0]).toContain("161")
    expect(errorsOf({ Links: "nope" })[0]).toContain("`nope`")
    expect(errorsOf({ Tags: "a,b,c,d,e,f,g,h,i,j,k" })).toEqual(["Use at most 10 tags."])
    expect(errorsOf({ Logo: "https://example.com/logo.png" })[0]).toContain("logo")
  })
})

describe("the issue form", () => {
  test("asks for exactly the fields the validator reads, plus the notes the workflow reads", () => {
    const form = parse(fs.readFileSync(".github/ISSUE_TEMPLATE/new-org.yml", "utf8"))
    const labels = form.body.filter((item: any) => item.type !== "markdown").map((item: any) => item.attributes.label)
    expect(labels).toEqual([...Object.values(ORG_FIELDS), "Notes for the team"])
    expect(form.labels).toEqual(["new-org"])
  })
})
