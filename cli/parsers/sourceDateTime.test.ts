import { describe, expect, test } from "vitest"
import { parseSourceDateTime } from "./sourceDateTime"

describe("parseSourceDateTime", () => {
  test.each([
    "2026-11-12T09:00:00+08:00",
    "20261112T090000+0800",
    "2026-11-12T01:00Z",
    "2026-W46-4T09:00:00+08:00",
    "2026-316T09:00:00+08:00",
  ])("accepts complete ISO source timestamps: %s", (source) => {
    const result = parseSourceDateTime(source).setZone("Asia/Singapore")
    expect(result.isValid).toBe(true)
    expect(result.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-11-12 09:00")
  })

  test.each([
    undefined,
    null,
    123,
    {},
    "2026",
    "2026-11",
    "2026-11-12",
    "2026-W46",
    "2026-W46T09:00",
    "2026-11T09:00",
    "T09:00",
    "09:00",
    "2026-11-12T09",
    "2026-02-30T09:00+08:00",
    "2026-11-12T09:60+08:00",
    "2026-11-12T09:00+24:00",
    "2026-11-12T09:00-2460",
    "2026-11-12T09:00+08:60",
  ])("rejects incomplete timestamps and malformed offsets: %j", (source) => {
    expect(parseSourceDateTime(source).isValid).toBe(false)
  })
})
