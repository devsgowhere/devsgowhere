import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync, type SpawnSyncReturns } from "child_process"
import { createRequire } from "module"
import { fileURLToPath, pathToFileURL } from "url"
import { describe, expect, test } from "vitest"

const require = createRequire(import.meta.url)
const cli = fileURLToPath(new URL("./discover.ts", import.meta.url))
const calendar = `<script id="__NEXT_DATA__">${JSON.stringify({
  props: { pageProps: { initialData: { data: { upcoming: { entries: [] } } } } },
})}</script>`

/** Run the real CLI against isolated content and a fetch stub; never contact an event provider. */
function runDiscovery(
  pages: Record<string, string>,
  check: (result: SpawnSyncReturns<string>, root: string) => void,
  args: string[] = [],
  eventPages: Record<string, string> = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-cli-"))
  try {
    fs.mkdirSync(path.join(root, "src", "content", "events"), { recursive: true })
    fs.mkdirSync(path.join(root, "src", "content", "orgs"), { recursive: true })
    for (const org of Object.keys(pages)) {
      const dir = path.join(root, "src", "content", "orgs", org)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, "index.md"), `---\nwebsite: https://luma.com/${org}\n---\n`)
    }
    const preload = path.join(root, "fetch-stub.mjs")
    fs.writeFileSync(
      preload,
      `const pages = ${JSON.stringify({ ...pages, ...eventPages })};
globalThis.fetch = async (url) => {
  const org = new URL(String(url)).pathname.slice(1);
  if (!Object.hasOwn(pages, org)) throw new Error("Unexpected provider request");
  return new Response(pages[org]);
};`,
    )
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GITHUB_STEP_SUMMARY: path.join(root, "step-summary.md"),
      GITHUB_OUTPUT: path.join(root, "outputs"),
    }
    for (const key of Object.keys(env)) if (key.startsWith("MEETUP_")) delete env[key]
    const result = spawnSync(
      process.execPath,
      ["--import", pathToFileURL(require.resolve("tsx")).href, "--import", pathToFileURL(preload).href, cli, ...args],
      {
        cwd: root,
        env,
        encoding: "utf8",
        timeout: 20000,
      },
    )
    expect(result.error).toBeUndefined()
    check(result, root)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

describe("discovery health without a content PR", () => {
  const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const listing = `<script id="__NEXT_DATA__">${JSON.stringify({
    props: {
      pageProps: {
        initialData: {
          data: {
            upcoming: {
              entries: [
                { event: { url: "new-event", name: "A valid event", start_at: startAt, timezone: "Asia/Singapore" } },
              ],
            },
          },
        },
      },
    },
  })}</script>`
  const eventPage = `<script id="__NEXT_DATA__">${JSON.stringify({
    props: {
      pageProps: {
        initialData: {
          data: {
            event: {
              name: "A valid event",
              start_at: startAt,
              timezone: "Asia/Singapore",
              location_type: "online",
            },
          },
        },
      },
    },
  })}</script>`

  test("records a fatal setup error before making provider requests", () => {
    runDiscovery(
      { healthy: calendar },
      (result, root) => {
        expect(result.status, String(result.stderr)).toBe(1)
        const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
        expect(report.fatalError).toContain("No supported event sources found")
        expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
      },
      ["--org=unknown"],
    )
  }, 15000)

  test("fails visibly when no supported sources are configured", () => {
    runDiscovery({}, (result, root) => {
      expect(result.status, String(result.stderr)).toBe(1)
      const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
      expect(report.sourceCount).toBe(0)
      expect(report.fatalError).toContain("No supported event sources found")
      expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
    })
  }, 15000)

  test("fails an all-source outage and preserves an actionable run report", () => {
    runDiscovery({ broken: "<html>provider layout changed</html>" }, (result, root) => {
      expect(result.status, String(result.stderr)).toBe(1)
      const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
      expect(report.sourceErrors).toHaveLength(1)
      expect(fs.readFileSync(path.join(root, "step-summary.md"), "utf8")).toContain("broken")
      expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
    })
  }, 15000)

  test("reports a partial outage even when healthy calendars have no new events", () => {
    runDiscovery({ healthy: calendar, broken: "<html>provider layout changed</html>" }, (result, root) => {
      expect(result.status, String(result.stderr)).toBe(0)
      const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
      expect(report.sourceCount).toBe(2)
      expect(report.sourceErrors).toHaveLength(1)
      expect(report.added).toEqual([])
      expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
      expect(fs.readFileSync(path.join(root, "step-summary.md"), "utf8")).toContain("partial")
    })
  }, 15000)

  test("keeps a genuinely empty calendar successful and reports no failures", () => {
    runDiscovery({ healthy: calendar }, (result, root) => {
      expect(result.status, String(result.stderr)).toBe(0)
      const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
      expect(report.sourceErrors).toEqual([])
      expect(report.eventErrors).toEqual([])
      expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=false")
    })
  }, 15000)

  test.each([null, { event: { url: "broken-event", start_at: "invalid date" } }])(
    "reports malformed records mixed into an otherwise valid calendar: %j",
    (malformed) => {
      const mixed = `<script id="__NEXT_DATA__">${JSON.stringify({
        props: {
          pageProps: {
            initialData: {
              data: {
                upcoming: {
                  entries: [{ event: { url: "future-event", start_at: startAt } }, malformed],
                },
              },
            },
          },
        },
      })}</script>`
      runDiscovery({ healthy: calendar, broken: mixed }, (result, root) => {
        expect(result.status, String(result.stderr)).toBe(0)
        const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
        expect(report.sourceErrors).toHaveLength(1)
        expect(report.sourceErrors[0]).toContain("broken")
        expect(report.sourceErrors[0]).toContain("event records")
        expect(report.added).toEqual([])
        expect(report.eventErrors).toEqual([])
        expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
        expect(fs.readFileSync(path.join(root, "step-summary.md"), "utf8")).toContain("partial")
      })
    },
    15000,
  )

  test("retains valid generated content and reports a partial source outage", () => {
    runDiscovery(
      { healthy: listing, broken: "<html>provider unavailable</html>" },
      (result, root) => {
        expect(result.status, String(result.stderr)).toBe(0)
        const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
        expect(report.added).toHaveLength(1)
        expect(report.sourceErrors).toHaveLength(1)
        const files = fs.readdirSync(path.join(root, "src", "content", "events"), { recursive: true })
        expect(files.filter((file) => String(file).endsWith("index.md"))).toHaveLength(1)
        expect(fs.readFileSync(path.join(root, "outputs"), "utf8")).toContain("has_errors=true")
      },
      [],
      { "new-event": eventPage },
    )
  }, 15000)

  test("fails and retains diagnostics when every new event fails to scrape", () => {
    runDiscovery(
      { healthy: listing },
      (result, root) => {
        expect(result.status, String(result.stderr)).toBe(1)
        const report = JSON.parse(fs.readFileSync(path.join(root, "scraper-output", "discovery-report.json"), "utf8"))
        expect(report.added).toEqual([])
        expect(report.eventErrors).toHaveLength(1)
        expect(fs.readFileSync(path.join(root, "step-summary.md"), "utf8")).toContain("Failed to scrape (1)")
      },
      [],
      { "new-event": "<html>event removed</html>" },
    )
  }, 15000)
})
