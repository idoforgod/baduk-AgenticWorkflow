// =============================================================================
// utils/extractHighlights.ts — Extract key moments from win rate history
// =============================================================================
// Deterministic pure function. Anti-Hallucination L3: golden-tested.
// =============================================================================

export interface WinRatePoint {
  move: number
  blackWinRate: number
}

export interface Highlight {
  moveNumber: number
  type: 'turning_point' | 'best_sequence' | 'critical_mistake'
  description: string
  winRateChange: number
}

/**
 * Extract up to 3 key highlights from a win rate history.
 *
 * 1. Turning Point: Move where win rate crosses 50% line
 * 2. Critical Mistake: Single move with largest win rate DROP (> 8%)
 * 3. Best Sequence: Single move with largest win rate GAIN (> 8%)
 *
 * @param history - Win rate data points, sorted by move number
 * @returns Up to 3 highlights, sorted by move number
 */
export function extractHighlights(history: readonly WinRatePoint[]): Highlight[] {
  if (history.length < 2) return []

  const highlights: Highlight[] = []

  let biggestDrop = 0
  let biggestDropMove = -1
  let biggestGain = 0
  let biggestGainMove = -1
  let turningPointMove = -1
  let turningPointChange = 0

  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1]!
    const curr = history[i]!
    const change = curr.blackWinRate - prev.blackWinRate

    // Turning point: crosses 50% line
    if (
      turningPointMove === -1 &&
      ((prev.blackWinRate >= 50 && curr.blackWinRate < 50) ||
        (prev.blackWinRate < 50 && curr.blackWinRate >= 50))
    ) {
      turningPointMove = curr.move
      turningPointChange = change
    }

    // Biggest drop (negative change = bad for Black)
    if (change < biggestDrop) {
      biggestDrop = change
      biggestDropMove = curr.move
    }

    // Biggest gain (positive change = good for Black)
    if (change > biggestGain) {
      biggestGain = change
      biggestGainMove = curr.move
    }
  }

  // Add turning point
  if (turningPointMove >= 0) {
    highlights.push({
      moveNumber: turningPointMove,
      type: 'turning_point',
      description: `Win rate crossed 50% at move ${turningPointMove}`,
      winRateChange: Math.round(turningPointChange * 10) / 10,
    })
  }

  // Add critical mistake (drop > 8%)
  if (biggestDropMove >= 0 && biggestDrop < -8) {
    highlights.push({
      moveNumber: biggestDropMove,
      type: 'critical_mistake',
      description: `Win rate dropped ${Math.abs(Math.round(biggestDrop * 10) / 10)}% at move ${biggestDropMove}`,
      winRateChange: Math.round(biggestDrop * 10) / 10,
    })
  }

  // Add best sequence (gain > 8%)
  if (biggestGainMove >= 0 && biggestGain > 8) {
    highlights.push({
      moveNumber: biggestGainMove,
      type: 'best_sequence',
      description: `Win rate gained ${Math.round(biggestGain * 10) / 10}% at move ${biggestGainMove}`,
      winRateChange: Math.round(biggestGain * 10) / 10,
    })
  }

  // Sort by move number
  return highlights.sort((a, b) => a.moveNumber - b.moveNumber)
}
