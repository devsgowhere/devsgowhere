export const toSlug = (str: string): string => {
  return str
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-z0-9\s-]/g, "") // Remove non-alphanumeric characters except spaces and hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Remove multiple consecutive hyphens
}

interface SortableEvent {
  id: string
  data: { startDate: string; startTime: string }
}

/**
 * Orders events by start date, then start time, then ID, so events on the same day keep a stable order
 * (content collections don't guarantee one). Reverse the arguments for newest first.
 */
export const compareEventsByStart = (a: SortableEvent, b: SortableEvent): number =>
  a.data.startDate.localeCompare(b.data.startDate) ||
  a.data.startTime.localeCompare(b.data.startTime) ||
  a.id.localeCompare(b.id)
