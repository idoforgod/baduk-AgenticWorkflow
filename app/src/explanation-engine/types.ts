// =============================================================================
// Module: explanation-engine/types — Internal Types
// =============================================================================
// Internal types used within the explanation engine module.
// External types (ExplanationOutput, PatternEntry, etc.) are in core/interfaces.ts.
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  ComputedFields,
  GTPLocation,
  MoveQuality,
  PatternId,
  PositionCategory,
  Tier,
} from '@core/interfaces'

// =============================================================================
// Parsed KataGo Data
// =============================================================================

/**
 * Fully parsed and computed data from a KataGo analysis response.
 * This is the unified data structure that flows through the entire pipeline.
 */
export interface ParsedAnalysis {
  /** The raw KataGo response */
  readonly raw: AnalysisResponse
  /** Previous response (for delta computation) */
  readonly previous: AnalysisResponse | null
  /** The move that was actually played */
  readonly actualMove: GTPLocation | null
  /** Turn number */
  readonly turnNumber: number
  /** Board size */
  readonly boardSize: BoardSize
  /** All computed fields */
  readonly computed: ComputedFields
  /** Derived move quality label */
  readonly moveQuality: MoveQuality | null
  /** Winrate as percentage */
  readonly winratePct: number
  /** Best move winrate as percentage */
  readonly bestWinratePct: number
  /** Winrate delta as percentage (absolute value) */
  readonly winrateDeltaPct: number
  /** Score lead delta (absolute value) */
  readonly scoreLeadDeltaAbs: number
  /** PV formatted for beginner (2 moves) */
  readonly pvShort: string
  /** PV formatted for intermediate (3 moves) */
  readonly pvMedium: string
  /** PV formatted for advanced (5 moves) */
  readonly pvLong: string
  /** Ko value (score gap between top two moves) */
  readonly koValue: number
  /** Prior percentage for best move */
  readonly priorPct: number
  /** LCB percentage for best move */
  readonly lcbPct: number
  /** Position category hint (from external classification) */
  readonly categoryHint: PositionCategory | null
  /** Previous position assessment label */
  readonly previousAssessmentLabel: string
  /** Current position assessment label */
  readonly currentAssessmentLabel: string
  /** Number of candidates within 2% WR */
  readonly candidatesCount: number
}

// =============================================================================
// Pattern Match Result
// =============================================================================

/**
 * Result of the pattern matching process.
 */
export interface PatternMatchResult {
  /** ID of the matched pattern */
  readonly patternId: PatternId
  /** Category of the matched pattern */
  readonly category: PositionCategory
  /** Whether this is a mandatory template */
  readonly isMandatory: boolean
  /** The template text (with placeholders) */
  readonly templateText: string
  /** Slot definitions from the pattern */
  readonly slots: Readonly<Record<string, SlotDefinition>>
  /** Priority level (1 = highest) */
  readonly priority: number
}

/**
 * Slot definition for template rendering.
 */
export interface SlotDefinition {
  readonly source: string
  readonly format: SlotFormat
}

/**
 * Supported slot format types.
 */
export type SlotFormat = 'integer' | 'one_decimal' | 'two_decimal' | 'three_decimal' | 'string'

// =============================================================================
// Coverage Tracking
// =============================================================================

/**
 * Coverage tracking entry for a single position analysis.
 */
export type CoverageResult = 'TEMPLATE_HIT' | 'TEMPLATE_PARTIAL' | 'MANDATORY_HIT' | 'LLM_REQUIRED'

// =============================================================================
// Internal Pattern Definition (matches catalog structure)
// =============================================================================

/**
 * Internal pattern representation loaded from the catalog.
 * Maps 1:1 to the YAML structure from Step 4.
 */
export interface InternalPattern {
  readonly id: PatternId
  readonly name: string
  readonly tier: Tier
  readonly category: PositionCategory
  readonly mandatory: boolean
  readonly trigger: {
    readonly requiresDelta: boolean
    readonly conditions: readonly InternalTriggerCondition[]
  }
  readonly template: {
    readonly text: string
    readonly slots: Readonly<Record<string, SlotDefinition>>
  }
  readonly fallbackId: PatternId | null
}

/**
 * Trigger condition from the catalog.
 */
export interface InternalTriggerCondition {
  readonly field: string
  readonly operator: '<' | '>' | '<=' | '>=' | '==' | '!=' | 'in' | 'between'
  readonly value: number | string | readonly number[]
}

// =============================================================================
// Assessment Labels
// =============================================================================

/**
 * Human-readable assessment labels based on winrate.
 */
export function getAssessmentLabel(winrate: number): string {
  if (winrate > 0.85) return 'decisive advantage'
  if (winrate > 0.65) return 'strong advantage'
  if (winrate > 0.55) return 'slight advantage'
  if (winrate >= 0.45) return 'even position'
  if (winrate >= 0.35) return 'slight disadvantage'
  if (winrate >= 0.15) return 'significant disadvantage'
  return 'lost position'
}
