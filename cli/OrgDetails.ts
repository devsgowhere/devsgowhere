import { extractImageUrl, orgIdFromName, safeMarkdown } from "./EventDetails"
import type { OrgData } from "./types"

/**
 * Turns a "Submit an organisation" issue (.github/ISSUE_TEMPLATE/new-org.yml) into org data. Everything here is
 * untrusted input.
 */

/** The form's field labels, as they appear as "### <label>" headings in the issue body. */
export const ORG_FIELDS = {
  name: "Organisation name",
  description: "Short description",
  about: "About",
  links: "Links",
  tags: "Tags",
  logo: "Logo",
  cover: "Cover image",
} as const

const MAX_TAGS = 10
/** OrgWriter cuts the description here (it's used for search results and cards) */
const MAX_DESCRIPTION = 160

type LinkKey =
  | "website"
  | "meetup"
  | "facebook"
  | "instagram"
  | "linkedin"
  | "twitter"
  | "youtube"
  | "tiktok"
  | "discord"
  | "github"
  | "telegram"

/** Which org field a link belongs to, from its host; null for any other website. */
function linkKeyOf(url: URL): LinkKey | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  if (host === "meetup.com") return "meetup"
  // a Luma calendar is what daily event discovery reads from `website`
  if (host === "luma.com" || host === "lu.ma") return "website"
  if (host === "facebook.com" || host === "fb.com") return "facebook"
  if (host === "instagram.com") return "instagram"
  if (host === "linkedin.com") return "linkedin"
  if (host === "x.com" || host === "twitter.com") return "twitter"
  if (host === "youtube.com" || host === "youtu.be") return "youtube"
  if (host === "tiktok.com") return "tiktok"
  if (host === "discord.gg" || host === "discord.com") return "discord"
  if (host === "github.com") return "github"
  if (host === "t.me" || host === "telegram.me") return "telegram"
  return null
}

type Links = Partial<Record<LinkKey, string>>

/** Sorts the submitted links (one per line, any order) into org fields; `extra` are the ones with no field left. */
export function classifyLinks(text: string): { links: Links; extra: string[]; invalid: string[] } {
  const links: Links = {}
  const extra: string[] = []
  const invalid: string[] = []
  const ownSites: string[] = []

  for (const line of text.split("\n")) {
    const value = line.replace(/^\s*[-*]\s*/, "").trim()
    if (!value) continue
    let url: URL
    try {
      url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
      if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) throw new Error()
    } catch {
      invalid.push(value)
      continue
    }
    url.search = ""
    url.hash = ""
    const key = linkKeyOf(url)
    if (!key) {
      ownSites.push(url.href)
    } else if (key === "instagram") {
      // org pages take the handle, not the URL
      const handle = url.pathname.split("/").filter(Boolean)[0]
      if (handle && !links.instagram) links.instagram = handle
      else extra.push(url.href)
    } else if (links[key]) {
      extra.push(url.href)
    } else {
      links[key] = url.href
    }
  }

  // the org's own site is the website unless a Luma calendar already is
  for (const site of ownSites) {
    if (links.website) extra.push(site)
    else links.website = site
  }
  return { links, extra, invalid }
}

export interface OrgDetailsContext {
  /** Existing org folder names */
  orgIds: Set<string>
}

export type OrgDetailsResult =
  | {
      ok: true
      org: Omit<OrgData, "heroImage" | "logoImage">
      /** GitHub attachments to download; null uses the placeholder */
      logoUrl: string | null
      coverUrl: string | null
    }
  | { ok: false; errors: string[] }

/** Ignores case, underscores and hyphens, so "ios dev scout" is recognised as "ios-dev-scout". */
const looseId = (id: string) => id.toLowerCase().replace(/[_-]/g, "")

export function validateOrgDetails(fields: Record<string, string>, context: OrgDetailsContext): OrgDetailsResult {
  const field = (key: keyof typeof ORG_FIELDS) => (fields[ORG_FIELDS[key]] ?? "").trim()
  const errors: string[] = []

  const title = field("name").replace(/\s+/g, " ")
  const orgId = orgIdFromName(title)
  if (!title || !orgId) {
    errors.push("Add the organisation's name.")
  } else {
    const existing = [...context.orgIds].find((id) => looseId(id) === looseId(orgId))
    if (existing) errors.push(`This organisation is already listed on DevsGoWhere (as \`${existing}\`).`)
  }

  const description = field("description").replace(/\s+/g, " ")
  if (!description) errors.push("Add a short description of the organisation.")
  else if (description.length > MAX_DESCRIPTION) {
    errors.push(`Shorten the short description to ${MAX_DESCRIPTION} characters (it's ${description.length}).`)
  }

  const { links, extra, invalid } = classifyLinks(field("links"))
  if (invalid.length)
    errors.push(`These links aren't valid web addresses: ${invalid.map((v) => `\`${v}\``).join(", ")}.`)

  const tags = [
    ...new Set(
      field("tags")
        .split(/[,\n]/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean),
    ),
  ]
  if (tags.length > MAX_TAGS) errors.push(`Use at most ${MAX_TAGS} tags.`)

  const image = (key: "logo" | "cover") => {
    const value = field(key)
    const url = extractImageUrl(value)
    if (value && !url) {
      errors.push(`Drag the ${ORG_FIELDS[key].toLowerCase()} into its box so it uploads to GitHub, or leave it empty.`)
    }
    return url
  }
  const logoUrl = image("logo")
  const coverUrl = image("cover")

  if (errors.length) return { ok: false, errors }

  const about = safeMarkdown(field("about") || description)
  const moreLinks = extra.length ? `\n\n### More links\n\n${extra.map((url) => `- ${url}`).join("\n")}` : ""
  return {
    ok: true,
    org: { org: orgId, title, description, content: about + moreLinks, tags, ...links },
    logoUrl,
    coverUrl,
  }
}
