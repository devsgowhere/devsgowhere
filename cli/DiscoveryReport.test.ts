import fs from "fs"
import os from "os"
import path from "path"
import { describe, expect, test } from "vitest"
import { parse } from "yaml"
import { discoveryStatus, writeDiscoveryReport, type DiscoveryReport } from "./DiscoveryReport"

const complete = (): DiscoveryReport => ({ sourceCount: 2, added: [], sourceErrors: [], eventErrors: [] })
const added = { orgId: "org", url: "https://luma.com/event", title: "An event", startAt: "2026-11-04T19:00:00+08:00" }

describe("discovery results", () => {
  test("an empty successful calendar is complete", () => {
    expect(discoveryStatus(complete())).toBe("complete")
  })

  test("partial source failures stay visible without discarding successful work", () => {
    expect(discoveryStatus({ ...complete(), sourceErrors: ["one source failed"] })).toBe("partial")
    expect(discoveryStatus({ ...complete(), added: [added], eventErrors: ["one event failed"] })).toBe("partial")
  })

  test("total source failure, total event-write failure and fatal errors fail the run", () => {
    expect(discoveryStatus({ ...complete(), sourceErrors: ["first failed", "second failed"] })).toBe("failed")
    expect(discoveryStatus({ ...complete(), eventErrors: ["event failed"] })).toBe("failed")
    expect(discoveryStatus({ ...complete(), fatalError: "invalid setup" })).toBe("failed")
  })

  test("writes durable diagnostics and CI output without requiring a content PR", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-report-"))
    try {
      const stepSummary = path.join(root, "step-summary.md")
      const output = path.join(root, "github-output")
      fs.writeFileSync(stepSummary, "Earlier step summary\n")
      const report = { ...complete(), sourceErrors: ["`org` https://luma.com/org: expected calendar missing"] }
      writeDiscoveryReport(report, path.join(root, "artifacts"), {
        GITHUB_STEP_SUMMARY: stepSummary,
        GITHUB_OUTPUT: output,
      })

      expect(fs.readFileSync(stepSummary, "utf8")).toMatch(/^Earlier step summary\n## Event discovery: partial/)
      expect(fs.readFileSync(stepSummary, "utf8")).toContain("expected calendar missing")
      expect(fs.readFileSync(output, "utf8")).toBe("has_errors=true\n")
      expect(JSON.parse(fs.readFileSync(path.join(root, "artifacts", "discovery-report.json"), "utf8"))).toEqual(report)
      expect(fs.readFileSync(path.join(root, "artifacts", "discovery-summary.md"), "utf8")).toContain("### Added (0)")
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test("partial-run alerts do not block the existing production deployment dependency", () => {
    const workflow = parse(
      fs.readFileSync(new URL("../.github/workflows/event-discovery.yml", import.meta.url), "utf8"),
    )
    expect(workflow.jobs["discover-events"].outputs.has_errors).toContain("steps.discovery.outputs.has_errors")
    expect(workflow.jobs["report-discovery-health"].needs).toBe("discover-events")
    expect(workflow.jobs["report-discovery-health"].if).toContain("always()")
    expect(workflow.jobs["report-discovery-health"].if).toContain("has_errors == 'true'")
    expect(workflow.jobs.build.needs).toBe("discover-events")
    expect(workflow.jobs["deploy-production"].needs).toBe("build")
  })
})
