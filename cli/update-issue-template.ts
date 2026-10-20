#!/usr/bin/env node

/**
 * Regenerates the organisation dropdowns of the event submission issue forms from src/content/orgs.
 *
 *   npm run update-issue-template [-- --check]   # --check: exit 1 if any is out of date instead of writing
 */

import { outdatedIssueTemplates, updateIssueTemplates } from "./IssueTemplate"

if (process.argv.includes("--check")) {
  const outdated = outdatedIssueTemplates()
  if (outdated.length) {
    console.error(`Out of date: ${outdated.join(", ")}. Run: npm run update-issue-template`)
    process.exit(1)
  }
  console.log("Issue templates are up to date")
} else {
  const updated = updateIssueTemplates()
  console.log(updated.length ? `Updated ${updated.join(", ")}` : "Issue templates are already up to date")
}
