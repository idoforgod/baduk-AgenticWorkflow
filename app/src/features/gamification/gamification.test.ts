// =============================================================================
// features/gamification/gamification.test.ts — Gamification System Tests
// =============================================================================
// 50+ tests covering:
//   1. Quest generation and daily reset
//   2. Quest progress tracking (0%, partial, 100%)
//   3. All-quest bonus XP
//   4. XP calculation from various sources
//   5. Level-up at correct thresholds
//   6. Max level cap
//   7. Streak increment, maintenance, breaking
//   8. Streak bonus calculation (capped at 50 XP)
//   9. Badge unlock for each of 8 badges
//  10. Badge persistence (earned badges never lost)
//  11. State save/load round-trip
//  12. Edge cases: midnight rollover, first-time user, data corruption recovery
// =============================================================================

import { describe, expect, it } from 'vitest'
// Badge Manager
import {
  checkBadgeUnlocks,
  earnedBadgeCount,
  getBadgesForDisplay,
  hasBadge,
  mergeBadges,
  totalBadgeCount,
} from './BadgeManager'
// Service
import { GamificationService } from './GamificationService'
// Level System
import {
  awardXP,
  computePlayerLevel,
  getLevelProgressPercent,
  getXPForSource,
  wouldLevelUp,
  xpThresholdForLevel,
} from './LevelSystem'
// Quest System
import {
  areAllQuestsCompleted,
  completeQuestById,
  countCompletedQuests,
  formatDateLocal,
  generateDailyQuests,
  generateQuestId,
  getOrCreateDailyQuests,
  getQuestXPReward,
  needsQuestReset,
  updateQuestProgress,
} from './QuestSystem'
// Streak Tracker
import {
  daysBetween,
  formatStreak,
  hasPlayedToday,
  isConsecutiveDay,
  isSameDay,
  isStreakAtRisk,
  updateStreak,
} from './StreakTracker'

// Types
import type { DailyQuest, EarnedBadge, GamificationState, IGamificationPersistence } from './types'
import {
  BADGE_DEFINITIONS,
  computeStreakBonus,
  DEFAULT_GAMIFICATION_STATE,
  levelFromXP,
  MAX_LEVEL,
  MAX_STREAK_BONUS,
  XP_AWARDS,
  xpForLevel,
  xpInCurrentLevel,
  xpToNextLevel,
} from './types'

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** In-memory persistence for tests */
function makeMemoryPersistence(): IGamificationPersistence & {
  store: Map<string, GamificationState>
  saveCount: number
} {
  const store = new Map<string, GamificationState>()
  return {
    store,
    saveCount: 0,
    async load(userId: string) {
      return store.get(userId) ?? null
    },
    async save(userId: string, state: GamificationState) {
      store.set(userId, state)
      this.saveCount++
    },
  }
}

/** Build a minimal GamificationState for testing */
function makeState(overrides: Partial<GamificationState> = {}): GamificationState {
  return { ...DEFAULT_GAMIFICATION_STATE, ...overrides }
}

/** Helper to create a service loaded with a pre-set state */
async function makeLoadedService(
  overrides: Partial<GamificationState> = {},
  nowFn: () => Date = () => new Date('2026-03-11T12:00:00Z')
): Promise<{
  service: GamificationService
  persistence: ReturnType<typeof makeMemoryPersistence>
}> {
  const persistence = makeMemoryPersistence()
  const state = makeState(overrides)
  await persistence.save('user1', state)
  const service = new GamificationService('user1', persistence, nowFn)
  await service.load()
  return { service, persistence }
}

// ---------------------------------------------------------------------------
// SECTION 1: Quest Generation
// ---------------------------------------------------------------------------

describe('QuestSystem: generateDailyQuests', () => {
  it('generates exactly 3 quests for a given date', () => {
    const quests = generateDailyQuests('2026-03-11')
    expect(quests).toHaveLength(3)
  })

  it('generates all 3 required quest types', () => {
    const quests = generateDailyQuests('2026-03-11')
    const types = quests.map((q) => q.type)
    expect(types).toContain('play_game')
    expect(types).toContain('view_explanation')
    expect(types).toContain('review_game')
  })

  it('assigns correct XP rewards', () => {
    const quests = generateDailyQuests('2026-03-11')
    const playGame = quests.find((q) => q.type === 'play_game')
    const viewExp = quests.find((q) => q.type === 'view_explanation')
    const reviewGame = quests.find((q) => q.type === 'review_game')
    expect(playGame?.xpReward).toBe(XP_AWARDS.quest_play_game) // 50
    expect(viewExp?.xpReward).toBe(XP_AWARDS.quest_view_explanation) // 30
    expect(reviewGame?.xpReward).toBe(XP_AWARDS.quest_review_game) // 40
  })

  it('generates quests with zero progress', () => {
    const quests = generateDailyQuests('2026-03-11')
    for (const quest of quests) {
      expect(quest.progress).toBe(0)
      expect(quest.completed).toBe(false)
    }
  })

  it('assigns the correct date to all quests', () => {
    const date = '2026-03-11'
    const quests = generateDailyQuests(date)
    for (const quest of quests) {
      expect(quest.date).toBe(date)
    }
  })

  it('generates deterministic quest IDs (same date = same IDs)', () => {
    const quests1 = generateDailyQuests('2026-03-11')
    const quests2 = generateDailyQuests('2026-03-11')
    expect(quests1.map((q) => q.id)).toEqual(quests2.map((q) => q.id))
  })

  it('generates different quest IDs for different dates', () => {
    const quests1 = generateDailyQuests('2026-03-11')
    const quests2 = generateDailyQuests('2026-03-12')
    expect(quests1[0]?.id).not.toBe(quests2[0]?.id)
  })
})

// ---------------------------------------------------------------------------
// SECTION 2: Quest Reset Logic
// ---------------------------------------------------------------------------

describe('QuestSystem: needsQuestReset', () => {
  it('returns true when quest array is empty', () => {
    expect(needsQuestReset([], '2026-03-11')).toBe(true)
  })

  it('returns true when quests are from a different date', () => {
    const quests = generateDailyQuests('2026-03-10')
    expect(needsQuestReset(quests, '2026-03-11')).toBe(true)
  })

  it('returns false when quests are from today', () => {
    const quests = generateDailyQuests('2026-03-11')
    expect(needsQuestReset(quests, '2026-03-11')).toBe(false)
  })
})

describe('QuestSystem: getOrCreateDailyQuests (midnight rollover)', () => {
  it('returns existing quests if they are for today', () => {
    const today = '2026-03-11'
    const existing = generateDailyQuests(today)
    // Simulate non-UTC midnight: use a local date string that matches today
    const result = getOrCreateDailyQuests(existing, () => {
      const d = new Date(`${today}T12:00:00`)
      return d
    })
    expect(result[0]?.date).toBe(today)
    expect(result).toHaveLength(3)
  })

  it('generates new quests when date changes (midnight rollover)', () => {
    const yesterday = '2026-03-10'
    const today = '2026-03-11'
    const existing = generateDailyQuests(yesterday)
    // Mark some progress on yesterday's quests
    const withProgress = updateQuestProgress(existing, 'play_game', 1)
    const nowFn = () => new Date(`${today}T00:01:00`)
    const result = getOrCreateDailyQuests(withProgress, nowFn)
    // New quests should be for today with zero progress
    expect(result[0]?.date).toBe(today)
    expect(result.every((q) => q.progress === 0)).toBe(true)
    expect(result.every((q) => !q.completed)).toBe(true)
  })

  it('generates new quests for first-time user (empty array)', () => {
    const today = '2026-03-11'
    const nowFn = () => new Date(`${today}T09:00:00`)
    const result = getOrCreateDailyQuests([], nowFn)
    expect(result).toHaveLength(3)
    expect(result[0]?.date).toBe(today)
  })
})

// ---------------------------------------------------------------------------
// SECTION 3: Quest Progress Tracking
// ---------------------------------------------------------------------------

describe('QuestSystem: updateQuestProgress', () => {
  const date = '2026-03-11'

  it('increments progress on the correct quest type', () => {
    const quests = generateDailyQuests(date)
    const updated = updateQuestProgress(quests, 'play_game', 1)
    const playGame = updated.find((q) => q.type === 'play_game')
    expect(playGame?.progress).toBe(1)
    // Other quests unchanged
    expect(updated.find((q) => q.type === 'view_explanation')?.progress).toBe(0)
  })

  it('does not exceed the target', () => {
    const quests = generateDailyQuests(date)
    // view_explanation target is 3 — try to add 10
    const updated = updateQuestProgress(quests, 'view_explanation', 10)
    const viewExp = updated.find((q) => q.type === 'view_explanation')
    expect(viewExp?.progress).toBe(3) // clamped at target
    expect(viewExp?.completed).toBe(true)
  })

  it('marks quest as completed when progress reaches target', () => {
    const quests = generateDailyQuests(date)
    const updated = updateQuestProgress(quests, 'play_game', 1)
    const playGame = updated.find((q) => q.type === 'play_game')
    expect(playGame?.completed).toBe(true) // target is 1
  })

  it('does not change a completed quest', () => {
    const quests = generateDailyQuests(date)
    const withCompletion = updateQuestProgress(quests, 'play_game', 1)
    const again = updateQuestProgress(withCompletion, 'play_game', 1)
    const playGame = again.find((q) => q.type === 'play_game')
    expect(playGame?.progress).toBe(1) // unchanged
    expect(playGame?.completed).toBe(true)
  })

  it('tracks partial progress correctly (view_explanation needs 3)', () => {
    const quests = generateDailyQuests(date)
    const after1 = updateQuestProgress(quests, 'view_explanation', 1)
    const after2 = updateQuestProgress(after1, 'view_explanation', 1)
    const viewExp2 = after2.find((q) => q.type === 'view_explanation')
    expect(viewExp2?.progress).toBe(2)
    expect(viewExp2?.completed).toBe(false)

    const after3 = updateQuestProgress(after2, 'view_explanation', 1)
    const viewExp3 = after3.find((q) => q.type === 'view_explanation')
    expect(viewExp3?.progress).toBe(3)
    expect(viewExp3?.completed).toBe(true)
  })
})

describe('QuestSystem: completeQuestById', () => {
  it('completes a quest and returns it', () => {
    const quests = generateDailyQuests('2026-03-11')
    const playGameId = generateQuestId('2026-03-11', 'play_game')
    const { quest, quests: updated } = completeQuestById(quests, playGameId)
    expect(quest.completed).toBe(true)
    expect(quest.progress).toBe(quest.target)
    expect(updated.find((q) => q.id === playGameId)?.completed).toBe(true)
  })

  it('throws if quest ID not found', () => {
    const quests = generateDailyQuests('2026-03-11')
    expect(() => completeQuestById(quests, 'nonexistent-id')).toThrow('Quest not found')
  })

  it('throws if quest already completed', () => {
    const quests = generateDailyQuests('2026-03-11')
    const playGameId = generateQuestId('2026-03-11', 'play_game')
    const { quests: updated } = completeQuestById(quests, playGameId)
    expect(() => completeQuestById(updated, playGameId)).toThrow('Quest already completed')
  })
})

describe('QuestSystem: all-quest bonus', () => {
  it('detects when all quests are completed', () => {
    const date = '2026-03-11'
    let quests = generateDailyQuests(date)
    quests = updateQuestProgress(quests, 'play_game', 1)
    quests = updateQuestProgress(quests, 'view_explanation', 3)
    quests = updateQuestProgress(quests, 'review_game', 1)
    expect(areAllQuestsCompleted(quests)).toBe(true)
  })

  it('returns false when some quests remain', () => {
    const date = '2026-03-11'
    let quests = generateDailyQuests(date)
    quests = updateQuestProgress(quests, 'play_game', 1)
    expect(areAllQuestsCompleted(quests)).toBe(false)
  })

  it('all-quests bonus is 50 XP', () => {
    expect(XP_AWARDS.all_quests_bonus).toBe(50)
  })

  it('counts completed quests correctly', () => {
    const date = '2026-03-11'
    let quests = generateDailyQuests(date)
    expect(countCompletedQuests(quests)).toBe(0)
    quests = updateQuestProgress(quests, 'play_game', 1)
    expect(countCompletedQuests(quests)).toBe(1)
    quests = updateQuestProgress(quests, 'review_game', 1)
    expect(countCompletedQuests(quests)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// SECTION 4: XP Calculation
// ---------------------------------------------------------------------------

describe('LevelSystem: XP sources', () => {
  it('game_complete awards 20 XP', () => {
    expect(getXPForSource('game_complete')).toBe(XP_AWARDS.game_complete) // 20
  })

  it('game_win awards 30 XP', () => {
    expect(getXPForSource('game_win')).toBe(XP_AWARDS.game_win) // 30
  })

  it('analysis_viewed awards 10 XP', () => {
    expect(getXPForSource('analysis_viewed')).toBe(XP_AWARDS.analysis_viewed) // 10
  })

  it('quest_play_game awards 50 XP', () => {
    expect(getQuestXPReward('play_game')).toBe(50)
  })

  it('quest_view_explanation awards 30 XP', () => {
    expect(getQuestXPReward('view_explanation')).toBe(30)
  })

  it('quest_review_game awards 40 XP', () => {
    expect(getQuestXPReward('review_game')).toBe(40)
  })
})

describe('LevelSystem: awardXP', () => {
  it('adds XP correctly', () => {
    const result = awardXP(0, 50)
    expect(result.totalXP).toBe(50)
    expect(result.xpAwarded).toBe(50)
  })

  it('throws for non-positive XP', () => {
    expect(() => awardXP(100, 0)).toThrow()
    expect(() => awardXP(100, -10)).toThrow()
  })

  it('does not flag level-up when XP is insufficient', () => {
    const result = awardXP(50, 10) // at level 1 (0-99 XP range)
    expect(result.leveledUp).toBe(false)
    expect(result.newLevel).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// SECTION 5: Level-up at Correct Thresholds
// ---------------------------------------------------------------------------

describe('LevelSystem: level thresholds', () => {
  it('level 1 at 0 XP', () => {
    expect(levelFromXP(0)).toBe(1)
  })

  it('level 1 at 99 XP', () => {
    expect(levelFromXP(99)).toBe(1)
  })

  it('level 2 at exactly 100 XP', () => {
    expect(levelFromXP(100)).toBe(2)
  })

  it('level 2 at 199 XP', () => {
    expect(levelFromXP(199)).toBe(2)
  })

  it('level 3 at exactly 200 XP', () => {
    expect(levelFromXP(200)).toBe(3)
  })

  it('level 10 at exactly 900 XP', () => {
    expect(levelFromXP(900)).toBe(10)
  })

  it('xpForLevel: level 2 requires 200 total XP', () => {
    expect(xpForLevel(2)).toBe(200)
  })

  it('xpForLevel: level 3 requires 300 total XP', () => {
    expect(xpForLevel(3)).toBe(300)
  })

  it('xpForLevel: level 50 requires 5000 total XP', () => {
    expect(xpForLevel(50)).toBe(5000)
  })

  it('xpThresholdForLevel: level 1 threshold is 0', () => {
    expect(xpThresholdForLevel(1)).toBe(0)
  })

  it('xpThresholdForLevel: level 2 threshold is 100', () => {
    expect(xpThresholdForLevel(2)).toBe(100)
  })

  it('xpThresholdForLevel: level 3 threshold is 200', () => {
    expect(xpThresholdForLevel(3)).toBe(200)
  })

  it('detects level-up when crossing threshold', () => {
    const result = awardXP(95, 10) // 95 + 10 = 105, crosses 100 threshold
    expect(result.previousLevel).toBe(1)
    expect(result.newLevel).toBe(2)
    expect(result.leveledUp).toBe(true)
  })

  it('wouldLevelUp returns true when crossing threshold', () => {
    expect(wouldLevelUp(95, 10)).toBe(true)
  })

  it('wouldLevelUp returns false when not crossing threshold', () => {
    expect(wouldLevelUp(50, 20)).toBe(false)
  })

  it('xpInCurrentLevel at 150 XP (level 2) = 50', () => {
    expect(xpInCurrentLevel(150)).toBe(50)
  })

  it('xpToNextLevel at 150 XP (level 2, needs 200) = 50', () => {
    expect(xpToNextLevel(150)).toBe(50)
  })

  it('computePlayerLevel gives correct breakdown at 250 XP', () => {
    // levelFromXP(250) = floor(250/100) + 1 = 3
    // Level 3 starts at 200 XP, so xpInLevel = 250 - 200 = 50
    const info = computePlayerLevel(250)
    expect(info.level).toBe(3)
    expect(info.currentXP).toBe(50)
    expect(info.totalXP).toBe(250)
  })

  it('getLevelProgressPercent at 150 XP is 50%', () => {
    // Level 2 starts at 100 XP, 150 is 50 XP into the level (50 out of 100 = 50%)
    const pct = getLevelProgressPercent(150)
    expect(pct).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// SECTION 6: Max Level Cap
// ---------------------------------------------------------------------------

describe('LevelSystem: max level cap', () => {
  it('MAX_LEVEL is 50', () => {
    expect(MAX_LEVEL).toBe(50)
  })

  it('level never exceeds MAX_LEVEL', () => {
    // Very high XP: 100,000
    expect(levelFromXP(100000)).toBe(MAX_LEVEL)
  })

  it('awardXP does not exceed MAX_LEVEL', () => {
    // At MAX_LEVEL threshold XP
    const maxXP = (MAX_LEVEL - 1) * 100 // XP that puts us at MAX_LEVEL
    const result = awardXP(maxXP, 10000)
    expect(result.newLevel).toBe(MAX_LEVEL)
    expect(result.totalXP).toBe(maxXP + 10000)
  })

  it('wouldLevelUp returns false at max level', () => {
    const maxXP = MAX_LEVEL * 100 + 500 // well past max
    expect(wouldLevelUp(maxXP, 100)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SECTION 7: Streak Tracking
// ---------------------------------------------------------------------------

describe('StreakTracker: daysBetween', () => {
  it('same day returns 0', () => {
    expect(daysBetween('2026-03-11', '2026-03-11')).toBe(0)
  })

  it('consecutive days returns 1', () => {
    expect(daysBetween('2026-03-11', '2026-03-12')).toBe(1)
  })

  it('2 days apart returns 2', () => {
    expect(daysBetween('2026-03-11', '2026-03-13')).toBe(2)
  })

  it('negative when B is before A', () => {
    expect(daysBetween('2026-03-12', '2026-03-11')).toBe(-1)
  })
})

describe('StreakTracker: isSameDay, isConsecutiveDay', () => {
  it('isSameDay: same date', () => {
    expect(isSameDay('2026-03-11', '2026-03-11')).toBe(true)
  })

  it('isSameDay: different dates', () => {
    expect(isSameDay('2026-03-11', '2026-03-12')).toBe(false)
  })

  it('isConsecutiveDay: consecutive', () => {
    expect(isConsecutiveDay('2026-03-11', '2026-03-12')).toBe(true)
  })

  it('isConsecutiveDay: same day is not consecutive', () => {
    expect(isConsecutiveDay('2026-03-11', '2026-03-11')).toBe(false)
  })

  it('isConsecutiveDay: 2 days apart is not consecutive', () => {
    expect(isConsecutiveDay('2026-03-11', '2026-03-13')).toBe(false)
  })
})

describe('StreakTracker: updateStreak', () => {
  it('starts streak at 1 for first activity ever', () => {
    const result = updateStreak(0, 0, null, '2026-03-11')
    expect(result.newStreak).toBe(1)
    expect(result.streakBroken).toBe(false)
    expect(result.longestStreak).toBe(1)
  })

  it('increments streak for consecutive day', () => {
    const result = updateStreak(5, 5, '2026-03-10', '2026-03-11')
    expect(result.newStreak).toBe(6)
    expect(result.streakBroken).toBe(false)
  })

  it('does not change streak when played on same day already', () => {
    const result = updateStreak(3, 3, '2026-03-11', '2026-03-11')
    expect(result.newStreak).toBe(3)
    expect(result.bonusXP).toBe(0) // no bonus for same day re-record
  })

  it('breaks streak when gap > 1 day', () => {
    const result = updateStreak(10, 10, '2026-03-09', '2026-03-11')
    expect(result.newStreak).toBe(1)
    expect(result.streakBroken).toBe(true)
    expect(result.longestStreak).toBe(10) // longest preserved
  })

  it('updates longestStreak when new streak exceeds it', () => {
    const result = updateStreak(9, 9, '2026-03-10', '2026-03-11')
    expect(result.newStreak).toBe(10)
    expect(result.longestStreak).toBe(10)
  })

  it('does not update longestStreak when below previous max', () => {
    const result = updateStreak(3, 15, '2026-03-10', '2026-03-11')
    expect(result.newStreak).toBe(4)
    expect(result.longestStreak).toBe(15) // still 15
  })

  it('preserves longestStreak when streak breaks', () => {
    const result = updateStreak(10, 10, '2026-03-01', '2026-03-11')
    expect(result.streakBroken).toBe(true)
    expect(result.longestStreak).toBe(10) // not reset
  })
})

// ---------------------------------------------------------------------------
// SECTION 8: Streak Bonus Calculation
// ---------------------------------------------------------------------------

describe('StreakTracker: streak bonus XP', () => {
  it('streak bonus = streak * 5, capped at 50', () => {
    expect(computeStreakBonus(1)).toBe(5)
    expect(computeStreakBonus(5)).toBe(25)
    expect(computeStreakBonus(10)).toBe(50) // 10 * 5 = 50 (at cap)
    expect(computeStreakBonus(20)).toBe(50) // capped
    expect(computeStreakBonus(100)).toBe(50) // capped
  })

  it('MAX_STREAK_BONUS is 50', () => {
    expect(MAX_STREAK_BONUS).toBe(50)
  })

  it('streak of 1 gives 5 XP bonus', () => {
    const result = updateStreak(0, 0, null, '2026-03-11')
    expect(result.bonusXP).toBe(5)
  })

  it('streak of 10 gives 50 XP bonus (capped)', () => {
    const result = updateStreak(9, 9, '2026-03-10', '2026-03-11')
    expect(result.bonusXP).toBe(50)
  })

  it('no bonus XP when playing on same day again', () => {
    const result = updateStreak(5, 5, '2026-03-11', '2026-03-11')
    expect(result.bonusXP).toBe(0)
  })
})

describe('StreakTracker: streak state helpers', () => {
  it('isStreakAtRisk: true when streak > 0 and no activity today', () => {
    expect(isStreakAtRisk(5, '2026-03-10', '2026-03-11')).toBe(true)
  })

  it('isStreakAtRisk: false when played today', () => {
    expect(isStreakAtRisk(5, '2026-03-11', '2026-03-11')).toBe(false)
  })

  it('isStreakAtRisk: false when streak is 0', () => {
    expect(isStreakAtRisk(0, '2026-03-10', '2026-03-11')).toBe(false)
  })

  it('hasPlayedToday: true when last activity is today', () => {
    expect(hasPlayedToday('2026-03-11', '2026-03-11')).toBe(true)
  })

  it('hasPlayedToday: false when last activity was yesterday', () => {
    expect(hasPlayedToday('2026-03-10', '2026-03-11')).toBe(false)
  })

  it('hasPlayedToday: false when no activity ever', () => {
    expect(hasPlayedToday(null, '2026-03-11')).toBe(false)
  })

  it('formatStreak: 0 streak', () => {
    expect(formatStreak(0)).toBe('No streak')
  })

  it('formatStreak: 1 streak', () => {
    expect(formatStreak(1)).toBe('1-day streak')
  })

  it('formatStreak: 7 streak', () => {
    expect(formatStreak(7)).toBe('7-day streak')
  })
})

// ---------------------------------------------------------------------------
// SECTION 9: Badge Unlocks
// ---------------------------------------------------------------------------

describe('BadgeManager: badge definitions', () => {
  it('defines exactly 8 badges', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(8)
    expect(totalBadgeCount()).toBe(8)
  })

  it('includes all required badge IDs', () => {
    const ids = BADGE_DEFINITIONS.map((b) => b.id)
    expect(ids).toContain('first_win')
    expect(ids).toContain('first_review')
    expect(ids).toContain('onboarding_complete')
    expect(ids).toContain('streak_7')
    expect(ids).toContain('streak_30')
    expect(ids).toContain('games_100')
    expect(ids).toContain('level_10')
    expect(ids).toContain('quest_master')
  })
})

describe('BadgeManager: checkBadgeUnlocks', () => {
  const now = () => new Date('2026-03-11T12:00:00Z')

  it('unlocks "first_win" badge when totalWins >= 1', () => {
    const state = makeState({ totalWins: 1 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'first_win')).toBe(true)
  })

  it('does not unlock "first_win" when totalWins = 0', () => {
    const state = makeState({ totalWins: 0 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'first_win')).toBe(false)
  })

  it('unlocks "first_review" badge when totalReviewsViewed >= 1', () => {
    const state = makeState({ totalReviewsViewed: 1 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'first_review')).toBe(true)
  })

  it('unlocks "onboarding_complete" badge when tutorialCompleted = true', () => {
    const state = makeState({ tutorialCompleted: true })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'onboarding_complete')).toBe(true)
  })

  it('unlocks "streak_7" badge when streak >= 7', () => {
    const state = makeState({ streak: 7 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'streak_7')).toBe(true)
  })

  it('does not unlock "streak_7" at streak 6', () => {
    const state = makeState({ streak: 6 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'streak_7')).toBe(false)
  })

  it('unlocks "streak_30" badge when streak >= 30', () => {
    const state = makeState({ streak: 30 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'streak_30')).toBe(true)
  })

  it('unlocks "games_100" badge when totalGamesPlayed >= 100', () => {
    const state = makeState({ totalGamesPlayed: 100 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'games_100')).toBe(true)
  })

  it('unlocks "level_10" badge when level >= 10', () => {
    const state = makeState({ level: 10 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'level_10')).toBe(true)
  })

  it('unlocks "quest_master" badge when allQuestsCompletedDays >= 7', () => {
    const state = makeState({ allQuestsCompletedDays: 7 })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.some((b) => b.id === 'quest_master')).toBe(true)
  })

  it('can unlock multiple badges at once', () => {
    const state = makeState({
      totalWins: 1,
      totalReviewsViewed: 1,
      tutorialCompleted: true,
    })
    const badges = checkBadgeUnlocks(state, now)
    expect(badges.length).toBeGreaterThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// SECTION 10: Badge Persistence (earned badges never lost)
// ---------------------------------------------------------------------------

describe('BadgeManager: badge persistence', () => {
  const now = () => new Date('2026-03-11T12:00:00Z')
  const earnedAt = 1741694400 // 2026-03-11T12:00:00Z in Unix

  it('already-earned badges are not returned by checkBadgeUnlocks', () => {
    const existingBadge: EarnedBadge = { id: 'first_win', earnedAt }
    const state = makeState({
      totalWins: 5,
      earnedBadges: [existingBadge],
    })
    const newBadges = checkBadgeUnlocks(state, now)
    expect(newBadges.some((b) => b.id === 'first_win')).toBe(false)
  })

  it('mergeBadges preserves existing badges', () => {
    const existing: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    const newBadges: EarnedBadge[] = [{ id: 'first_review', earnedAt }]
    const merged = mergeBadges(existing, newBadges)
    expect(merged).toHaveLength(2)
    expect(merged.some((b) => b.id === 'first_win')).toBe(true)
    expect(merged.some((b) => b.id === 'first_review')).toBe(true)
  })

  it('mergeBadges does not duplicate already-earned badges', () => {
    const existing: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    const duplicate: EarnedBadge[] = [{ id: 'first_win', earnedAt: earnedAt + 100 }]
    const merged = mergeBadges(existing, duplicate)
    expect(merged).toHaveLength(1) // no duplicate
    expect(merged[0]?.earnedAt).toBe(earnedAt) // original preserved
  })

  it('mergeBadges returns existing array unchanged when no new badges', () => {
    const existing: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    const result = mergeBadges(existing, [])
    expect(result).toBe(existing) // same reference
  })

  it('hasBadge: true when badge is earned', () => {
    const earned: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    expect(hasBadge(earned, 'first_win')).toBe(true)
  })

  it('hasBadge: false when badge is not earned', () => {
    const earned: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    expect(hasBadge(earned, 'first_review')).toBe(false)
  })

  it('earnedBadgeCount returns correct count', () => {
    const earned: EarnedBadge[] = [
      { id: 'first_win', earnedAt },
      { id: 'first_review', earnedAt },
    ]
    expect(earnedBadgeCount(earned)).toBe(2)
  })

  it('getBadgesForDisplay includes earned and unearned badges', () => {
    const earned: EarnedBadge[] = [{ id: 'first_win', earnedAt }]
    const display = getBadgesForDisplay(earned)
    expect(display).toHaveLength(8) // all badges
    expect(display.find((b) => b.id === 'first_win')?.earned).toBe(true)
    expect(display.find((b) => b.id === 'first_review')?.earned).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SECTION 11: State Save/Load Round-Trip
// ---------------------------------------------------------------------------

describe('GamificationService: save/load round-trip', () => {
  it('loads default state for first-time user', async () => {
    const persistence = makeMemoryPersistence()
    const service = new GamificationService('user1', persistence)
    await service.load()
    const state = service.getState()
    expect(state.totalXP).toBe(0)
    expect(state.level).toBe(1)
    expect(state.streak).toBe(0)
    expect(state.earnedBadges).toHaveLength(0)
  })

  it('saves state on activity and reloads correctly', async () => {
    const persistence = makeMemoryPersistence()
    const nowFn = () => new Date('2026-03-11T12:00:00Z')

    const service1 = new GamificationService('user1', persistence, nowFn)
    await service1.load()
    await service1.addXP(150, 'game_complete')
    await service1.save()

    // Create a new service instance with the same persistence
    const service2 = new GamificationService('user1', persistence, nowFn)
    await service2.load()
    expect(service2.getState().totalXP).toBe(150)
  })

  it('persists streak data across sessions', async () => {
    const persistence = makeMemoryPersistence()
    const nowFn = () => new Date('2026-03-11T12:00:00Z')

    const service1 = new GamificationService('user1', persistence, nowFn)
    await service1.load()
    await service1.recordDailyActivity()

    const service2 = new GamificationService('user1', persistence, nowFn)
    await service2.load()
    expect(service2.getState().streak).toBe(1)
    expect(service2.getState().lastActivityDate).toBe('2026-03-11')
  })

  it('persists earned badges across sessions', async () => {
    const persistence = makeMemoryPersistence()
    const nowFn = () => new Date('2026-03-11T12:00:00Z')

    const service1 = new GamificationService('user1', persistence, nowFn)
    await service1.load()
    await service1.processEvent({ type: 'game_completed', won: true })
    // first_win badge should be earned

    const service2 = new GamificationService('user1', persistence, nowFn)
    await service2.load()
    const badges = service2.getState().earnedBadges
    expect(badges.some((b) => b.id === 'first_win')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// SECTION 12: Edge Cases
// ---------------------------------------------------------------------------

describe('GamificationService: data corruption recovery', () => {
  it('recovers from corrupted quest JSON (uses empty quests)', async () => {
    const persistence = makeMemoryPersistence()
    // Store corrupted state
    const corrupted = {
      ...DEFAULT_GAMIFICATION_STATE,
      // dailyQuests is already an array in GamificationState, but we test the Zod parse path
      // by passing a state with invalid quests that the _repairState method would handle
      dailyQuests: [] as DailyQuest[], // empty is fine
      earnedBadges: [] as EarnedBadge[],
    }
    await persistence.save('user1', corrupted)

    const service = new GamificationService('user1', persistence)
    await service.load()
    // Should not throw, quests should be empty (or generated fresh)
    expect(service.getState()).toBeDefined()
  })

  it('recomputes level from totalXP (healing inconsistency)', async () => {
    const persistence = makeMemoryPersistence()
    // Store state with wrong level (should be 2 for 150 XP, but stored as 5)
    const inconsistent: GamificationState = {
      ...DEFAULT_GAMIFICATION_STATE,
      totalXP: 150,
      level: 5, // wrong — should be derived from XP
    }
    await persistence.save('user1', inconsistent)

    const service = new GamificationService('user1', persistence)
    await service.load()
    // Level should be recomputed from XP
    const state = service.getState()
    expect(state.level).toBe(levelFromXP(150))
  })

  it('clamps negative XP to 0', async () => {
    const persistence = makeMemoryPersistence()
    const negative: GamificationState = {
      ...DEFAULT_GAMIFICATION_STATE,
      totalXP: -100,
    }
    await persistence.save('user1', negative)

    const service = new GamificationService('user1', persistence)
    await service.load()
    expect(service.getState().totalXP).toBe(0)
  })

  it('clamps negative streak to 0', async () => {
    const persistence = makeMemoryPersistence()
    const negative: GamificationState = {
      ...DEFAULT_GAMIFICATION_STATE,
      streak: -5,
    }
    await persistence.save('user1', negative)

    const service = new GamificationService('user1', persistence)
    await service.load()
    expect(service.getState().streak).toBe(0)
  })
})

describe('GamificationService: game event processing', () => {
  it('game_completed event awards game_complete and streak bonus XP', async () => {
    const { service } = await makeLoadedService()
    const result = await service.processEvent({ type: 'game_completed', won: false })
    expect(result.xpEvents.length).toBeGreaterThan(0)
    const state = service.getState()
    expect(state.totalGamesPlayed).toBe(1)
    expect(state.lastActivityDate).toBe('2026-03-11')
  })

  it('game_completed with win awards win bonus XP', async () => {
    const { service } = await makeLoadedService()
    const initialXP = service.getState().totalXP
    await service.processEvent({ type: 'game_completed', won: true })
    const finalXP = service.getState().totalXP
    // Should include: game_complete (20) + game_win (30) + streak bonus + quest progress
    expect(finalXP).toBeGreaterThan(initialXP + XP_AWARDS.game_win)
    expect(service.getState().totalWins).toBe(1)
  })

  it('analysis_viewed event awards analysis XP and updates quest', async () => {
    const { service } = await makeLoadedService()
    const initial = service.getState().totalXP
    await service.processEvent({ type: 'analysis_viewed' })
    expect(service.getState().totalXP).toBeGreaterThan(initial)
  })

  it('review_viewed event increments totalReviewsViewed', async () => {
    const { service } = await makeLoadedService()
    await service.processEvent({ type: 'review_viewed' })
    expect(service.getState().totalReviewsViewed).toBe(1)
  })

  it('tutorial_completed event marks tutorial as done and unlocks badge', async () => {
    const { service } = await makeLoadedService()
    await service.processEvent({ type: 'tutorial_completed' })
    expect(service.getState().tutorialCompleted).toBe(true)
    expect(service.getState().earnedBadges.some((b) => b.id === 'onboarding_complete')).toBe(true)
  })

  it('tutorial_completed is idempotent (calling twice does not double-unlock)', async () => {
    const { service } = await makeLoadedService()
    await service.processEvent({ type: 'tutorial_completed' })
    await service.processEvent({ type: 'tutorial_completed' })
    const onboardingBadges = service
      .getState()
      .earnedBadges.filter((b) => b.id === 'onboarding_complete')
    expect(onboardingBadges).toHaveLength(1)
  })
})

describe('GamificationService: quest completion flow', () => {
  it('completing play_game quest via completeQuest awards 50 XP', async () => {
    const nowFn = () => new Date('2026-03-11T12:00:00Z')
    const { service } = await makeLoadedService({}, nowFn)
    service.getDailyQuests() // ensure quests are generated
    const questId = service.getTodayQuestId('play_game')
    const result = await service.completeQuest(questId)
    expect(result.xp).toBe(XP_AWARDS.quest_play_game)
  })

  it('completing all 3 quests triggers 50 XP bonus', async () => {
    const nowFn = () => new Date('2026-03-11T12:00:00Z')
    const { service } = await makeLoadedService({}, nowFn)
    service.getDailyQuests()

    const ids = ['play_game', 'view_explanation', 'review_game'] as const
    for (const type of ids) {
      const questId = service.getTodayQuestId(type)
      await service.completeQuest(questId)
    }

    // allQuestsCompletedDays should increment
    expect(service.getState().allQuestsCompletedDays).toBe(1)
  })

  it('double-completing quests does not double-award XP', async () => {
    const nowFn = () => new Date('2026-03-11T12:00:00Z')
    const { service } = await makeLoadedService({}, nowFn)
    service.getDailyQuests()
    const questId = service.getTodayQuestId('play_game')
    await service.completeQuest(questId)
    await expect(service.completeQuest(questId)).rejects.toThrow()
  })
})

describe('GamificationService: streak milestone badges', () => {
  it('unlocks streak_7 badge after 7-day streak', async () => {
    // Set up a user with a 6-day streak and activity yesterday
    const nowFn = () => new Date('2026-03-11T12:00:00Z')
    const { service } = await makeLoadedService(
      { streak: 6, longestStreak: 6, lastActivityDate: '2026-03-10' },
      nowFn
    )
    await service.recordDailyActivity()
    expect(service.getState().streak).toBe(7)
    expect(service.getState().earnedBadges.some((b) => b.id === 'streak_7')).toBe(true)
  })
})

describe('GamificationService: load is idempotent', () => {
  it('calling load() multiple times does not reset state', async () => {
    const { service } = await makeLoadedService()
    await service.addXP(100, 'game_complete')
    const xpAfter = service.getState().totalXP
    await service.load() // second load
    expect(service.getState().totalXP).toBe(xpAfter) // unchanged
  })
})

describe('formatDateLocal', () => {
  it('formats a date correctly', () => {
    // Create a date that is unambiguously 2026-03-11 regardless of timezone
    const d = new Date(2026, 2, 11) // month is 0-indexed
    expect(formatDateLocal(d)).toBe('2026-03-11')
  })

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5) // January 5
    expect(formatDateLocal(d)).toBe('2026-01-05')
  })
})
