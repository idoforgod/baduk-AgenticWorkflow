// =============================================================================
// features/gamification/GamificationService.ts — Unified Gamification Facade
// =============================================================================
// Orchestrates QuestSystem, LevelSystem, StreakTracker, and BadgeManager
// into a single cohesive service that implements IGamificationService.
//
// Design:
//   - In-memory state with explicit load/save lifecycle.
//   - DI via IGamificationPersistence (mockable in tests).
//   - All mutations produce new state objects (immutable).
//   - nowFn injectable for deterministic testing.
// =============================================================================

import { checkBadgeUnlocks, getBadgesForDisplay, mergeBadges } from './BadgeManager'
import { awardXP } from './LevelSystem'
import {
  areAllQuestsCompleted,
  completeQuestById,
  formatDateLocal,
  generateQuestId,
  getOrCreateDailyQuests,
  updateQuestProgress,
} from './QuestSystem'
import { updateStreak } from './StreakTracker'
import type {
  DailyQuest,
  DailyQuestType,
  EarnedBadge,
  GameEventResult,
  GamificationEvent,
  GamificationState,
  IGamificationPersistence,
  StreakUpdateResult,
  XPAwardResult,
  XPSource,
} from './types'
import {
  DailyQuestArraySchema,
  DEFAULT_GAMIFICATION_STATE,
  EarnedBadgeArraySchema,
  levelFromXP,
  MAX_LEVEL,
  XP_AWARDS,
} from './types'

// ---------------------------------------------------------------------------
// GamificationService Class
// ---------------------------------------------------------------------------

export class GamificationService {
  private _state: GamificationState
  private _userId: string
  private readonly _persistence: IGamificationPersistence
  private readonly _nowFn: () => Date
  private _loaded = false

  constructor(
    userId: string,
    persistence: IGamificationPersistence,
    nowFn: () => Date = () => new Date()
  ) {
    this._userId = userId
    this._persistence = persistence
    this._nowFn = nowFn
    this._state = { ...DEFAULT_GAMIFICATION_STATE }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Load state from persistence.
   * Must be called before any other methods.
   * Safe to call multiple times (idempotent after first call).
   */
  async load(): Promise<void> {
    if (this._loaded) return

    const stored = await this._persistence.load(this._userId)
    if (stored !== null) {
      // Validate and repair stored data
      this._state = this._repairState(stored)
    } else {
      this._state = { ...DEFAULT_GAMIFICATION_STATE }
    }
    this._loaded = true
  }

  /**
   * Save current state to persistence.
   */
  async save(): Promise<void> {
    await this._persistence.save(this._userId, this._state)
  }

  /**
   * Get the current in-memory state (for testing and store access).
   */
  getState(): GamificationState {
    return this._state
  }

  // ---------------------------------------------------------------------------
  // Daily Quests
  // ---------------------------------------------------------------------------

  /**
   * Get today's daily quests, generating new ones if needed.
   * Automatically resets quests if the day has changed.
   */
  getDailyQuests(): readonly DailyQuest[] {
    const quests = getOrCreateDailyQuests(this._state.dailyQuests, this._nowFn)
    // If new quests were generated (day changed), update state
    const firstQuest = quests[0]
    const storedFirst = this._state.dailyQuests[0]
    if (firstQuest !== undefined && storedFirst?.date !== firstQuest.date) {
      this._state = { ...this._state, dailyQuests: quests }
    }
    return quests
  }

  /**
   * Update progress on a quest type (e.g., after playing a game).
   * Automatically detects quest completion and applies XP.
   * Returns XP events triggered by the progress update.
   */
  async updateQuestProgress(
    type: DailyQuestType,
    incrementBy = 1
  ): Promise<readonly XPAwardResult[]> {
    const quests = this.getDailyQuests()
    const updatedQuests = updateQuestProgress(quests, type, incrementBy)

    // Find newly completed quests
    const xpEvents: XPAwardResult[] = []
    for (let i = 0; i < updatedQuests.length; i++) {
      const updated = updatedQuests[i]
      const previous = quests[i]
      if (updated === undefined || previous === undefined) continue
      if (updated.completed && !previous.completed) {
        // Quest just completed — award quest XP
        const result = awardXP(this._state.totalXP, updated.xpReward)
        this._state = {
          ...this._state,
          totalXP: result.totalXP,
          level: result.newLevel,
        }
        xpEvents.push(result)
      }
    }

    // Check if all quests are now complete (bonus XP)
    const previouslyAllDone = areAllQuestsCompleted(quests)
    const nowAllDone = areAllQuestsCompleted(updatedQuests)
    if (nowAllDone && !previouslyAllDone) {
      const bonusResult = awardXP(this._state.totalXP, XP_AWARDS.all_quests_bonus)
      this._state = {
        ...this._state,
        totalXP: bonusResult.totalXP,
        level: bonusResult.newLevel,
        allQuestsCompletedDays: this._state.allQuestsCompletedDays + 1,
      }
      xpEvents.push(bonusResult)
    }

    this._state = { ...this._state, dailyQuests: updatedQuests }

    // Check for new badge unlocks
    const newBadges = checkBadgeUnlocks(this._state, this._nowFn)
    if (newBadges.length > 0) {
      this._state = {
        ...this._state,
        earnedBadges: mergeBadges(this._state.earnedBadges, newBadges),
      }
    }

    await this.save()
    return xpEvents
  }

  /**
   * Manually complete a quest by ID (for testing and direct completion).
   * Returns the XP reward.
   */
  async completeQuest(questId: string): Promise<{ xp: number; badgeId?: string }> {
    const quests = this.getDailyQuests()
    const { quests: updatedQuests, quest: completedQuest } = completeQuestById(quests, questId)

    const result = awardXP(this._state.totalXP, completedQuest.xpReward)
    this._state = {
      ...this._state,
      totalXP: result.totalXP,
      level: result.newLevel,
      dailyQuests: updatedQuests,
    }

    // Check all quests bonus
    if (areAllQuestsCompleted(updatedQuests)) {
      const prevAllDone = areAllQuestsCompleted(quests)
      if (!prevAllDone) {
        const bonusResult = awardXP(this._state.totalXP, XP_AWARDS.all_quests_bonus)
        this._state = {
          ...this._state,
          totalXP: bonusResult.totalXP,
          level: bonusResult.newLevel,
          allQuestsCompletedDays: this._state.allQuestsCompletedDays + 1,
        }
      }
    }

    // Check badge unlocks
    const newBadges = checkBadgeUnlocks(this._state, this._nowFn)
    if (newBadges.length > 0) {
      this._state = {
        ...this._state,
        earnedBadges: mergeBadges(this._state.earnedBadges, newBadges),
      }
    }

    await this.save()
    return { xp: completedQuest.xpReward }
  }

  // ---------------------------------------------------------------------------
  // XP & Levels
  // ---------------------------------------------------------------------------

  /**
   * Award XP from a specific source.
   * Returns the XP award result (includes level-up info).
   */
  async addXP(amount: number, _source: XPSource): Promise<XPAwardResult> {
    if (amount <= 0) {
      throw new Error(`Invalid XP amount: ${amount}. Must be positive.`)
    }

    const result = awardXP(this._state.totalXP, amount)
    this._state = {
      ...this._state,
      totalXP: result.totalXP,
      level: result.newLevel,
    }

    // Check badge unlocks (level_10 badge)
    const newBadges = checkBadgeUnlocks(this._state, this._nowFn)
    if (newBadges.length > 0) {
      this._state = {
        ...this._state,
        earnedBadges: mergeBadges(this._state.earnedBadges, newBadges),
      }
    }

    await this.save()
    return result
  }

  // ---------------------------------------------------------------------------
  // Streak
  // ---------------------------------------------------------------------------

  /**
   * Record daily activity for streak tracking.
   * Called when the player plays a game.
   * Returns the streak update result.
   */
  async recordDailyActivity(): Promise<StreakUpdateResult> {
    const today = formatDateLocal(this._nowFn())
    const streakResult = updateStreak(
      this._state.streak,
      this._state.longestStreak,
      this._state.lastActivityDate,
      today
    )

    // Only update if state actually changed (prevents double-counting same day)
    const alreadyPlayedToday = this._state.lastActivityDate === today
    if (alreadyPlayedToday) {
      return streakResult
    }

    this._state = {
      ...this._state,
      streak: streakResult.newStreak,
      longestStreak: streakResult.longestStreak,
      lastActivityDate: today,
    }

    // Award streak bonus XP if applicable
    if (streakResult.bonusXP > 0) {
      const xpResult = awardXP(this._state.totalXP, streakResult.bonusXP)
      this._state = {
        ...this._state,
        totalXP: xpResult.totalXP,
        level: xpResult.newLevel,
      }
    }

    // Check badge unlocks (streak_7, streak_30)
    const newBadges = checkBadgeUnlocks(this._state, this._nowFn)
    if (newBadges.length > 0) {
      this._state = {
        ...this._state,
        earnedBadges: mergeBadges(this._state.earnedBadges, newBadges),
      }
    }

    await this.save()
    return streakResult
  }

  // ---------------------------------------------------------------------------
  // Game Events
  // ---------------------------------------------------------------------------

  /**
   * Process a game event and apply all relevant gamification updates.
   * This is the main entry point for game-triggered gamification.
   */
  async processEvent(event: GamificationEvent): Promise<GameEventResult> {
    const xpEvents: XPAwardResult[] = []
    let newBadges: EarnedBadge[] = []
    let questUpdates: readonly DailyQuest[] = this._state.dailyQuests
    let streakUpdate: StreakUpdateResult | null = null

    switch (event.type) {
      case 'game_completed': {
        // 1. Record daily activity (streak)
        streakUpdate = await this.recordDailyActivity()
        // 2. Award game completion XP
        const gameXP = await this.addXP(XP_AWARDS.game_complete, 'game_complete')
        xpEvents.push(gameXP)
        // 3. Award win bonus if applicable
        if (event.won) {
          this._state = {
            ...this._state,
            totalWins: this._state.totalWins + 1,
          }
          const winXP = await this.addXP(XP_AWARDS.game_win, 'game_win')
          xpEvents.push(winXP)
        }
        // 4. Increment total games
        this._state = {
          ...this._state,
          totalGamesPlayed: this._state.totalGamesPlayed + 1,
        }
        // 5. Update quest progress for 'play_game'
        const questXPEvents = await this.updateQuestProgress('play_game', 1)
        xpEvents.push(...questXPEvents)
        questUpdates = this._state.dailyQuests
        break
      }

      case 'analysis_viewed': {
        const analysisXP = await this.addXP(XP_AWARDS.analysis_viewed, 'analysis_viewed')
        xpEvents.push(analysisXP)
        // Update 'view_explanation' quest
        const questXPEvents = await this.updateQuestProgress('view_explanation', 1)
        xpEvents.push(...questXPEvents)
        questUpdates = this._state.dailyQuests
        break
      }

      case 'review_viewed': {
        this._state = {
          ...this._state,
          totalReviewsViewed: this._state.totalReviewsViewed + 1,
        }
        // Update 'review_game' quest
        const questXPEvents = await this.updateQuestProgress('review_game', 1)
        xpEvents.push(...questXPEvents)
        questUpdates = this._state.dailyQuests
        break
      }

      case 'tutorial_completed': {
        if (!this._state.tutorialCompleted) {
          this._state = {
            ...this._state,
            tutorialCompleted: true,
          }
          // Check for onboarding_complete badge
          const unlocked = checkBadgeUnlocks(this._state, this._nowFn)
          if (unlocked.length > 0) {
            this._state = {
              ...this._state,
              earnedBadges: mergeBadges(this._state.earnedBadges, unlocked),
            }
            newBadges = [...unlocked]
          }
          await this.save()
        }
        break
      }

      case 'quest_progress': {
        const questXPEvents = await this.updateQuestProgress(event.questType, event.amount)
        xpEvents.push(...questXPEvents)
        questUpdates = this._state.dailyQuests
        break
      }
    }

    // Collect all new badges from this event processing
    const allNewBadges = [
      ...newBadges,
      // Additional badges may have been set by sub-calls — compare against initial
    ]

    return {
      xpEvents,
      newBadges: allNewBadges,
      questUpdates,
      streakUpdate,
    }
  }

  // ---------------------------------------------------------------------------
  // Badges
  // ---------------------------------------------------------------------------

  /**
   * Get all badges with their earned/unearned status for display.
   */
  getBadges() {
    return getBadgesForDisplay(this._state.earnedBadges)
  }

  // ---------------------------------------------------------------------------
  // State Repair (corruption recovery)
  // ---------------------------------------------------------------------------

  /**
   * Repair a potentially corrupted state by:
   * 1. Validating and re-parsing JSON fields.
   * 2. Clamping values to valid ranges.
   * 3. Recomputing derived fields (level from XP).
   */
  private _repairState(raw: GamificationState): GamificationState {
    // Re-validate quest array (may be corrupted from partial writes)
    let dailyQuests: readonly DailyQuest[]
    try {
      const parsed = DailyQuestArraySchema.safeParse(raw.dailyQuests)
      dailyQuests = parsed.success ? parsed.data : []
    } catch {
      dailyQuests = []
    }

    // Re-validate badge array
    let earnedBadges: readonly EarnedBadge[]
    try {
      const parsed = EarnedBadgeArraySchema.safeParse(raw.earnedBadges)
      earnedBadges = parsed.success ? parsed.data : []
    } catch {
      earnedBadges = []
    }

    // Recompute level from totalXP (authoritative)
    const totalXP = Math.max(0, raw.totalXP ?? 0)
    const level = levelFromXP(totalXP)

    return {
      totalXP,
      level,
      streak: Math.max(0, raw.streak ?? 0),
      longestStreak: Math.max(0, raw.longestStreak ?? 0),
      lastActivityDate: raw.lastActivityDate ?? null,
      dailyQuests,
      earnedBadges,
      totalGamesPlayed: Math.max(0, raw.totalGamesPlayed ?? 0),
      totalWins: Math.max(0, raw.totalWins ?? 0),
      totalReviewsViewed: Math.max(0, raw.totalReviewsViewed ?? 0),
      allQuestsCompletedDays: Math.max(0, raw.allQuestsCompletedDays ?? 0),
      tutorialCompleted: raw.tutorialCompleted ?? false,
    }
  }

  // ---------------------------------------------------------------------------
  // Quest ID helpers (for tests)
  // ---------------------------------------------------------------------------

  /**
   * Get the quest ID for a given type on today's date.
   */
  getTodayQuestId(type: DailyQuestType): string {
    const today = formatDateLocal(this._nowFn())
    return generateQuestId(today, type)
  }

  /**
   * Get the current level (capped at MAX_LEVEL).
   */
  getLevel(): number {
    return Math.min(this._state.level, MAX_LEVEL)
  }
}
