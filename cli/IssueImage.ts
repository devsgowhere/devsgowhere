import fs from "fs"
import path from "path"

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
}
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Downloads a GitHub issue attachment (`what` names it in error messages, e.g. "event image"); returns the local path. */
export async function downloadIssueImage(url: string, outputDir: string, what: string): Promise<string> {
  const response = await fetch(url)
  const type = response.headers.get("content-type")?.split(";")[0].trim() ?? ""
  if (!response.ok) throw new Error(`Couldn't download the ${what} (${response.status}).`)
  if (!IMAGE_TYPES[type]) throw new Error(`The ${what} should be a JPEG, PNG, WebP or GIF file.`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`The ${what} is larger than 10 MB.`)

  const dir = path.join(outputDir, `download-${Date.now()}`)
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `${what.replace(/\W+/g, "-")}${IMAGE_TYPES[type]}`)
  fs.writeFileSync(file, buffer)
  return file
}
