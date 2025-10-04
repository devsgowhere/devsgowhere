import * as cheerio from "cheerio"
import fs from "fs"
import path from "path"

const DEFAULT_OUTPUT_DIR = "scraper-output"

export function saveAsHtml(api: cheerio.CheerioAPI, url: string, outputDir = DEFAULT_OUTPUT_DIR) {
  const fileName = urlToSafeFilename(url, { ext: ".html" })
  const outputPath = path.join(outputDir, fileName)
  fs.writeFileSync(outputPath, api.html(), "utf8")
  console.log(`HTML saved to ${outputPath}`)
}

function urlToSafeFilename(url: string, { maxLength = 100, ext = "" } = {}) {
  const normalizedExt = normalizeExt(ext)

  let raw
  try {
    const u = new URL(url)
    raw = `${u.hostname}${u.pathname}${u.search}` || u.href
  } catch {
    raw = String(url)
  }

  return sanitizeToFilename(raw, { maxLength, ext: normalizedExt })
}

function normalizeExt(ext: string) {
  if (!ext) return ""
  let e = String(ext).trim().toLowerCase()
  if (!e) return ""
  if (e.startsWith(".")) e = e.slice(1)
  // Keep only alnum, cap length to 10
  e = e.replace(/[^a-z0-9]/g, "").slice(0, 10)
  return e ? `.${e}` : ""
}

function sanitizeToFilename(input: string, { maxLength = 100, ext = "" }) {
  // Normalize and strip diacritics (accents)
  let name = input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")

  // Replace separators & whitespace with underscores
  name = name.replace(/[\s/\\]+/g, "_")

  // Remove illegal characters: <>:"/\|?* and control chars
  name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
  name = name.replace(/[\u007F]/g, "_") // DEL
  name = name.replace(/_+/g, "_") // collapse underscores

  // Trim dots/spaces/underscores from ends
  name = name.replace(/^[_ .]+|[_ .]+$/g, "")
  if (!name) name = "file"

  // Avoid Windows reserved device names
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i
  if (reserved.test(name)) name = `_${name}_`

  // Ensure we don't end with a dot before adding extension
  if (ext) name = name.replace(/[.]+$/g, "")

  // Truncate (no hash), preserving room for extension
  const maxCoreLen = Math.max(1, maxLength - ext.length)
  if (name.length > maxCoreLen) {
    name = name.slice(0, maxCoreLen)
    name = name.replace(/[ .]+$/g, "") || "file"
  }

  const finalName = name + ext
  return finalName.replace(/[ .]+$/g, "") || "file" + ext
}
