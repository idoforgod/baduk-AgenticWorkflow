// =============================================================================
// features/gamification/StreakTracker.ts — Streak Tracking
// =============================================================================
// Handles consecutive day tracking, streak bonus calculation, and streak state.
// Pure functions — no state, no I/O, no React dependencies.
// =============================================================================

import type { StreakUpdateResult } from './types'
import { computeStreakBonus } from './types'

// ---------------------------------------------------------------------------
// Date Utilities (streak-specific)
// ---------------------------------------------------------------------------

/**
 * Parse an ISO date string (YYYY-MM-DD) into year, month, day components.
 * Returns null if the string is invalid.
 */
function parseDateString(date: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/**
 * Compute the number of calendar days between two ISO date strings.
 * Returns a positive number if dateB is after dateA.
 * Returns 0 if same day, 1 if consecutive days, etc.
 */
export function daysBetween(dateA: string, dateB: string): number {
  const a = parseDateString(dateA)
  const b = parseDateString(dateB)
  if (!a || !b) return 0

  const msA = Date.UTC(a.year, a.month - 1, a.day)
  const msB = Date.UTC(b.year, b.month - 1, b.day)
  return Math.round((msB - msA) / (1000 * 60 * 60 * 24))
}

/**
 * Whether two ISO date strings represent the same calendar day.
 */
export function isSameDay(dateA: string, dateB: string): boolean {
  return dateA === dateB
}

/**
 * Whether dateB is exactly one calendar day after dateA (consecutive days).
 */
export function isConsecutiveDay(dateA: string, dateB: string): boolean {
  return daysBetween(dateA, dateB) === 1
}

// ---------------------------------------------------------------------------
// Streak Update Logic
// ---------------------------------------------------------------------------

/**
 * Update the streak based on a new activity recording.
 *
 * Rules:
 * - If lastActivityDate is null (first activity ever): streak becomes 1.
 * - If lastActivityDate is today: streak unchanged (already counted today).
 * - If lastActivityDate is yesterday: streak incremented by 1 (consecutive).
 * - If lastActivityDate is more than 1 day ago: streak resets to 1 (broken).
 *
 * @param currentStreak - Current streak value.
 * @param longestStreak - Longest streak ever achieved.
 * @param lastActivityDate - ISO date of last activity, or null if never.
 * @param todayDate - ISO date of today's activity.
 * @returns StreakUpdateResult describing what changed.
 */
export function updateStreak(
  currentStreak: number,
  longestStreak: number,
  lastActivityDate: string | null,
  todayDate: string
): StreakUpdateResult {
  const previousStreak = currentStreak

  // First activity ever
  if (lastActivityDate === null) {
    const newStreak = 1
    const bonusXP = computeStreakBonus(newStreak)
    return {
      previousStreak,
      newStreak,
      longestStreak: Math.max(longestStreak, newStreak),
      bonusXP,
      streakBroken: false,
    }
  }

  // Already recorded today — no change
  if (isSameDay(lastActivityDate, todayDate)) {
    return {
      previousStreak,
      newStreak: currentStreak,
      longestStreak,
      bonusXP: 0,
      streakBroken: false,
    }
  }

  // Yesterday — increment streak (consecutive)
  if (isConsecutiveDay(lastActivityDate, todayDate)) {
    const newStreak = currentStreak + 1
    const bonusXP = computeStreakBonus(newStreak)
    return {
      previousStreak,
      newStreak,
      longestStreak: Math.max(longestStreak, newStreak),
      bonusXP,
      streakBroken: false,
    }
  }

  // Gap > 1 day — streak broken, reset to 1
  const newStreak = 1
  const bonusXP = computeStreakBonus(newStreak)
  return {
    previousStreak,
    newStreak,
    longestStreak, // longest streak is NOT reset when broken
    bonusXP,
    streakBroken: true,
  }
}

// ---------------------------------------------------------------------------
// Streak Display Helpers
// ---------------------------------------------------------------------------

/**
 * Whether the streak is currently "at risk" (no activity today but streak > 0).
 * Used to show the at-risk visual state in the UI.
 */
export function isStreakAtRisk(
  streak: number,
  lastActivityDate: string | null,
  todayDate: string
): boolean {
  if (streak === 0) return false
  if (lastActivityDate === null) return false
  return !isSameDay(lastActivityDate, todayDate)
}

/**
 * Whether the user has already played today (streak is safe for now).
 */
export function hasPlayedToday(lastActivityDate: string | null, todayDate: string): boolean {
  if (lastActivityDate === null) return false
  return isSameDay(lastActivityDate, todayDate)
}

/**
 * Format the streak for display (e.g., "7-day streak").
 */
export function formatStreak(streak: number): string {
  if (streak === 0) return 'No streak'
  if (streak === 1) return '1-day streak'
  return `${streak}-day streak`
}
