#!/usr/bin/env node

/**
 * Creates an event (and its org, if new) from a "Submit an event (other websites)" issue, using the submitted
 * fields instead of scraping. Prints the result as JSON; on validation errors nothing is written.
 * Used by the create-event-from-issue workflow.
 *
 *   npx tsx cli/create-event-from-details.ts --body-file=<issue body.md>
 */

import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { getExistingEventKeys } from "./EventDiscovery"
import { parseIssueForm, validateEventDetails } from "./EventDetails"
import { EventWriter } from "./EventWriter"
import { OrgWriter } from "./OrgWriter"
import { downloadIssueImage } from "./IssueImage"
import { PLACEHOLDER_IMAGE } from "./utils"

const argv = yargs(hideBin(process.argv))
  .option("body-file", { type: "string", demandOption: true, description: "File with the issue body" })
  .option("output-dir", { type: "string", default: "scraper-output", description: "Where to download the image" })
  .help()
  .parseSync()

async function main() {
  const contentDir = path.join(process.cwd(), "src", "content")
  const orgIds = new Set(
    fs
      .readdirSync(path.join(contentDir, "orgs"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name),
  )
  const existingKeys = getExistingEventKeys(path.join(contentDir, "events"))

  const fields = parseIssueForm(fs.readFileSync(argv.bodyFile, "utf8"))
  const result = validateEventDetails(fields, { orgIds, existingKeys, now: new Date() })
  if (!result.ok) return result

  let heroImage = PLACEHOLDER_IMAGE
  if (result.imageUrl) {
    try {
      heroImage = await downloadIssueImage(result.imageUrl, argv.outputDir, "event image")
    } catch (error: any) {
      return { ok: false, errors: [error.message] }
    }
  }

  // logs go to stderr so stdout stays a single line of JSON
  console.log = console.error
  if (result.newOrgTitle) {
    new OrgWriter().createOrgFile({
      org: result.event.org,
      title: result.newOrgTitle,
      description: "",
      tags: [],
      heroImage: PLACEHOLDER_IMAGE,
      logoImage: PLACEHOLDER_IMAGE,
    })
  }
  new EventWriter().createEventFile({ ...result.event, heroImage })

  return { ok: true, url: result.event.rsvpButtonUrl, orgId: result.event.org, createsOrg: !!result.newOrgTitle }
}

main()
  .then((result) => process.stdout.write(JSON.stringify(result) + "\n"))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
