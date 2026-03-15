// =============================================================================
// utils/formatRelativeDate.ts — Unix timestamp to relative date string
// =============================================================================
// Deterministic pure function. Anti-Hallucination L3: golden-tested.
//
// Uses local timezone via Date constructor (system timezone).
// =============================================================================

/**
 * Format a Unix epoch timestamp (seconds) as a relative date string.
 *
 * @param epochSeconds - Unix timestamp in seconds
 * @param now - Current time in ms (default: Date.now()). Overridable for testing.
 * @returns Relative date string: "Today", "Yesterday", "3 days ago", "Mar 10"
 */
export function formatRelativeDate(epochSeconds: number, now?: number): string {
  const currentMs = now ?? Date.now()

  const targetDate = new Date(epochSeconds * 1000)
  const currentDate = new Date(currentMs)

  // Compare by calendar date (local timezone)
  const targetDay = toDateOnly(targetDate)
  const currentDay = toDateOnly(currentDate)

  const diffMs = currentDay.getTime() - targetDay.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays >= 2 && diffDays <= 6) return `${diffDays} days ago`

  // Beyond 6 days: show "Mon DD" format
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  const month = months[targetDate.getMonth()]
  const day = targetDate.getDate()
  return `${month} ${day}`
}

/**
 * Strip time portion, keeping only date (midnight local time).
 */
function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
