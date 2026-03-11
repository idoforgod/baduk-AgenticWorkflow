// =============================================================================
// features/gamification/index.ts — Barrel Exports
// =============================================================================

// Badge Manager
export {
  checkBadgeUnlocks,
  earnedBadgeCount,
  getBadgesForDisplay,
  hasBadge,
  mergeBadges,
  totalBadgeCount,
} from './BadgeManager'
// Service
export { GamificationService } from './GamificationService'
// Store
export type {
  GamificationStore,
  GamificationStoreActions,
  GamificationStoreState,
} from './GamificationStore'
export { configureGamificationStore, useGamificationStore } from './GamificationStore'
// Level System
export {
  awardXP,
  computePlayerLevel,
  formatLevel,
  getLevelProgressPercent,
  getXPForSource,
  wouldLevelUp,
  xpThresholdForLevel,
} from './LevelSystem'
// Quest System
export {
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
export {
  daysBetween,
  formatStreak,
  hasPlayedToday,
  isConsecutiveDay,
  isSameDay,
  isStreakAtRisk,
  updateStreak,
} from './StreakTracker'
// Types
export type {
  BadgeId,
  DailyQuest,
  DailyQuestType,
  EarnedBadge,
  GameEventResult,
  GamificationEvent,
  GamificationState,
  IGamificationPersistence,
  StreakState,
  StreakUpdateResult,
  XPAwardResult,
  XPSource,
} from './types'
export {
  BADGE_DEFINITIONS,
  computeStreakBonus,
  DailyQuestArraySchema,
  DailyQuestSchema,
  DEFAULT_GAMIFICATION_STATE,
  EarnedBadgeArraySchema,
  EarnedBadgeSchema,
  getStreakState,
  levelFromXP,
  MAX_LEVEL,
  MAX_STREAK_BONUS,
  STREAK_BONUS_PER_DAY,
  XP_AWARDS,
  xpForLevel,
  xpInCurrentLevel,
  xpToNextLevel,
} from './types'
