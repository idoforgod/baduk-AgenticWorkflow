// =============================================================================
// Chinese Scoring Algorithm — Tromp-Taylor Rules Engine
// =============================================================================
// Layer 2 (Domain) — Pure functions, no side effects.
// Implements: DKS Section 5 (Chinese Scoring Algorithm), TT-09, TT-10.
// =============================================================================

import type { BoardState, Player, ScoreResult, TerritoryMap } from '@core/interfaces'
import { BLACK, EMPTY, getAdjacencyTable, WHITE } from './board'

// =============================================================================
// Territory Detection
// =============================================================================

/**
 * Compute the territory map for a board position.
 * DKS R19-R22: Classify each empty intersection as Black territory,
 * White territory, or dame using flood-fill BFS.
 *
 * Algorithm:
 *   1. Find connected components of empty intersections.
 *   2. For each region, check which colors it "reaches" (is adjacent to).
 *   3. If it reaches only Black -> Black territory.
 *   4. If it reaches only White -> White territory.
 *   5. If it reaches both or neither -> dame.
 *
 * @param board - Board state to analyze.
 * @returns TerritoryMap classifying each empty intersection.
 */
export function computeTerritory(board: BoardState): TerritoryMap {
  const { grid, size } = board
  const total = size * size
  const adj = getAdjacencyTable(size)
  const visited = new Uint8Array(total)

  const blackTerritory = new Set<number>()
  const whiteTerritory = new Set<number>()
  const dame = new Set<number>()

  for (let i = 0; i < total; i++) {
    if (grid[i] !== EMPTY || visited[i]) continue

    // BFS to find connected empty region
    const region: number[] = []
    let reachesBlack = false
    let reachesWhite = false
    const queue: number[] = [i]
    visited[i] = 1

    let head = 0
    while (head < queue.length) {
      const current = queue[head++]!
      region.push(current)

      const neighbors = adj[current]!
      for (let j = 0; j < neighbors.length; j++) {
        const n = neighbors[j]!
        const nColor = grid[n]!

        if (nColor === BLACK) {
          reachesBlack = true
        } else if (nColor === WHITE) {
          reachesWhite = true
        } else if (!visited[n]) {
          visited[n] = 1
          queue.push(n)
        }
      }
    }

    // Classify the region
    if (reachesBlack && !reachesWhite) {
      for (const idx of region) blackTerritory.add(idx)
    } else if (reachesWhite && !reachesBlack) {
      for (const idx of region) whiteTerritory.add(idx)
    } else {
      for (const idx of region) dame.add(idx)
    }
  }

  return { black: blackTerritory, white: whiteTerritory, dame }
}

// =============================================================================
// Chinese Scoring (Area Scoring)
// =============================================================================

/**
 * Compute the Chinese (area) score for the current board position.
 * DKS Section 5: Score = own stones + own territory.
 * DKS C18: All points accounted for (blackScore + whiteScore + dame = N*N).
 *
 * @param board - Board state to score.
 * @param komi - Komi value to apply to White's score.
 * @returns ScoreResult with full breakdown.
 */
export function chineseScore(board: BoardState, komi: number): ScoreResult {
  const { grid, size } = board
  const total = size * size

  // Step 1: Count stones on the board
  let blackStones = 0
  let whiteStones = 0
  for (let i = 0; i < total; i++) {
    if (grid[i] === BLACK) blackStones++
    else if (grid[i] === WHITE) whiteStones++
  }

  // Step 2: Compute territory
  const territory = computeTerritory(board)

  // Step 3: Compute scores
  const blackScore = blackStones + territory.black.size
  const whiteScore = whiteStones + territory.white.size
  const dameCount = territory.dame.size

  // Step 4: Apply komi and determine winner
  const scoreDifferential = blackScore - (whiteScore + komi)

  let winner: Player | null
  if (scoreDifferential > 0) {
    winner = 'B'
  } else if (scoreDifferential < 0) {
    winner = 'W'
  } else {
    winner = null
  }

  return {
    blackScore,
    whiteScore,
    komi,
    scoreDifferential,
    winner,
    territory,
    dameCount,
  }
}
