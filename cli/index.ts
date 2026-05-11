#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { EventCLI } from "./EventCLI"
import type { EventCLIOptions } from "./types"

// Parse command line arguments using yargs
const argv = yargs(hideBin(process.argv))
  .option("eventURL", {
    type: "string",
    description: "Event URL to scrape data from",
  })
  .option("orgID", {
    type: "string",
    description: "Organization ID for the event",
  })
  .option("output-dir", {
    type: "string",
    default: "scraper-output",
    description: "Directory for scraper output files",
  })
  .help()
  .alias("help", "h")
  .parseSync()

console.log(`Output directory: ${argv.outputDir}`)

// configure location for scraper output
const outputDir = path.join(process.cwd(), argv.outputDir)
// ensure the output directory exists
fs.mkdir(outputDir, { recursive: true }).catch((err) => {
  console.error("Error creating scraper output directory:", err)
  process.exit(1)
})

const cliOptions = {
  outputDir,
  eventURL: argv.eventURL,
  orgID: argv.orgID,
  autoScrapeMode: !!argv.eventURL && !!argv.orgID, // true if both eventUrl and orgId are provided
} as EventCLIOptions

// Run the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = new EventCLI(cliOptions)
  cli.run().catch(console.error)
}

export default EventCLI
