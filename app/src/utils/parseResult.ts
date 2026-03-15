// =============================================================================
// utils/parseResult.ts — Parse Go game result strings
// =============================================================================
// Deterministic pure function. Anti-Hallucination L3: golden-tested.
//
// Input format: Result string from KataGo/storage (e.g., "B+R", "W+5.5")
// Output: Structured ParsedResult object
//
// Assumption: User always plays Black (current app design).
// =============================================================================

export interface ParsedResult {
  /** Winner color, or null for ongoing/jigo */
  winner: 'B' | 'W' | null
  /** How the game ended */
  method: 'resign' | 'score' | 'timeout' | 'jigo' | 'ongoing'
  /** Score difference, or null if not applicable */
  score: number | null
  /** Whether the user (Black) won */
  isUserWin: boolean
}

/**
 * Parse a Go game result string into a structured object.
 *
 * Recognized formats:
 *   "B+R"    → Black wins by resignation
 *   "W+R"    → White wins by resignation
 *   "B+5.5"  → Black wins by 5.5 points
 *   "W+0.5"  → White wins by 0.5 points
 *   "B+T"    → Black wins by timeout
 *   "W+T"    → White wins by timeout
 *   "0"      → Jigo (draw)
 *   null     → Game ongoing
 *   ""       → Game ongoing
 *
 * @param result - Result string from DB/KataGo, or null
 * @returns Parsed result object
 */
export function parseResult(result: string | null | undefined): ParsedResult {
  // Null, undefined, or empty → ongoing
  if (result == null || result.trim() === '') {
    return { winner: null, method: 'ongoing', score: null, isUserWin: false }
  }

  const trimmed = result.trim()

  // Jigo (draw): "0"
  if (trimmed === '0') {
    return { winner: null, method: 'jigo', score: 0, isUserWin: false }
  }

  // Must match pattern: (B|W)+<something>
  const match = /^([BW])\+(.+)$/.exec(trimmed)
  if (!match) {
    // Unrecognized format → treat as ongoing
    return { winner: null, method: 'ongoing', score: null, isUserWin: false }
  }

  const winner = match[1] as 'B' | 'W'
  const detail = match[2]!

  // Resignation: "R" or "Resign"
  if (detail.toUpperCase() === 'R' || detail.toUpperCase() === 'RESIGN') {
    return { winner, method: 'resign', score: null, isUserWin: winner === 'B' }
  }

  // Timeout: "T" or "Time"
  if (detail.toUpperCase() === 'T' || detail.toUpperCase() === 'TIME') {
    return { winner, method: 'timeout', score: null, isUserWin: winner === 'B' }
  }

  // Score: numeric value (e.g., "5.5", "0.5", "12")
  const scoreValue = parseFloat(detail)
  if (!Number.isNaN(scoreValue) && Number.isFinite(scoreValue)) {
    return { winner, method: 'score', score: scoreValue, isUserWin: winner === 'B' }
  }

  // Unrecognized detail → resignation as fallback (conservative)
  return { winner, method: 'resign', score: null, isUserWin: winner === 'B' }
}
