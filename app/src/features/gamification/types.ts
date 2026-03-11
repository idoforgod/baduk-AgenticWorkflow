// =============================================================================
// features/gamification/types.ts — Gamification System Types
// =============================================================================
// All types internal to the gamification feature module.
// External types (Quest, Achievement, etc.) come from @core/interfaces.
// These types extend the interface types with implementation detail.
// =============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Quest Types
// ---------------------------------------------------------------------------

/**
 * The three daily quest types that are generated each day.
 * Aligned with the three daily quests specified in requirements.
 */
export type DailyQuestType = 'play_game' | 'view_explanation' | 'review_game'

/** A daily quest with progress tracking */
export interface DailyQuest {
  readonly id: string
  readonly type: DailyQuestType
  readonly title: string
  readonly description: string
  /** Required amount to complete the quest */
  readonly target: number
  /** Current progress toward the target */
  readonly progress: number
  /** Whether the quest has been completed */
  readonly completed: boolean
  /** ISO date string (YYYY-MM-DD) for which this quest was generated */
  readonly date: string
  /** XP reward on completion */
  readonly xpReward: number
}

/** Zod schema for DailyQuest — used for DB serialization validation */
export const DailyQuestSchema = z.object({
  id: z.string(),
  type: z.enum(['play_game', 'view_explanation', 'review_game']),
  title: z.string(),
  description: z.string(),
  target: z.number().int().positive(),
  progress: z.number().int().min(0),
  completed: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  xpReward: z.number().int().positive(),
})

/** Zod schema for an array of DailyQuests — used to parse DB JSON */
export const DailyQuestArraySchema = z.array(DailyQuestSchema)

// ---------------------------------------------------------------------------
// XP & Level Types
// ---------------------------------------------------------------------------

/** XP source for tracking where XP came from */
export type XPSource =
  | 'quest_complete'
  | 'all_quests_complete'
  | 'game_complete'
  | 'game_win'
  | 'analysis_viewed'
  | 'streak_bonus'

/** XP award amounts by source */
export const XP_AWARDS = {
  quest_play_game: 50,
  quest_view_explanation: 30,
  quest_review_game: 40,
  all_quests_bonus: 50,
  game_complete: 20,
  game_win: 30,
  analysis_viewed: 10,
} as const

/** Max level cap */
export const MAX_LEVEL = 50

/**
 * XP required to complete a given level (i.e. XP to gain that level).
 * Each level requires 100 XP. Level 2 is gained at 100 total XP,
 * Level 3 at 200 total XP, Level 50 at 4900 total XP.
 * Formula: level × 100 represents the threshold to reach (level+1).
 */
export function xpForLevel(level: number): number {
  return level * 100
}

/**
 * Compute the level from a total XP amount.
 * Returns a level in [1, MAX_LEVEL].
 *
 * Thresholds (cumulative XP to reach level N):
 *   Level 1: 0 XP
 *   Level 2: 100 XP
 *   Level 3: 200 XP
 *   Level N: (N-1) * 100 XP
 *   Level 50: 4900 XP
 *
 * Formula: level = floor(totalXP / 100) + 1, clamped to [1, MAX_LEVEL].
 */
export function levelFromXP(totalXP: number): number {
  if (totalXP < 0) return 1
  const level = Math.floor(totalXP / 100) + 1
  return Math.min(level, MAX_LEVEL)
}

/** XP within the current level (XP since last level-up, 0-99) */
export function xpInCurrentLevel(totalXP: number): number {
  if (totalXP < 0) return 0
  const level = levelFromXP(totalXP)
  if (level >= MAX_LEVEL) return totalXP
  // Threshold to enter current level = (level - 1) * 100
  const levelStartXP = (level - 1) * 100
  return totalXP - levelStartXP
}

/** XP needed to reach next level from current total (0 if at max level) */
export function xpToNextLevel(totalXP: number): number {
  const level = levelFromXP(totalXP)
  if (level >= MAX_LEVEL) return 0
  // Next level threshold = level * 100 (since level N starts at (N-1)*100)
  const nextLevelStartXP = level * 100
  return nextLevelStartXP - totalXP
}

// ---------------------------------------------------------------------------
// Streak Types
// ---------------------------------------------------------------------------

/** Visual state of the streak indicator */
export type StreakState = 'active' | 'at_risk' | 'broken'

/** Maximum streak bonus XP per activity */
export const MAX_STREAK_BONUS = 50

/** XP bonus per streak day (capped at MAX_STREAK_BONUS) */
export const STREAK_BONUS_PER_DAY = 5

/**
 * Compute streak bonus XP for a given streak count.
 * Formula: streak * 5, capped at 50.
 */
export function computeStreakBonus(streak: number): number {
  return Math.min(streak * STREAK_BONUS_PER_DAY, MAX_STREAK_BONUS)
}

/**
 * Determine the visual state of a streak.
 * - 'active': played today
 * - 'at_risk': streak > 0 but no play today
 * - 'broken': streak is 0
 */
export function getStreakState(streak: number, playedToday: boolean): StreakState {
  if (streak === 0) return 'broken'
  if (playedToday) return 'active'
  return 'at_risk'
}

// ---------------------------------------------------------------------------
// Badge Types
// ---------------------------------------------------------------------------

/** All badge IDs — complete set of 8 badges */
export type BadgeId =
  | 'first_win'
  | 'first_review'
  | 'onboarding_complete'
  | 'streak_7'
  | 'streak_30'
  | 'games_100'
  | 'level_10'
  | 'quest_master'

/** A badge definition (static metadata) */
export interface BadgeDefinition {
  readonly id: BadgeId
  readonly name: string
  readonly description: string
  readonly condition: string
}

/** An earned badge record (stored in DB) */
export interface EarnedBadge {
  readonly id: BadgeId
  /** Unix timestamp when badge was earned */
  readonly earnedAt: number
}

/** Zod schema for EarnedBadge */
export const EarnedBadgeSchema = z.object({
  id: z.enum([
    'first_win',
    'first_review',
    'onboarding_complete',
    'streak_7',
    'streak_30',
    'games_100',
    'level_10',
    'quest_master',
  ]),
  earnedAt: z.number().int().positive(),
})

/** Zod schema for an array of EarnedBadge — used to parse DB JSON */
export const EarnedBadgeArraySchema = z.array(EarnedBadgeSchema)

/** All badge definitions */
export const BADGE_DEFINITIONS: readonly BadgeDefinition[] = [
  {
    id: 'first_win',
    name: 'First Win',
    description: 'Win your first game',
    condition: 'Win 1 game',
  },
  {
    id: 'first_review',
    name: 'First Review',
    description: 'View your first post-game analysis',
    condition: 'View 1 post-game analysis',
  },
  {
    id: 'onboarding_complete',
    name: 'Onboarding Complete',
    description: 'Finish the tutorial',
    condition: 'Complete the tutorial',
  },
  {
    id: 'streak_7',
    name: '7-Day Streak',
    description: 'Maintain a 7-day play streak',
    condition: 'Play every day for 7 consecutive days',
  },
  {
    id: 'streak_30',
    name: '30-Day Streak',
    description: 'Maintain a 30-day play streak',
    condition: 'Play every day for 30 consecutive days',
  },
  {
    id: 'games_100',
    name: '100 Games',
    description: 'Play 100 total games',
    condition: 'Play 100 games',
  },
  {
    id: 'level_10',
    name: 'Level 10',
    description: 'Reach level 10',
    condition: 'Reach level 10',
  },
  {
    id: 'quest_master',
    name: 'Quest Master',
    description: 'Complete all daily quests 7 times',
    condition: 'Complete all 3 daily quests on 7 different days',
  },
] as const

// ---------------------------------------------------------------------------
// Persisted State Types
// ---------------------------------------------------------------------------

/**
 * The full gamification state for a user.
 * This is what is loaded from and saved to the DB.
 */
export interface GamificationState {
  /** Total XP earned */
  readonly totalXP: number
  /** Current level (derived, but stored for quick access) */
  readonly level: number
  /** Current streak (consecutive days with at least 1 game) */
  readonly streak: number
  /** Longest streak ever achieved */
  readonly longestStreak: number
  /** Last activity date (ISO YYYY-MM-DD), null if never played */
  readonly lastActivityDate: string | null
  /** Today's daily quests */
  readonly dailyQuests: readonly DailyQuest[]
  /** Earned badges */
  readonly earnedBadges: readonly EarnedBadge[]
  /** Total games played (for '100 Games' badge) */
  readonly totalGamesPlayed: number
  /** Total wins (for 'First Win' badge) */
  readonly totalWins: number
  /** Number of post-game analyses viewed (for 'First Review' badge) */
  readonly totalReviewsViewed: number
  /** Number of times ALL daily quests were completed in a single day */
  readonly allQuestsCompletedDays: number
  /** Whether the tutorial has been completed */
  readonly tutorialCompleted: boolean
}

/** Default initial state for a new user */
export const DEFAULT_GAMIFICATION_STATE: GamificationState = {
  totalXP: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  lastActivityDate: null,
  dailyQuests: [],
  earnedBadges: [],
  totalGamesPlayed: 0,
  totalWins: 0,
  totalReviewsViewed: 0,
  allQuestsCompletedDays: 0,
  tutorialCompleted: false,
}

// ---------------------------------------------------------------------------
// Persistence Interface (DI — mockable in tests)
// ---------------------------------------------------------------------------

/**
 * Persistence interface for gamification data.
 * The production implementation reads/writes to the DB via Tauri.
 * Tests use an in-memory implementation.
 */
export interface IGamificationPersistence {
  /**
   * Load the gamification state for a user.
   * Returns null if no state exists yet (first-time user).
   */
  load(userId: string): Promise<GamificationState | null>

  /**
   * Save the gamification state for a user.
   */
  save(userId: string, state: GamificationState): Promise<void>
}

// ---------------------------------------------------------------------------
// Event Types (for game events that trigger gamification updates)
// ---------------------------------------------------------------------------

/** Events that can trigger gamification updates */
export type GamificationEvent =
  | { readonly type: 'game_completed'; readonly won: boolean }
  | { readonly type: 'analysis_viewed' }
  | { readonly type: 'review_viewed' }
  | { readonly type: 'tutorial_completed' }
  | { readonly type: 'quest_progress'; readonly questType: DailyQuestType; readonly amount: number }

// ---------------------------------------------------------------------------
// Result Types for Gamification Operations
// ---------------------------------------------------------------------------

/** Result of an XP award operation */
export interface XPAwardResult {
  /** XP that was awarded */
  readonly xpAwarded: number
  /** Total XP after award */
  readonly totalXP: number
  /** Level before award */
  readonly previousLevel: number
  /** Level after award */
  readonly newLevel: number
  /** Whether a level-up occurred */
  readonly leveledUp: boolean
}

/** Result of a streak update operation */
export interface StreakUpdateResult {
  /** Previous streak value */
  readonly previousStreak: number
  /** New streak value */
  readonly newStreak: number
  /** Longest streak (may be updated) */
  readonly longestStreak: number
  /** Streak bonus XP earned */
  readonly bonusXP: number
  /** Whether the streak was broken */
  readonly streakBroken: boolean
}

/** Result of processing a game event */
export interface GameEventResult {
  /** XP events that occurred */
  readonly xpEvents: readonly XPAwardResult[]
  /** Badges newly unlocked */
  readonly newBadges: readonly EarnedBadge[]
  /** Quest updates */
  readonly questUpdates: readonly DailyQuest[]
  /** Streak update (if applicable) */
  readonly streakUpdate: StreakUpdateResult | null
}
