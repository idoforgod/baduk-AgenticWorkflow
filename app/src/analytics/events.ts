// =============================================================================
// Module: analytics/events — Telemetry Event Definitions
// =============================================================================
// Layer 3 (Application)
// Purpose: Define every telemetry event this platform may emit.
//          All events are anonymous — no usernames, email, IP, or move sequences.
//
// Privacy rules enforced at the type level:
//   - No string fields that could carry free-form user content.
//   - Board size, mode, and difficulty are categorical enumerations.
//   - Duration is a rounded integer (seconds) — not a precise timestamp.
//   - Move count is a coarse integer — no individual move data.
// =============================================================================

import type { BoardSize, GameMode, PositionCategory, Tier } from '@core'

// ---------------------------------------------------------------------------
// Discriminated union: every event shape is explicit and exhaustive.
// ---------------------------------------------------------------------------

/** Game session started. */
export interface GameStartedEvent {
  readonly event: 'game_started'
  readonly boardSize: BoardSize
  readonly mode: GameMode
  /** AI difficulty level 1-9, or null for human-vs-human (future). */
  readonly difficulty: number | null
}

/** Game session completed (by any end reason). */
export interface GameEndedEvent {
  readonly event: 'game_ended'
  /** Outcome from the current player's perspective: 'win' | 'loss' | 'draw'. */
  readonly result: 'win' | 'loss' | 'draw'
  /** Rounded session duration in seconds. */
  readonly duration: number
  readonly boardSize: BoardSize
  readonly mode: GameMode
  /** Total move count (coarse signal for game length — no sequence stored). */
  readonly moveCount: number
}

/** User opened an explanation panel for a move. */
export interface ExplanationViewedEvent {
  readonly event: 'explanation_viewed'
  readonly tier: Tier
  /** Move number (ordinal position, not a coordinate). */
  readonly moveNumber: number
  readonly category: PositionCategory
}

/** User progressed through the onboarding flow. */
export interface OnboardingStepEvent {
  readonly event: 'onboarding_step'
  /** Identifier for the onboarding step (e.g., 'welcome', 'board-basics'). */
  readonly stepName: string
  readonly completed: boolean
}

/** Quick-Go (9×9 fast-play mode) game completed. */
export interface QuickGoPlayedEvent {
  readonly event: 'quick_go_played'
  readonly result: 'win' | 'loss' | 'draw'
  /** Rounded session duration in seconds. */
  readonly duration: number
  /** AI difficulty level 1-9. */
  readonly difficulty: number
}

/** User changed a setting value. */
export interface SettingsChangedEvent {
  readonly event: 'settings_changed'
  /**
   * Setting key (must be a known key — not a free-form string).
   * Permitted values: 'theme' | 'boardSize' | 'difficulty' | 'explanationTier'
   *   | 'soundEnabled' | 'analyticsConsent' | 'notificationsEnabled'
   */
  readonly setting:
    | 'theme'
    | 'boardSize'
    | 'difficulty'
    | 'explanationTier'
    | 'soundEnabled'
    | 'analyticsConsent'
    | 'notificationsEnabled'
  /**
   * New value as a string representation of a primitive (boolean/number/enum).
   * MUST NOT contain user-generated content.
   */
  readonly value: string
}

/** User changed the UI language. */
export interface LanguageChangedEvent {
  readonly event: 'language_changed'
  /** BCP-47 language tag, e.g. 'en', 'ko', 'ja'. */
  readonly from: string
  readonly to: string
}

/** Union of all valid telemetry events. */
export type AnalyticsEvent =
  | GameStartedEvent
  | GameEndedEvent
  | ExplanationViewedEvent
  | OnboardingStepEvent
  | QuickGoPlayedEvent
  | SettingsChangedEvent
  | LanguageChangedEvent

/** Helper: extract the event name string from any event union member. */
export type AnalyticsEventName = AnalyticsEvent['event']
