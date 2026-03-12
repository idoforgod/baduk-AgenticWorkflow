// =============================================================================
// coaching/coaching-adapter.ts — Main Coaching Engine
// =============================================================================
// Composes the full coaching pipeline:
//   parseAnalysis -> classifyTacticalSituation -> selectTemplate ->
//   fillSlots -> applyEncouragement -> render
//
// Core invariant: Zero LLM involvement.
// Every coaching comment is deterministic template + KataGo data.
// =============================================================================

import type {
  AnalysisResponse,
  BoardGrid,
  BoardSize,
  MoveQuality,
  PlayerColor,
} from '@core/interfaces'
import { parseAnalysis } from '../explanation-engine/output-parser'
import {
  COACHING_CATALOG,
  MOMENTUM_SUFFIXES,
  RECOVERY_SUFFIXES,
  STREAK_SUFFIXES,
} from './coaching-templates'
import {
  classifySpatial,
  classifyTacticalSituation,
  computeAdjacentGroups,
} from './strategic-classifier'
import type {
  CoachingMessage,
  CoachingTemplate,
  EncouragementState,
  PlayerContext,
  SlotValues,
  TacticalSituation,
} from './types'

// =============================================================================
// Game Phase Korean Labels
// =============================================================================

const GAME_PHASE_KOREAN: Readonly<Record<string, string>> = {
  opening: '\uD3EC\uC11D',
  middle_game: '\uC911\uBC18\uC804',
  endgame: '\uB05D\uB0B4\uAE30',
}

// =============================================================================
// Spatial Korean Labels
// =============================================================================

const SPATIAL_KOREAN: Readonly<Record<string, string>> = {
  corner: '\uADC0',
  side: '\uBCC0',
  center: '\uC911\uC559',
}

// =============================================================================
// Encouragement State Machine Transition (Section 6.3)
// =============================================================================

export function transitionEncouragementFSM(
  currentState: EncouragementState,
  situation: TacticalSituation,
  moveQuality: MoveQuality | null,
  previousMoveQuality: MoveQuality | null,
  consecutiveGoodMoves: number,
  consecutiveBadMoves: number,
  winrateImproved: boolean
): {
  nextState: EncouragementState
  nextConsecutiveGoodMoves: number
  nextConsecutiveBadMoves: number
} {
  const isGood =
    moveQuality === 'good' || moveQuality === 'excellent' || moveQuality === 'brilliant'
  const isBad = moveQuality === 'mistake' || moveQuality === 'blunder'

  // Priority override: recovery detection
  const previousWasBad = previousMoveQuality === 'mistake' || previousMoveQuality === 'blunder'
  if (previousWasBad && isGood) {
    return {
      nextState: 'recovery',
      nextConsecutiveGoodMoves: 1,
      nextConsecutiveBadMoves: 0,
    }
  }

  // Momentum detection
  if (situation === 'momentum_shift' && winrateImproved) {
    return {
      nextState: 'momentum',
      nextConsecutiveGoodMoves: isGood ? consecutiveGoodMoves + 1 : 0,
      nextConsecutiveBadMoves: isBad ? consecutiveBadMoves + 1 : 0,
    }
  }

  // Standard transitions based on current state
  switch (currentState) {
    case 'neutral':
    case 'recovery':
    case 'momentum': {
      // recovery and momentum are single-move states, revert to neutral logic
      if (isGood) {
        const newGood = consecutiveGoodMoves + 1
        if (newGood >= 3) {
          return {
            nextState: 'streak',
            nextConsecutiveGoodMoves: newGood,
            nextConsecutiveBadMoves: 0,
          }
        }
        return {
          nextState: 'neutral',
          nextConsecutiveGoodMoves: newGood,
          nextConsecutiveBadMoves: 0,
        }
      }
      if (isBad) {
        return {
          nextState: 'neutral',
          nextConsecutiveGoodMoves: 0,
          nextConsecutiveBadMoves: consecutiveBadMoves + 1,
        }
      }
      // inaccuracy, acceptable, or null
      return { nextState: 'neutral', nextConsecutiveGoodMoves: 0, nextConsecutiveBadMoves: 0 }
    }

    case 'streak': {
      if (isGood) {
        return {
          nextState: 'streak',
          nextConsecutiveGoodMoves: consecutiveGoodMoves + 1,
          nextConsecutiveBadMoves: 0,
        }
      }
      // Any non-good move breaks the streak
      return {
        nextState: 'neutral',
        nextConsecutiveGoodMoves: 0,
        nextConsecutiveBadMoves: isBad ? 1 : 0,
      }
    }
  }
}

// =============================================================================
// Slot Value Computation
// =============================================================================

function computeSlotValues(
  parsed: ReturnType<typeof parseAnalysis>,
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor,
  consecutiveGoodMoves: number
): SlotValues {
  // Basic KataGo-derived values
  const winrate = Math.round(parsed.winratePct)
  const scoreLead = parsed.raw.rootInfo.scoreLead
  const score_lead = Math.round(Math.abs(scoreLead) * 10) / 10
  const best_move = parsed.raw.moveInfos.length > 0 ? parsed.raw.moveInfos[0]!.move : ''
  const pv_short = parsed.pvShort
  const game_phase = GAME_PHASE_KOREAN[parsed.computed.movePhase] ?? parsed.computed.movePhase
  const winrate_delta = Math.round(parsed.winrateDeltaPct)

  // Board-state derived values
  let capture_count = 0
  let liberties = 0
  let opponent_liberties = 0
  let spatial = ''

  if (lastMoveIndex >= 0 && lastMoveIndex < boardSize * boardSize) {
    spatial = SPATIAL_KOREAN[classifySpatial(lastMoveIndex, boardSize)] ?? ''

    const analysis = computeAdjacentGroups(grid, boardSize, lastMoveIndex, player)

    // Own group liberties
    if (analysis.ownGroup) {
      liberties = analysis.ownGroup.liberties.size
    }

    // Capture count: max stones in atari opponent groups
    let maxAtariGroupSize = 0
    let minOppLib = Infinity
    for (const group of analysis.adjOpponentGroups) {
      if (group.liberties.size === 1 && group.stones.size > maxAtariGroupSize) {
        maxAtariGroupSize = group.stones.size
      }
      if (group.liberties.size <= 3 && group.liberties.size < minOppLib) {
        minOppLib = group.liberties.size
      }
    }
    capture_count = maxAtariGroupSize
    opponent_liberties = minOppLib === Infinity ? 0 : minOppLib
  }

  return {
    winrate,
    score_lead,
    best_move,
    pv_short,
    game_phase,
    winrate_delta,
    capture_count,
    liberties,
    consecutive_count: consecutiveGoodMoves,
    opponent_liberties,
    spatial,
  }
}

// =============================================================================
// Template Selection
// =============================================================================

function selectTemplate(
  situation: TacticalSituation,
  moveNumber: number,
  slotValues: SlotValues
): { template: CoachingTemplate; emotion: CoachingMessage['emotion'] } {
  const group = COACHING_CATALOG[situation]
  const templates = group.templates

  // Try the primary variant first, then fall through if slots unavailable
  const startIndex = moveNumber % templates.length
  for (let attempt = 0; attempt < templates.length; attempt++) {
    const idx = (startIndex + attempt) % templates.length
    const template = templates[idx]!
    if (canFillAllSlots(template, slotValues)) {
      return { template, emotion: group.emotion }
    }
  }

  // If no template can be fully filled, use the first one anyway
  // (empty slot handling: skip unfillable slots)
  return { template: templates[startIndex]!, emotion: group.emotion }
}

function canFillAllSlots(template: CoachingTemplate, slotValues: SlotValues): boolean {
  for (const slot of template.slots) {
    const value = slotValues[slot as keyof SlotValues]
    if (value === '' || value === undefined) return false
  }
  return true
}

// =============================================================================
// Slot Filling
// =============================================================================

function fillSlots(templateText: string, slotValues: SlotValues): string {
  let result = templateText
  for (const [key, value] of Object.entries(slotValues)) {
    const placeholder = `{${key}}`
    if (result.includes(placeholder)) {
      result = result.split(placeholder).join(String(value))
    }
  }
  return result
}

// =============================================================================
// Encouragement Suffix Application
// =============================================================================

function applyEncouragementSuffix(
  baseText: string,
  encouragementState: EncouragementState,
  moveNumber: number,
  slotValues: SlotValues
): string {
  switch (encouragementState) {
    case 'streak': {
      const templates = STREAK_SUFFIXES.templates
      const idx = slotValues.consecutive_count % templates.length
      const suffix = templates[idx]!
      return baseText + fillSlots(suffix.text, slotValues)
    }
    case 'recovery': {
      const templates = RECOVERY_SUFFIXES.templates
      const idx = moveNumber % templates.length
      const suffix = templates[idx]!
      return baseText + fillSlots(suffix.text, slotValues)
    }
    case 'momentum': {
      const templates = MOMENTUM_SUFFIXES.templates
      const idx = moveNumber % templates.length
      const suffix = templates[idx]!
      return baseText + fillSlots(suffix.text, slotValues)
    }
    case 'neutral':
    default:
      return baseText
  }
}

// =============================================================================
// Main Pipeline
// =============================================================================

/**
 * Generate a coaching message for the current position.
 *
 * Pipeline: parseAnalysis -> classify -> selectTemplate -> fillSlots -> suffix -> render
 *
 * @returns CoachingMessage + updated PlayerContext, or null if no analysis available.
 */
export function generateCoachingMessage(
  current: AnalysisResponse,
  previous: AnalysisResponse | null,
  actualMove: string | null,
  moveNumber: number,
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor,
  ownership: readonly number[] | null,
  playerContext: PlayerContext
): { message: CoachingMessage; updatedContext: PlayerContext } {
  // Step 1: Parse analysis
  const parsed = parseAnalysis(current, previous, actualMove, moveNumber, boardSize)

  // Step 2: Classify tactical situation
  const situation = classifyTacticalSituation(
    parsed,
    grid,
    boardSize,
    lastMoveIndex,
    player,
    ownership,
    playerContext.previousWinrate
  )

  // Step 3: Compute slot values
  const slotValues = computeSlotValues(
    parsed,
    grid,
    boardSize,
    lastMoveIndex,
    player,
    playerContext.consecutiveGoodMoves
  )

  // Step 4: Transition encouragement FSM
  const currentWinrate = current.rootInfo.winrate
  const winrateImproved =
    playerContext.previousWinrate !== null ? currentWinrate > playerContext.previousWinrate : false

  const fsmResult = transitionEncouragementFSM(
    playerContext.encouragementState,
    situation,
    parsed.moveQuality,
    playerContext.previousMoveQuality,
    playerContext.consecutiveGoodMoves,
    playerContext.consecutiveBadMoves,
    winrateImproved
  )

  // Step 5: Select template
  const { template, emotion } = selectTemplate(situation, moveNumber, slotValues)

  // Step 6: Fill slots
  const baseText = fillSlots(template.text, slotValues)

  // Step 7: Apply encouragement suffix
  // Update slot values with new consecutive count for suffix rendering
  const suffixSlotValues: SlotValues = {
    ...slotValues,
    consecutive_count: fsmResult.nextConsecutiveGoodMoves,
  }
  const finalText = applyEncouragementSuffix(
    baseText,
    fsmResult.nextState,
    moveNumber,
    suffixSlotValues
  )

  // Build message
  const message: CoachingMessage = {
    text: finalText,
    emotion,
    moveNumber,
    situation,
    templateId: template.id,
  }

  // Build updated context
  const updatedContext: PlayerContext = {
    encouragementState: fsmResult.nextState,
    consecutiveGoodMoves: fsmResult.nextConsecutiveGoodMoves,
    consecutiveBadMoves: fsmResult.nextConsecutiveBadMoves,
    previousMoveQuality: parsed.moveQuality,
    previousWinrate: currentWinrate,
  }

  return { message, updatedContext }
}
