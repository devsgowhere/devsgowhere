import fs from "fs"
import path from "path"
import type { DiscoveredEvent } from "./EventDiscovery"

export interface DiscoveryReport {
  sourceCount: number
  added: DiscoveredEvent[]
  sourceErrors: string[]
  eventErrors: string[]
  fatalError?: string
  dryRun?: boolean
}

/** Partial results can still be reviewed/published, while CI reports their incomplete source coverage separately. */
export function discoveryStatus(report: DiscoveryReport): "complete" | "partial" | "failed" {
  if (
    report.fatalError ||
    (report.sourceCount > 0 && report.sourceErrors.length === report.sourceCount) ||
    (report.eventErrors.length > 0 && report.added.length === 0)
  )
    return "failed"
  return report.sourceErrors.length || report.eventErrors.length ? "partial" : "complete"
}

export function discoverySummary(report: DiscoveryReport): string {
  const lines = [
    `## Event discovery: ${discoveryStatus(report)}`,
    "",
    `Source pages selected: ${report.sourceCount}; source failures: ${report.sourceErrors.length}; event failures: ${report.eventErrors.length}.`,
    report.dryRun
      ? "Dry run: no event content was written."
      : "Events discovered automatically from each org's Meetup group / Luma calendar by the event discovery workflow.",
    "Scheduled runs merge this PR automatically once the site builds; if it's still open, auto-merge was off or failed.",
    "Fix any wrong details (venue, description, hero image) on `main`.",
    "",
    `### Added (${report.added.length})`,
    ...report.added.map((e) => `- \`${e.orgId}\` ${e.startAt.slice(0, 10)} [${e.title}](${e.url})`),
  ]
  if (report.eventErrors.length)
    lines.push(
      "",
      `### Failed to scrape (${report.eventErrors.length})`,
      ...report.eventErrors.map((error) => `- ${error}`),
    )
  if (report.sourceErrors.length)
    lines.push(
      "",
      `### Org pages that failed (${report.sourceErrors.length})`,
      ...report.sourceErrors.map((error) => `- ${error}`),
    )
  if (report.fatalError) lines.push("", "### Discovery could not finish", report.fatalError)
  return lines.join("\n") + "\n"
}

/** Persist diagnostics even when no content changes, so no pull request is needed to see the failures. */
export function writeDiscoveryReport(report: DiscoveryReport, outputDir: string, env = process.env): void {
  fs.mkdirSync(outputDir, { recursive: true })
  const summary = discoverySummary(report)
  fs.writeFileSync(path.join(outputDir, "discovery-summary.md"), summary, "utf8")
  fs.writeFileSync(path.join(outputDir, "discovery-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8")
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, summary, "utf8")
  if (env.GITHUB_OUTPUT)
    fs.appendFileSync(env.GITHUB_OUTPUT, `has_errors=${discoveryStatus(report) !== "complete"}\n`, "utf8")
}
