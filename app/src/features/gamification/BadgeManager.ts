// =============================================================================
// features/gamification/BadgeManager.ts — Badge Unlock System
// =============================================================================
// Handles badge unlock conditions and badge tracking.
// Pure functions — no state, no I/O, no React dependencies.
// Badges are never lost once earned (idempotent unlocking).
// =============================================================================

import type { BadgeId, EarnedBadge, GamificationState } from './types'
import { BADGE_DEFINITIONS } from './types'

// ---------------------------------------------------------------------------
// Badge Unlock Conditions
// ---------------------------------------------------------------------------

/**
 * Check all badge conditions against the current state and return any
 * newly earned badges (badges not already in earnedBadges).
 *
 * This function is idempotent: calling it multiple times with the same
 * state will not create duplicate badges.
 *
 * @param state - Current gamification state.
 * @param nowFn - Injectable date function for testability.
 * @returns Array of newly earned EarnedBadge records (may be empty).
 */
export function checkBadgeUnlocks(
  state: GamificationState,
  nowFn: () => Date = () => new Date()
): readonly EarnedBadge[] {
  const alreadyEarned = new Set(state.earnedBadges.map((b) => b.id))
  const newBadges: EarnedBadge[] = []
  const now = Math.floor(nowFn().getTime() / 1000)

  // Helper: add badge if not already earned and condition is met
  const tryUnlock = (id: BadgeId, condition: boolean) => {
    if (!alreadyEarned.has(id) && condition) {
      newBadges.push({ id, earnedAt: now })
      alreadyEarned.add(id) // prevent double-add in same check
    }
  }

  tryUnlock('first_win', state.totalWins >= 1)
  tryUnlock('first_review', state.totalReviewsViewed >= 1)
  tryUnlock('onboarding_complete', state.tutorialCompleted)
  tryUnlock('streak_7', state.streak >= 7)
  tryUnlock('streak_30', state.streak >= 30)
  tryUnlock('games_100', state.totalGamesPlayed >= 100)
  tryUnlock('level_10', state.level >= 10)
  tryUnlock('quest_master', state.allQuestsCompletedDays >= 7)

  return newBadges
}

/**
 * Merge newly earned badges into an existing earned badge array.
 * New badges are appended; existing badges are preserved.
 * Duplicate badge IDs are ignored (earned badges are never lost or duplicated).
 */
export function mergeBadges(
  existing: readonly EarnedBadge[],
  newBadges: readonly EarnedBadge[]
): readonly EarnedBadge[] {
  if (newBadges.length === 0) return existing

  const existingIds = new Set(existing.map((b) => b.id))
  const toAdd = newBadges.filter((b) => !existingIds.has(b.id))

  if (toAdd.length === 0) return existing
  return [...existing, ...toAdd]
}

// ---------------------------------------------------------------------------
// Badge Query Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a specific badge has been earned.
 */
export function hasBadge(earnedBadges: readonly EarnedBadge[], id: BadgeId): boolean {
  return earnedBadges.some((b) => b.id === id)
}

/**
 * Get the full Achievement objects for display in the UI.
 * Merges static badge definitions with earned status.
 */
export function getBadgesForDisplay(earnedBadges: readonly EarnedBadge[]): readonly {
  id: BadgeId
  name: string
  description: string
  condition: string
  earned: boolean
  earnedAt: number | null
}[] {
  const earnedMap = new Map(earnedBadges.map((b) => [b.id, b.earnedAt]))

  return BADGE_DEFINITIONS.map((def) => {
    const earnedAt = earnedMap.get(def.id)
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      condition: def.condition,
      earned: earnedMap.has(def.id),
      earnedAt: earnedAt !== undefined ? earnedAt : null,
    }
  })
}

/**
 * Get the count of earned badges.
 */
export function earnedBadgeCount(earnedBadges: readonly EarnedBadge[]): number {
  return earnedBadges.length
}

/**
 * Get the total number of defined badges.
 */
export function totalBadgeCount(): number {
  return BADGE_DEFINITIONS.length
}
