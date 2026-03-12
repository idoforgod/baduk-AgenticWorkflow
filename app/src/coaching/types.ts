// =============================================================================
// coaching/types.ts — Coaching System Types
// =============================================================================
// All types for the AI Coach Commentary System.
// These are SEPARATE from core/interfaces.ts (which must NOT be modified).
//
// Type definitions correspond to:
//   - Section 3: TacticalSituation (15 situations)
//   - Section 6: EncouragementState (4 states)
//   - Section 7: CoachingTemplate, CoachingMessage
// =============================================================================

import type { MoveQuality } from '@core/interfaces'

// =============================================================================
// Tactical Classification
// =============================================================================

/**
 * The 15 tactical situations that the classifier can detect.
 * Priority order: brilliant_move(1) > mistake(1) > momentum_shift(2) >
 * capture(3) > attack(3) > escape(3) > connection(3) > invasion(4) >
 * defense(4) > approach(4) > territory_building(4) > endgame_counting(5) >
 * close_game(5) > good_move(6) > positional(7).
 */
export type TacticalSituation =
  | 'brilliant_move'
  | 'mistake'
  | 'momentum_shift'
  | 'capture'
  | 'attack'
  | 'escape'
  | 'connection'
  | 'invasion'
  | 'defense'
  | 'approach'
  | 'territory_building'
  | 'endgame_counting'
  | 'close_game'
  | 'good_move'
  | 'positional'

// =============================================================================
// Emotion
// =============================================================================

/**
 * Emotional tone of a coaching message.
 * Determines UI styling (color, icon).
 */
export type CoachingEmotion = 'positive' | 'neutral' | 'cautionary' | 'encouraging'

// =============================================================================
// Encouragement State Machine
// =============================================================================

/**
 * State of the encouragement finite state machine.
 * - neutral: default, no special encouragement
 * - streak: player has made 3+ consecutive good moves
 * - recovery: player just made a good move after a mistake
 * - momentum: winrate shifted favorably (single-move state)
 */
export type EncouragementState = 'neutral' | 'streak' | 'recovery' | 'momentum'

// =============================================================================
// Player Context (tracked across moves)
// =============================================================================

/**
 * Persistent context for the coaching system, updated each move.
 */
export interface PlayerContext {
  /** Current encouragement state */
  readonly encouragementState: EncouragementState
  /** Number of consecutive good/excellent/brilliant moves */
  readonly consecutiveGoodMoves: number
  /** Number of consecutive bad moves (mistake/blunder) */
  readonly consecutiveBadMoves: number
  /** Previous move's quality (for recovery detection) */
  readonly previousMoveQuality: MoveQuality | null
  /** Previous winrate from the same player's perspective (for momentum) */
  readonly previousWinrate: number | null
}

// =============================================================================
// Coaching Template
// =============================================================================

/**
 * A single coaching template loaded from the catalog.
 */
export interface CoachingTemplate {
  /** Template ID (e.g., "C-TB-01") */
  readonly id: string
  /** Template text with {placeholder} slots */
  readonly text: string
  /** List of slot names used in this template */
  readonly slots: readonly string[]
}

/**
 * A situation's template group: emotion + 3 variants.
 */
export interface SituationTemplates {
  /** Emotional tone for all templates in this group */
  readonly emotion: CoachingEmotion
  /** Template variants (typically 3) */
  readonly templates: readonly CoachingTemplate[]
}

// =============================================================================
// Coaching Message (output)
// =============================================================================

/**
 * A fully rendered coaching message ready for display.
 */
export interface CoachingMessage {
  /** Rendered coaching text (Korean) */
  readonly text: string
  /** Emotional tone (for UI styling) */
  readonly emotion: CoachingEmotion
  /** Move number this message corresponds to */
  readonly moveNumber: number
  /** The tactical situation that was classified */
  readonly situation: TacticalSituation
  /** Template ID used to generate this message */
  readonly templateId: string
}

// =============================================================================
// Slot Values (intermediate data for template filling)
// =============================================================================

/**
 * All possible slot values that can be injected into templates.
 * Every value comes from KataGo data or deterministic computation.
 */
export interface SlotValues {
  readonly winrate: number
  readonly score_lead: number
  readonly best_move: string
  readonly pv_short: string
  readonly game_phase: string
  readonly winrate_delta: number
  readonly capture_count: number
  readonly liberties: number
  readonly consecutive_count: number
  readonly opponent_liberties: number
  readonly spatial: string
}
