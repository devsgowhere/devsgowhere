import { describe, expect, test } from "vitest"
import { clampPage, pageCount, pageItems, pageRange, pageSlice, parsePage } from "./pagination"

describe("pageCount and clampPage", () => {
  test("rounds up, with at least one page", () => {
    expect(pageCount(0, 12)).toBe(1)
    expect(pageCount(12, 12)).toBe(1)
    expect(pageCount(13, 12)).toBe(2)
    expect(pageCount(162, 12)).toBe(14)
  })

  test("keeps a page within range", () => {
    expect(clampPage(0, 30, 12)).toBe(1)
    expect(clampPage(2, 30, 12)).toBe(2)
    expect(clampPage(9, 30, 12)).toBe(3)
    expect(clampPage(5, 0, 12)).toBe(1)
  })
})

describe("parsePage", () => {
  test.each([
    ["3", 3],
    ["1", 1],
    ["0", 1],
    ["-2", 1],
    ["2.5", 1],
    ["abc", 1],
    ["", 1],
    [null, 1],
    [undefined, 1],
  ])("%s → %s", (value, expected) => expect(parsePage(value)).toBe(expected))
})

describe("pageSlice and pageRange", () => {
  const items = Array.from({ length: 30 }, (_, i) => i + 1)

  test("slices a page, the last one partly full", () => {
    expect(pageSlice(items, 1, 12)).toEqual(items.slice(0, 12))
    expect(pageSlice(items, 3, 12)).toEqual([25, 26, 27, 28, 29, 30])
    expect(pageSlice(items, 4, 12)).toEqual([])
  })

  test("gives the 'Showing x–y' numbers", () => {
    expect(pageRange(1, 30, 12)).toEqual({ from: 1, to: 12 })
    expect(pageRange(3, 30, 12)).toEqual({ from: 25, to: 30 })
    expect(pageRange(1, 0, 12)).toEqual({ from: 0, to: 0 })
  })
})

describe("pageItems", () => {
  test("shows every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1])
    expect(pageItems(2, 3)).toEqual([1, 2, 3])
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  test("collapses the gaps, always in 7 slots", () => {
    expect(pageItems(1, 14)).toEqual([1, 2, 3, 4, 5, "…", 14])
    expect(pageItems(4, 14)).toEqual([1, 2, 3, 4, 5, "…", 14])
    expect(pageItems(5, 14)).toEqual([1, "…", 4, 5, 6, "…", 14])
    expect(pageItems(10, 14)).toEqual([1, "…", 9, 10, 11, "…", 14])
    expect(pageItems(11, 14)).toEqual([1, "…", 10, 11, 12, 13, 14])
    expect(pageItems(14, 14)).toEqual([1, "…", 10, 11, 12, 13, 14])
    for (let page = 1; page <= 14; page++) expect(pageItems(page, 14)).toHaveLength(7)
  })
})
