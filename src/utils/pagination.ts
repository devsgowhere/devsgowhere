/** Events shown per page on the upcoming and past events lists. */
export const PAGE_SIZE = 12

export const pageCount = (total: number, size: number = PAGE_SIZE): number => Math.max(1, Math.ceil(total / size))

/** A page number from the address bar (?page=3): a whole number from 1, otherwise 1. */
export function parsePage(value: string | null | undefined): number {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 ? page : 1
}

/** Keeps a page number within 1..last page, e.g. after a search leaves fewer results. */
export const clampPage = (page: number, total: number, size: number = PAGE_SIZE): number =>
  Math.min(Math.max(page, 1), pageCount(total, size))

/** The items on a 1-based page. */
export const pageSlice = <T>(items: T[], page: number, size: number = PAGE_SIZE): T[] =>
  items.slice((page - 1) * size, page * size)

/** 1-based, inclusive positions of the first and last item on a page ({ from: 0, to: 0 } when there are none). */
export function pageRange(page: number, total: number, size: number = PAGE_SIZE): { from: number; to: number } {
  if (total === 0) return { from: 0, to: 0 }
  return { from: (page - 1) * size + 1, to: Math.min(page * size, total) }
}

/**
 * The page links to show: all of them up to 7 pages, otherwise the first, the last, the current page and its
 * neighbours, with "…" for the gaps. Always 7 slots, so the control doesn't change width while paging.
 * e.g. 1 2 3 4 5 … 14   /   1 … 6 7 8 … 14   /   1 … 10 11 12 13 14
 */
export function pageItems(current: number, pages: number): (number | "…")[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  if (pages <= 7) return range(1, pages)
  if (current <= 4) return [...range(1, 5), "…", pages]
  if (current >= pages - 3) return [1, "…", ...range(pages - 4, pages)]
  return [1, "…", current - 1, current, current + 1, "…", pages]
}
