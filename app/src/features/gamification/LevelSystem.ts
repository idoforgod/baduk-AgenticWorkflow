// =============================================================================
// features/gamification/LevelSystem.ts — XP & Level Progression
// =============================================================================
// Handles XP calculation, level progression, and level-up detection.
// Pure functions — no state, no I/O, no React dependencies.
// =============================================================================

import type { XPAwardResult, XPSource } from './types'
import { levelFromXP, MAX_LEVEL, XP_AWARDS, xpInCurrentLevel, xpToNextLevel } from './types'

// ---------------------------------------------------------------------------
// XP Award Amounts (by source)
// ---------------------------------------------------------------------------

/**
 * Get the XP amount awarded for a given source.
 * Sources map to the XP_AWARDS constants defined in types.ts.
 */
export function getXPForSource(source: XPSource): number {
  switch (source) {
    case 'game_complete':
      return XP_AWARDS.game_complete
    case 'game_win':
      return XP_AWARDS.game_win
    case 'analysis_viewed':
      return XP_AWARDS.analysis_viewed
    case 'quest_complete':
      // Quest XP is handled separately (each quest has its own XP)
      return 0
    case 'all_quests_complete':
      return XP_AWARDS.all_quests_bonus
    case 'streak_bonus':
      // Streak bonus is computed dynamically
      return 0
  }
}

// ---------------------------------------------------------------------------
// Level Progression
// ---------------------------------------------------------------------------

/**
 * Award XP and compute the resulting level change.
 * Returns an XPAwardResult describing what happened.
 *
 * @param currentTotalXP - The user's current total XP before the award.
 * @param xpToAdd - The amount of XP to add. Must be positive.
 * @returns XPAwardResult with level change details.
 */
export function awardXP(currentTotalXP: number, xpToAdd: number): XPAwardResult {
  if (xpToAdd <= 0) {
    throw new Error(`Invalid XP amount: ${xpToAdd}. Must be positive.`)
  }

  const previousLevel = levelFromXP(currentTotalXP)
  const newTotalXP = currentTotalXP + xpToAdd
  const newLevel = levelFromXP(newTotalXP)

  return {
    xpAwarded: xpToAdd,
    totalXP: newTotalXP,
    previousLevel,
    newLevel,
    leveledUp: newLevel > previousLevel,
  }
}

/**
 * Compute the player level information for display.
 * Returns level, current XP within level, and XP needed for next level.
 */
export function computePlayerLevel(totalXP: number): {
  level: number
  currentXP: number
  xpForNextLevel: number
  totalXP: number
  isMaxLevel: boolean
} {
  const level = levelFromXP(totalXP)
  const isMaxLevel = level >= MAX_LEVEL

  return {
    level,
    currentXP: isMaxLevel ? totalXP : xpInCurrentLevel(totalXP),
    xpForNextLevel: isMaxLevel ? 0 : xpToNextLevel(totalXP),
    totalXP,
    isMaxLevel,
  }
}

/**
 * Check if awarding XP would cause a level-up.
 * Useful for previewing the effect of an XP award before applying it.
 */
export function wouldLevelUp(currentTotalXP: number, xpToAdd: number): boolean {
  const currentLevel = levelFromXP(currentTotalXP)
  if (currentLevel >= MAX_LEVEL) return false
  const newLevel = levelFromXP(currentTotalXP + xpToAdd)
  return newLevel > currentLevel
}

/**
 * Get the XP progress percentage within the current level (0-100).
 * Returns 100 if at max level.
 */
export function getLevelProgressPercent(totalXP: number): number {
  const level = levelFromXP(totalXP)
  if (level >= MAX_LEVEL) return 100

  const inLevel = xpInCurrentLevel(totalXP)
  const levelSize = 100 // each level requires 100 XP
  return Math.round((inLevel / levelSize) * 100)
}

/**
 * Get a display string for a level (e.g., "Level 5").
 */
export function formatLevel(level: number): string {
  return `Level ${level}`
}

/**
 * Get the total XP threshold needed to reach a given level.
 * Level 1 = 0 XP, Level 2 = 100 XP, Level 3 = 200 XP, etc.
 * Note: this is (level-1)*100 because level 1 starts at 0 XP.
 */
export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0
  return (level - 1) * 100
}
