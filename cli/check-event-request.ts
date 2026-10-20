#!/usr/bin/env node

/**
 * Validates an event submitted through the "New event" issue form and prints the result as JSON
 * (see EventRequestResult). Used by the create-event-from-issue workflow before running create-event.
 *
 *   npx tsx cli/check-event-request.ts --url=<event_url> --org=<org_id> [--new-org]
 */

import fs from "fs"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { getExistingEventKeys } from "./EventDiscovery"
import { validateEventRequest } from "./EventRequest"

const argv = yargs(hideBin(process.argv))
  .option("url", { type: "string", default: "", description: "Event URL" })
  .option("org", { type: "string", default: "", description: "Organisation ID" })
  .option("new-org", { type: "boolean", default: false, description: "The organisation doesn't exist yet" })
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

const result = validateEventRequest({ url: argv.url, orgId: argv.org, isNewOrg: argv.newOrg }, { orgIds, existingKeys })
console.log(JSON.stringify(result))
