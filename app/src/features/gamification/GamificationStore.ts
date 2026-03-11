// =============================================================================
// features/gamification/GamificationStore.ts — Zustand Store Wrapper
// =============================================================================
// Wraps GamificationService in a reactive Zustand store for UI consumption.
// Follows the same DI pattern as QuickGoStore.ts.
//
// Usage:
//   const quests = useGamificationStore(s => s.quests)
//   const processEvent = useGamificationStore(s => s.processEvent)
// =============================================================================

import { create } from 'zustand'
import type { GamificationService } from './GamificationService'
import type { DailyQuest, EarnedBadge, GamificationEvent, GamificationState } from './types'
import {
  DEFAULT_GAMIFICATION_STATE,
  levelFromXP,
  MAX_LEVEL,
  xpInCurrentLevel,
  xpToNextLevel,
} from './types'

// ---------------------------------------------------------------------------
// Store State Shape
// ---------------------------------------------------------------------------

/** Reactive state exposed to UI components */
export interface GamificationStoreState {
  /** Whether the service has been loaded from persistence */
  isLoaded: boolean
  /** Current level (1-50) */
  level: number
  /** Total XP */
  totalXP: number
  /** XP within current level */
  xpInLevel: number
  /** XP needed to reach next level */
  xpToNext: number
  /** Current streak */
  streak: number
  /** Longest streak ever */
  longestStreak: number
  /** Last activity date (YYYY-MM-DD) or null */
  lastActivityDate: string | null
  /** Today's daily quests */
  quests: readonly DailyQuest[]
  /** All earned badges */
  earnedBadges: readonly EarnedBadge[]
  /** Total games played */
  totalGamesPlayed: number
  /** Total wins */
  totalWins: number
  /** Whether a level-up just occurred (for notification) */
  recentLevelUp: boolean
  /** Newly unlocked badges since last clear */
  recentBadges: readonly EarnedBadge[]
}

/** Actions exposed to UI components */
export interface GamificationStoreActions {
  /** Initialize: load state from persistence */
  initialize(): Promise<void>
  /** Process a game event and update all state */
  processEvent(event: GamificationEvent): Promise<void>
  /** Update quest progress directly */
  updateQuestProgress(
    questType: 'play_game' | 'view_explanation' | 'review_game',
    amount?: number
  ): Promise<void>
  /** Clear the "recent level up" notification flag */
  clearLevelUpNotification(): void
  /** Clear the "recent badges" notification list */
  clearRecentBadges(): void
  /** Refresh quests (e.g., after midnight) */
  refreshQuests(): void
}

export type GamificationStore = GamificationStoreState & GamificationStoreActions

// ---------------------------------------------------------------------------
// Module-level service reference (injected at boot)
// ---------------------------------------------------------------------------

let _service: GamificationService | null = null

/**
 * Configure the gamification store with its service dependency.
 * Must be called once at app startup after creating the GamificationService.
 */
export function configureGamificationStore(service: GamificationService): void {
  _service = service
}

function getService(): GamificationService {
  if (_service === null) {
    throw new Error(
      'GamificationStore: service not configured. Call configureGamificationStore() first.'
    )
  }
  return _service
}

// ---------------------------------------------------------------------------
// State mapping helper
// ---------------------------------------------------------------------------

function stateFromService(
  service: GamificationService
): Omit<GamificationStoreState, 'isLoaded' | 'recentLevelUp' | 'recentBadges'> {
  const s = service.getState()
  const isMax = s.level >= MAX_LEVEL

  return {
    level: s.level,
    totalXP: s.totalXP,
    xpInLevel: isMax ? s.totalXP : xpInCurrentLevel(s.totalXP),
    xpToNext: isMax ? 0 : xpToNextLevel(s.totalXP),
    streak: s.streak,
    longestStreak: s.longestStreak,
    lastActivityDate: s.lastActivityDate,
    quests: service.getDailyQuests(),
    earnedBadges: s.earnedBadges,
    totalGamesPlayed: s.totalGamesPlayed,
    totalWins: s.totalWins,
  }
}

function initialStoreState(): GamificationStoreState {
  const s: GamificationState = DEFAULT_GAMIFICATION_STATE
  return {
    isLoaded: false,
    level: s.level,
    totalXP: s.totalXP,
    xpInLevel: 0,
    xpToNext: levelFromXP(1) * 100,
    streak: s.streak,
    longestStreak: s.longestStreak,
    lastActivityDate: s.lastActivityDate,
    quests: [],
    earnedBadges: [],
    totalGamesPlayed: s.totalGamesPlayed,
    totalWins: s.totalWins,
    recentLevelUp: false,
    recentBadges: [],
  }
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const useGamificationStore = create<GamificationStore>()((set) => ({
  ...initialStoreState(),

  async initialize() {
    const service = getService()
    await service.load()
    const mapped = stateFromService(service)
    set({ ...mapped, isLoaded: true })
  },

  async processEvent(event) {
    const service = getService()
    const result = await service.processEvent(event)
    const mapped = stateFromService(service)

    const leveledUp = result.xpEvents.some((e) => e.leveledUp)
    const newBadges = result.newBadges

    set((prev) => ({
      ...mapped,
      recentLevelUp: prev.recentLevelUp || leveledUp,
      recentBadges: [...prev.recentBadges, ...newBadges],
    }))
  },

  async updateQuestProgress(questType, amount = 1) {
    const service = getService()
    const xpEvents = await service.updateQuestProgress(questType, amount)
    const mapped = stateFromService(service)
    const leveledUp = xpEvents.some((e) => e.leveledUp)

    set((prev) => ({
      ...mapped,
      recentLevelUp: prev.recentLevelUp || leveledUp,
    }))
  },

  clearLevelUpNotification() {
    set({ recentLevelUp: false })
  },

  clearRecentBadges() {
    set({ recentBadges: [] })
  },

  refreshQuests() {
    const service = getService()
    const quests = service.getDailyQuests()
    set({ quests })
  },
}))
