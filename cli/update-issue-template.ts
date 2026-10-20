#!/usr/bin/env node

/**
 * Regenerates the organisation dropdown of the "Submit an event" issue form from src/content/orgs.
 *
 *   npm run update-issue-template [-- --check]   # --check: exit 1 if it's out of date instead of writing
 */

import fs from "fs"
import path from "path"
import { getOrgOptions, ISSUE_TEMPLATE_PATH, renderIssueTemplate, updateIssueTemplate } from "./IssueTemplate"

if (process.argv.includes("--check")) {
  const current = fs.readFileSync(ISSUE_TEMPLATE_PATH, "utf8")
  if (renderIssueTemplate(current, getOrgOptions(path.join("src", "content", "orgs"))) !== current) {
    console.error(`${ISSUE_TEMPLATE_PATH} is out of date, run: npm run update-issue-template`)
    process.exit(1)
  }
  console.log(`${ISSUE_TEMPLATE_PATH} is up to date`)
} else {
  console.log(updateIssueTemplate() ? `Updated ${ISSUE_TEMPLATE_PATH}` : `${ISSUE_TEMPLATE_PATH} is already up to date`)
}
