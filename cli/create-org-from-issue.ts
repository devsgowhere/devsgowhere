#!/usr/bin/env node

/**
 * Creates an org from a "Submit an organisation" issue. Prints the result as JSON; on validation errors nothing is
 * written. Used by the create-org-from-issue workflow.
 *
 *   npx tsx cli/create-org-from-issue.ts --body-file=<issue body.md>
 */

import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { parseIssueForm } from "./EventDetails"
import { downloadIssueImage } from "./IssueImage"
import { validateOrgDetails } from "./OrgDetails"
import { OrgWriter } from "./OrgWriter"
import { PLACEHOLDER_IMAGE } from "./utils"

const argv = yargs(hideBin(process.argv))
  .option("body-file", { type: "string", demandOption: true, description: "File with the issue body" })
  .option("output-dir", { type: "string", default: "scraper-output", description: "Where to download the images" })
  .help()
  .parseSync()

async function main() {
  const orgIds = new Set(
    fs
      .readdirSync(path.join(process.cwd(), "src", "content", "orgs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name),
  )

  const result = validateOrgDetails(parseIssueForm(fs.readFileSync(argv.bodyFile, "utf8")), { orgIds })
  if (!result.ok) return result

  let logoImage = PLACEHOLDER_IMAGE
  let heroImage = PLACEHOLDER_IMAGE
  try {
    if (result.logoUrl) logoImage = await downloadIssueImage(result.logoUrl, argv.outputDir, "logo")
    if (result.coverUrl) heroImage = await downloadIssueImage(result.coverUrl, argv.outputDir, "cover image")
  } catch (error: any) {
    return { ok: false, errors: [error.message] }
  }

  // logs go to stderr so stdout stays a single line of JSON
  console.log = console.error
  new OrgWriter().createOrgFile({ ...result.org, heroImage, logoImage })

  return {
    ok: true,
    orgId: result.org.org,
    title: result.org.title,
    // a Meetup group or Luma calendar means daily discovery will add its events
    listsEvents: !!(result.org.meetup || /\/\/(www\.)?(luma\.com|lu\.ma)\//.test(result.org.website ?? "")),
  }
}

main()
  .then((result) => process.stdout.write(JSON.stringify(result) + "\n"))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
