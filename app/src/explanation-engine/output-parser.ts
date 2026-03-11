// =============================================================================
// Module: explanation-engine/output-parser — KataGo Output Parser
// =============================================================================
// Parses KataGo AnalysisResponse into a unified ParsedAnalysis structure.
// Computes derived fields: winrateDelta, scoreLeadDelta, moveRank, etc.
// Handles optional fields gracefully (ownership, policy).
//
// L0 Data Gate: Only KataGo data enters this module. No board state.
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  ComputedFields,
  GTPLocation,
  MoveQuality,
} from '@core/interfaces'
import { getAssessmentLabel, type ParsedAnalysis } from './types'

// =============================================================================
// Thresholds (from Step 4 Section 3.4)
// =============================================================================

const THRESHOLDS = {
  BLUNDER_WINRATE_DROP: -0.1,
  MISTAKE_WINRATE_DROP: -0.05,
  INACCURACY_WINRATE_DROP: -0.02,
  HIGH_CONFIDENCE_VISITS: 400,
  LOW_CONFIDENCE_VISITS: 50,
  OPENING_19x19: 40,
  OPENING_13x13: 25,
  OPENING_9x9: 15,
  ENDGAME_RAW_VAR_TIME_LEFT: 40,
  ENDGAME_TURN_19x19: 150,
  ENDGAME_TURN_13x13: 90,
  ENDGAME_TURN_9x9: 40,
  ENDGAME_RAW_VAR_13x13: 25,
  ENDGAME_RAW_VAR_9x9: 15,
} as const

// =============================================================================
// Game Phase Detection (Step 4 Section 4.2.4)
// =============================================================================

export function detectGamePhase(
  turnNumber: number,
  boardSize: BoardSize,
  rawVarTimeLeft?: number
): 'opening' | 'middle_game' | 'endgame' {
  const openingThreshold =
    boardSize === 19
      ? THRESHOLDS.OPENING_19x19
      : boardSize === 13
        ? THRESHOLDS.OPENING_13x13
        : THRESHOLDS.OPENING_9x9

  const endgameTurnThreshold =
    boardSize === 19
      ? THRESHOLDS.ENDGAME_TURN_19x19
      : boardSize === 13
        ? THRESHOLDS.ENDGAME_TURN_13x13
        : THRESHOLDS.ENDGAME_TURN_9x9

  const endgameVarThreshold =
    boardSize === 19
      ? THRESHOLDS.ENDGAME_RAW_VAR_TIME_LEFT
      : boardSize === 13
        ? THRESHOLDS.ENDGAME_RAW_VAR_13x13
        : THRESHOLDS.ENDGAME_RAW_VAR_9x9

  if (turnNumber < openingThreshold) {
    return 'opening'
  }

  if (
    turnNumber >= endgameTurnThreshold ||
    (rawVarTimeLeft !== undefined && rawVarTimeLeft < endgameVarThreshold)
  ) {
    return 'endgame'
  }

  return 'middle_game'
}

// =============================================================================
// Move Quality Classification (Step 4 Section 4.1 Priority 2)
// =============================================================================

export function classifyMoveQuality(
  winrateDelta: number | null,
  moveRank: number | null,
  topMoveGap: number,
  prior: number,
  visits: number
): MoveQuality | null {
  // Cannot classify without knowing the actual move
  if (moveRank === null) return null

  // Check brilliant first (order=0, low prior, high visits)
  if (moveRank === 0 && prior < 0.05 && visits > 100) {
    return 'brilliant'
  }

  // Check excellent (order=0, clear gap)
  if (moveRank === 0 && topMoveGap > 0.03) {
    return 'excellent'
  }

  // Check good (order=0)
  if (moveRank === 0) {
    return 'good'
  }

  // Delta-based classifications
  if (winrateDelta !== null) {
    if (winrateDelta < THRESHOLDS.BLUNDER_WINRATE_DROP) {
      return 'blunder'
    }
    if (winrateDelta < THRESHOLDS.MISTAKE_WINRATE_DROP) {
      return 'mistake'
    }
    if (winrateDelta < THRESHOLDS.INACCURACY_WINRATE_DROP) {
      return 'inaccuracy'
    }
    // Acceptable (rank 1-2, small delta)
    if (moveRank <= 2 && winrateDelta >= THRESHOLDS.INACCURACY_WINRATE_DROP) {
      return 'acceptable'
    }
  }

  // If we have a rank but no delta, classify based on rank alone
  if (moveRank <= 2) return 'acceptable'

  return null
}

// =============================================================================
// Confidence Level
// =============================================================================

function getConfidenceLevel(visits: number): 'high' | 'medium' | 'low' {
  if (visits >= THRESHOLDS.HIGH_CONFIDENCE_VISITS) return 'high'
  if (visits >= THRESHOLDS.LOW_CONFIDENCE_VISITS) return 'medium'
  return 'low'
}

// =============================================================================
// PV Formatting
// =============================================================================

function formatPV(pv: readonly string[], length: number): string {
  return pv.slice(0, length).join(' -> ')
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse a KataGo AnalysisResponse into a unified ParsedAnalysis structure.
 *
 * @param current - Current position's KataGo analysis.
 * @param previous - Previous position's KataGo analysis (for delta computation).
 * @param actualMove - The GTP coordinate of the move that was played.
 * @param turnNumber - Current turn number.
 * @param boardSize - Board size (9, 13, or 19).
 * @returns ParsedAnalysis with all computed fields.
 */
export function parseAnalysis(
  current: AnalysisResponse,
  previous: AnalysisResponse | null,
  actualMove: GTPLocation | null,
  turnNumber: number,
  boardSize: BoardSize
): ParsedAnalysis {
  const rootInfo = current.rootInfo
  const moveInfos = current.moveInfos
  const bestMove = moveInfos.length > 0 ? moveInfos[0] : null
  const secondMove = moveInfos.length > 1 ? moveInfos[1] : null

  // --- Compute deltas ---
  // KataGo reports from the perspective of the current player.
  // When computing delta between moves, the perspective flips (since the player changes).
  // winrateDelta = current.winrate - (1 - previous.winrate)
  // This gives the change from the PREVIOUS player's perspective to the CURRENT player's perspective.
  let winrateDelta: number | null = null
  let scoreLeadDelta: number | null = null

  if (previous !== null) {
    // Perspective flip: previous was from the other player's point of view
    const previousWinrateAdjusted = 1.0 - previous.rootInfo.winrate
    const previousScoreAdjusted = -previous.rootInfo.scoreLead
    winrateDelta = rootInfo.winrate - previousWinrateAdjusted
    scoreLeadDelta = rootInfo.scoreLead - previousScoreAdjusted
  }

  // --- Find actual move rank ---
  let moveRank: number | null = null
  let bestMovePlayed = false
  if (actualMove !== null) {
    const idx = moveInfos.findIndex((m) => m.move.toLowerCase() === actualMove.toLowerCase())
    if (idx >= 0) {
      moveRank = moveInfos[idx].order
      bestMovePlayed = moveRank === 0
    }
  }

  // --- Top move gap ---
  const topMoveGap = bestMove && secondMove ? bestMove.winrate - secondMove.winrate : 0

  // --- Game phase ---
  const rawVarTimeLeft = rootInfo.rawVarTimeLeft
  const movePhase = detectGamePhase(turnNumber, boardSize, rawVarTimeLeft)

  // --- Confidence ---
  const confidenceLevel = getConfidenceLevel(rootInfo.visits)

  // --- Computed fields ---
  const computed: ComputedFields = {
    winrateDelta,
    scoreLeadDelta,
    bestMovePlayed,
    moveRank,
    topMoveGap,
    movePhase,
    confidenceLevel,
  }

  // --- Move quality ---
  const moveQuality = classifyMoveQuality(
    winrateDelta,
    moveRank,
    topMoveGap,
    bestMove?.prior ?? 1,
    bestMove?.visits ?? 0
  )

  // --- Formatted values ---
  const winratePct = rootInfo.winrate * 100
  const bestWinratePct = bestMove ? bestMove.winrate * 100 : 0
  const winrateDeltaPct = winrateDelta !== null ? Math.abs(winrateDelta) * 100 : 0
  const scoreLeadDeltaAbs = scoreLeadDelta !== null ? Math.abs(scoreLeadDelta) : 0
  const pvShort = bestMove ? formatPV(bestMove.pv, 2) : ''
  const pvMedium = bestMove ? formatPV(bestMove.pv, 3) : ''
  const pvLong = bestMove ? formatPV(bestMove.pv, 5) : ''
  const koValue = bestMove && secondMove ? Math.abs(bestMove.scoreLead - secondMove.scoreLead) : 0
  const priorPct = bestMove ? bestMove.prior * 100 : 0
  const lcbPct = bestMove ? bestMove.lcb * 100 : 0

  // --- Assessment labels ---
  const currentAssessmentLabel = getAssessmentLabel(rootInfo.winrate)
  const previousAssessmentLabel = previous
    ? getAssessmentLabel(1.0 - previous.rootInfo.winrate)
    : 'unknown'

  // --- Candidates count ---
  const candidatesCount = moveInfos.length

  return {
    raw: current,
    previous,
    actualMove,
    turnNumber,
    boardSize,
    computed,
    moveQuality,
    winratePct,
    bestWinratePct,
    winrateDeltaPct,
    scoreLeadDeltaAbs,
    pvShort,
    pvMedium,
    pvLong,
    koValue,
    priorPct,
    lcbPct,
    categoryHint: null,
    previousAssessmentLabel,
    currentAssessmentLabel,
    candidatesCount,
  }
}
