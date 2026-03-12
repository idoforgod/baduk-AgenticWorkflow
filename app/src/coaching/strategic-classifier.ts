// =============================================================================
// coaching/strategic-classifier.ts — Tactical Classification Algorithm
// =============================================================================
// Implements the priority chain from Step 26 Design Section 4.
// 100% deterministic: every branch is if/else against fixed thresholds.
// No randomness, no ML, no LLM.
//
// Priority chain:
//   1a. brilliant_move  (moveQuality === 'brilliant')
//   1b. mistake          (moveQuality in ['blunder', 'mistake'])
//   2.  momentum_shift   (winrate crosses 50% boundary)
//   3a. capture          (adjacent opponent in atari)
//   3b. attack           (adjacent opponent with 2-3 liberties)
//   3c. escape           (own group <= 3 liberties, surrounded)
//   3d. connection       (2+ adjacent same-color neighbors)
//   4a. invasion          (playing into opponent territory)
//   4b. defense           (protecting own territory)
//   4c. approach          (opening, corner, near opponent)
//   4d. territory_building (opening, corner/side, no opponent)
//   5a. endgame_counting  (endgame phase)
//   5b. close_game        (winrate near 50%)
//   6.  good_move         (moveQuality in ['excellent', 'good'])
//   7.  positional         (fallback)
// =============================================================================

import type { BoardGrid, BoardSize, Group, PlayerColor } from '@core/interfaces'
import type { ParsedAnalysis } from '../explanation-engine/types'
import { BLACK, EMPTY, findGroup, getAdjacencyTable, WHITE } from '../rules-engine/board'
import type { TacticalSituation } from './types'

// =============================================================================
// Spatial Classification (Section 3.3)
// =============================================================================

/**
 * Classify a board index as corner, side, or center.
 * Used by approach and territory_building checks.
 *
 * Corner: within edgeThreshold lines of two edges.
 * Side: within edgeThreshold lines of one edge.
 * Center: everything else.
 */
export function classifySpatial(index: number, boardSize: BoardSize): 'corner' | 'side' | 'center' {
  const row = Math.floor(index / boardSize)
  const col = index % boardSize

  const edgeThreshold = boardSize === 9 ? 3 : boardSize === 13 ? 4 : 5

  const nearTop = row < edgeThreshold
  const nearBottom = row >= boardSize - edgeThreshold
  const nearLeft = col < edgeThreshold
  const nearRight = col >= boardSize - edgeThreshold

  const verticalEdge = nearTop || nearBottom
  const horizontalEdge = nearLeft || nearRight

  if (verticalEdge && horizontalEdge) return 'corner'
  if (verticalEdge || horizontalEdge) return 'side'
  return 'center'
}

// =============================================================================
// Adjacent Group Analysis (Section 3.4)
// =============================================================================

export interface AdjacentGroupAnalysis {
  /** Distinct opponent groups adjacent to lastMoveIndex */
  readonly adjOpponentGroups: readonly Group[]
  /** Count of adjacent intersections occupied by opponent */
  readonly adjOpponentCount: number
  /** Count of adjacent intersections occupied by same color */
  readonly adjFriendlyNeighborCount: number
  /** The group containing lastMoveIndex */
  readonly ownGroup: Group | null
}

/**
 * Compute tactical pressure around the last move.
 * Uses findGroup() and getAdjacencyTable() from rules-engine.
 */
export function computeAdjacentGroups(
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor
): AdjacentGroupAnalysis {
  const adjTable = getAdjacencyTable(boardSize)
  const neighbors = adjTable[lastMoveIndex]
  const opponent: PlayerColor = player === BLACK ? WHITE : BLACK

  let adjOpponentCount = 0
  let adjFriendlyNeighborCount = 0
  const opponentGroupMap = new Map<number, Group>()

  const ownGroup = findGroup(grid, boardSize, lastMoveIndex)

  if (neighbors) {
    for (const n of neighbors) {
      if (grid[n] === opponent) {
        adjOpponentCount++
        const group = findGroup(grid, boardSize, n)
        if (group) {
          // Dedup by min stone index
          const key = Math.min(...group.stones)
          opponentGroupMap.set(key, group)
        }
      }
      if (grid[n] === player) {
        adjFriendlyNeighborCount++
      }
    }
  }

  return {
    adjOpponentGroups: Array.from(opponentGroupMap.values()),
    adjOpponentCount,
    adjFriendlyNeighborCount,
    ownGroup,
  }
}

// =============================================================================
// Count adjacent opponents (lightweight version for Tier 4)
// =============================================================================

function countAdjacentOpponents(
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor
): number {
  const adjTable = getAdjacencyTable(boardSize)
  const neighbors = adjTable[lastMoveIndex]
  const opponent: PlayerColor = player === BLACK ? WHITE : BLACK

  let count = 0
  if (neighbors) {
    for (const n of neighbors) {
      if (grid[n] === opponent) {
        count++
      }
    }
  }
  return count
}

// =============================================================================
// Main Classification Function (Section 4.1)
// =============================================================================

/**
 * Classify the tactical situation of the last move.
 * 100% deterministic — every branch is a comparison against fixed thresholds.
 *
 * @param parsed - ParsedAnalysis from explanation-engine output-parser
 * @param grid - Current board grid (after the move was played)
 * @param boardSize - Board size (9, 13, or 19)
 * @param lastMoveIndex - Board index of the last move (-1 for pass)
 * @param player - The player color who just played (1=Black, 2=White)
 * @param ownership - KataGo ownership array or null
 * @param previousWinrate - Same-player-perspective winrate from 2 moves ago, or null
 * @returns TacticalSituation
 */
export function classifyTacticalSituation(
  parsed: ParsedAnalysis,
  grid: BoardGrid,
  boardSize: BoardSize,
  lastMoveIndex: number,
  player: PlayerColor,
  ownership: readonly number[] | null,
  previousWinrate: number | null
): TacticalSituation {
  const moveQuality = parsed.moveQuality

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 1: Quality-based (highest priority)
  // ─────────────────────────────────────────────────────────────────────────

  if (moveQuality === 'brilliant') {
    return 'brilliant_move'
  }

  if (moveQuality === 'blunder' || moveQuality === 'mistake') {
    return 'mistake'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 2: Momentum-based (winrate crossing 50% boundary)
  // ─────────────────────────────────────────────────────────────────────────

  const currentWinrate = parsed.raw.rootInfo.winrate

  if (previousWinrate !== null) {
    const crossedUp = previousWinrate < 0.5 && currentWinrate >= 0.5
    const crossedDown = previousWinrate >= 0.5 && currentWinrate < 0.5

    if (crossedUp || crossedDown) {
      return 'momentum_shift'
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 3: Board-state tactical (requires stone at lastMoveIndex)
  // ─────────────────────────────────────────────────────────────────────────

  if (
    lastMoveIndex >= 0 &&
    lastMoveIndex < boardSize * boardSize &&
    grid[lastMoveIndex] !== EMPTY
  ) {
    const { adjOpponentGroups, adjOpponentCount, adjFriendlyNeighborCount, ownGroup } =
      computeAdjacentGroups(grid, boardSize, lastMoveIndex, player)

    // 3a. CAPTURE: adjacent opponent in atari (1 liberty)
    for (const group of adjOpponentGroups) {
      if (group.liberties.size === 1) {
        return 'capture'
      }
    }

    // 3b. ATTACK: adjacent opponent with 2-3 liberties
    for (const group of adjOpponentGroups) {
      if (group.liberties.size >= 2 && group.liberties.size <= 3) {
        return 'attack'
      }
    }

    // 3c. ESCAPE: own group in danger (few liberties, surrounded)
    if (ownGroup !== null && ownGroup.liberties.size <= 3 && adjOpponentCount >= 2) {
      return 'escape'
    }

    // 3d. CONNECTION: connecting friendly groups
    if (adjFriendlyNeighborCount >= 2) {
      return 'connection'
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 4: Spatial-strategic (ownership + coordinates)
  // ─────────────────────────────────────────────────────────────────────────

  const gamePhase = parsed.computed.movePhase

  // Only compute spatial/ownership if we have a valid move index
  if (lastMoveIndex >= 0 && lastMoveIndex < boardSize * boardSize) {
    // Ownership-based: invasion and defense
    if (ownership !== null && lastMoveIndex < ownership.length) {
      // Ownership from Black's perspective; flip for White
      const rawOwnership = ownership[lastMoveIndex]!
      const effectiveOwnership = player === BLACK ? rawOwnership : -rawOwnership

      // 4a. INVASION: playing into opponent's territory
      if (effectiveOwnership < -0.3) {
        return 'invasion'
      }

      // 4b. DEFENSE: protecting own territory from nearby opponent
      const adjOppCount = countAdjacentOpponents(grid, boardSize, lastMoveIndex, player)
      if (effectiveOwnership > 0.3 && adjOppCount >= 1) {
        return 'defense'
      }
    }

    // Coordinate-based: approach and territory_building (opening only)
    if (gamePhase === 'opening') {
      const spatial = classifySpatial(lastMoveIndex, boardSize)
      const adjOppCount = countAdjacentOpponents(grid, boardSize, lastMoveIndex, player)

      // 4c. APPROACH: approaching opponent's corner stone
      if (spatial === 'corner' && adjOppCount >= 1) {
        return 'approach'
      }

      // 4d. TERRITORY BUILDING: claiming open territory
      if ((spatial === 'corner' || spatial === 'side') && adjOppCount === 0) {
        return 'territory_building'
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 5: Game-state (phase + winrate)
  // ─────────────────────────────────────────────────────────────────────────

  if (gamePhase === 'endgame') {
    return 'endgame_counting'
  }

  const winratePct = parsed.winratePct
  if (Math.abs(winratePct - 50) < 5) {
    return 'close_game'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 6: Positive feedback
  // ─────────────────────────────────────────────────────────────────────────

  if (moveQuality === 'excellent' || moveQuality === 'good') {
    return 'good_move'
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TIER 7: Fallback (always matches)
  // ─────────────────────────────────────────────────────────────────────────

  return 'positional'
}
