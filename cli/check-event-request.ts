#!/usr/bin/env node

/**
 * Validates an event submitted through the "New event" issue form and prints the result as JSON
 * (see EventRequestResult). Used by the create-event-from-issue workflow before running create-event.
 *
 *   npx tsx cli/check-event-request.ts --url=<event_url> --org-choice=<dropdown answer> [--new-org-id=<org_id>]
 */

import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { getExistingEventKeys } from "./EventDiscovery"
import { orgFromSubmission, validateEventRequest } from "./EventRequest"

const argv = yargs(hideBin(process.argv))
  .option("url", { type: "string", default: "", description: "Event URL" })
  .option("org-choice", { type: "string", default: "", description: "Answer to the form's Organisation dropdown" })
  .option("new-org-id", { type: "string", default: "", description: "Answer to the form's New organisation ID" })
  .help()
  .parseSync()

const contentDir = path.join(process.cwd(), "src", "content")
const orgIds = new Set(
  fs
    .readdirSync(path.join(contentDir, "orgs"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name),
)
const existingKeys = getExistingEventKeys(path.join(contentDir, "events"))

const org = orgFromSubmission(argv.orgChoice, argv.newOrgId)
const result = validateEventRequest({ url: argv.url, ...org }, { orgIds, existingKeys })
console.log(JSON.stringify(result))
