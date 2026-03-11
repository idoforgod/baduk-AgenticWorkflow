// =============================================================================
// features/gamification/QuestSystem.ts — Daily Quest System
// =============================================================================
// Handles daily quest generation, progress tracking, completion, and reset.
// Pure logic — no I/O, no React dependencies.
// =============================================================================

import type { DailyQuest, DailyQuestType } from './types'
import { XP_AWARDS } from './types'

// ---------------------------------------------------------------------------
// Quest Definitions (static metadata per quest type)
// ---------------------------------------------------------------------------

interface QuestTemplate {
  readonly type: DailyQuestType
  readonly title: string
  readonly description: string
  readonly target: number
  readonly xpReward: number
}

const QUEST_TEMPLATES: readonly QuestTemplate[] = [
  {
    type: 'play_game',
    title: 'Quick Game',
    description: 'Play 1 Quick Go game',
    target: 1,
    xpReward: XP_AWARDS.quest_play_game,
  },
  {
    type: 'view_explanation',
    title: 'Learn from AI',
    description: 'View 3 AI explanations',
    target: 3,
    xpReward: XP_AWARDS.quest_view_explanation,
  },
  {
    type: 'review_game',
    title: 'Game Review',
    description: 'Review 1 completed game',
    target: 1,
    xpReward: XP_AWARDS.quest_review_game,
  },
] as const

// ---------------------------------------------------------------------------
// Quest ID Generation
// ---------------------------------------------------------------------------

/**
 * Generate a stable quest ID for a given date and type.
 * The ID is deterministic so the same quest can be referenced consistently.
 */
export function generateQuestId(date: string, type: DailyQuestType): string {
  return `quest-${date}-${type}`
}

// ---------------------------------------------------------------------------
// Quest Generation
// ---------------------------------------------------------------------------

/**
 * Generate the 3 daily quests for a given date.
 * Returns a fresh set of quests with zero progress.
 * The same date always produces the same quests (deterministic).
 */
export function generateDailyQuests(date: string): readonly DailyQuest[] {
  return QUEST_TEMPLATES.map((template) => ({
    id: generateQuestId(date, template.type),
    type: template.type,
    title: template.title,
    description: template.description,
    target: template.target,
    progress: 0,
    completed: false,
    date,
    xpReward: template.xpReward,
  }))
}

// ---------------------------------------------------------------------------
// Quest Progress
// ---------------------------------------------------------------------------

/**
 * Update progress on a specific quest type.
 * Returns a new array with the updated quest (immutable).
 * If the quest is already completed, it is not changed.
 */
export function updateQuestProgress(
  quests: readonly DailyQuest[],
  type: DailyQuestType,
  incrementBy: number
): readonly DailyQuest[] {
  return quests.map((quest) => {
    if (quest.type !== type) return quest
    if (quest.completed) return quest

    const newProgress = Math.min(quest.progress + incrementBy, quest.target)
    const nowCompleted = newProgress >= quest.target

    return {
      ...quest,
      progress: newProgress,
      completed: nowCompleted,
    }
  })
}

/**
 * Mark a specific quest as completed by ID.
 * Returns a new array with the quest marked complete (immutable).
 * Throws if the quest is not found or already completed.
 */
export function completeQuestById(
  quests: readonly DailyQuest[],
  questId: string
): { readonly quests: readonly DailyQuest[]; readonly quest: DailyQuest } {
  const questIndex = quests.findIndex((q) => q.id === questId)
  if (questIndex === -1) {
    throw new Error(`Quest not found: ${questId}`)
  }

  const quest = quests[questIndex]
  if (quest === undefined) {
    throw new Error(`Quest not found: ${questId}`)
  }
  if (quest.completed) {
    throw new Error(`Quest already completed: ${questId}`)
  }

  const completedQuest: DailyQuest = {
    ...quest,
    progress: quest.target,
    completed: true,
  }

  const newQuests = quests.map((q, i) => (i === questIndex ? completedQuest : q))

  return { quests: newQuests, quest: completedQuest }
}

// ---------------------------------------------------------------------------
// Daily Reset Logic
// ---------------------------------------------------------------------------

/**
 * Format a Date object as an ISO date string (YYYY-MM-DD) in local time.
 * Uses local time intentionally — "midnight rollover" is in the user's timezone.
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Determine whether the quests need to be reset for a new day.
 * Returns true if the quests are empty or were generated for a different date.
 */
export function needsQuestReset(quests: readonly DailyQuest[], todayDate: string): boolean {
  if (quests.length === 0) return true
  const firstQuest = quests[0]
  if (firstQuest === undefined) return true
  return firstQuest.date !== todayDate
}

/**
 * Get quests for today, generating new ones if needed.
 * If the stored quests are from a previous day, returns a fresh set.
 */
export function getOrCreateDailyQuests(
  storedQuests: readonly DailyQuest[],
  nowFn: () => Date = () => new Date()
): readonly DailyQuest[] {
  const today = formatDateLocal(nowFn())
  if (needsQuestReset(storedQuests, today)) {
    return generateDailyQuests(today)
  }
  return storedQuests
}

// ---------------------------------------------------------------------------
// Quest Completion Status
// ---------------------------------------------------------------------------

/**
 * Count the number of completed quests in a set.
 */
export function countCompletedQuests(quests: readonly DailyQuest[]): number {
  return quests.filter((q) => q.completed).length
}

/**
 * Whether all quests for the day are completed (triggers bonus XP).
 */
export function areAllQuestsCompleted(quests: readonly DailyQuest[]): boolean {
  if (quests.length === 0) return false
  return quests.every((q) => q.completed)
}

/**
 * Get the quest template for a given type.
 * Returns the XP reward for the quest.
 */
export function getQuestXPReward(type: DailyQuestType): number {
  const template = QUEST_TEMPLATES.find((t) => t.type === type)
  return template?.xpReward ?? 0
}
