// =============================================================================
// utils/calcStats.ts — Game statistics calculations
// =============================================================================
// Deterministic pure functions. Anti-Hallucination L3: golden-tested.
// =============================================================================

import { parseResult } from './parseResult'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GameStatInput {
  result: string | null
  boardSize: number
  startedAt: number
  moveCount: number
}

export interface PlayerStats {
  winRate: number // 0-100, percentage
  totalGames: number
  currentStreak: number // Consecutive wins from most recent game
  bestStreak: number // Longest win streak
}

export interface StreakResult {
  current: number
  best: number
}

// ---------------------------------------------------------------------------
// Win Rate
// ---------------------------------------------------------------------------

/**
 * Calculate win rate as a percentage (0-100).
 * Returns 0 if no finished games.
 */
export function calcWinRate(games: readonly GameStatInput[]): number {
  const finished = games.filter((g) => g.result != null && g.result.trim() !== '')
  if (finished.length === 0) return 0

  const wins = finished.filter((g) => parseResult(g.result).isUserWin).length
  return Math.round((wins / finished.length) * 1000) / 10 // one decimal
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/**
 * Calculate win streaks from a list of games.
 * Games should be ordered oldest-first (ascending startedAt).
 *
 * - currentStreak: consecutive wins counting backward from most recent game
 * - bestStreak: longest consecutive win sequence in the entire list
 */
export function calcStreak(games: readonly GameStatInput[]): StreakResult {
  if (games.length === 0) return { current: 0, best: 0 }

  // Filter to finished games only
  const finished = games.filter((g) => g.result != null && g.result.trim() !== '')
  if (finished.length === 0) return { current: 0, best: 0 }

  const outcomes = finished.map((g) => parseResult(g.result).isUserWin)

  // Best streak: scan forward
  let best = 0
  let run = 0
  for (const win of outcomes) {
    if (win) {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
  }

  // Current streak: scan backward from end
  let current = 0
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i]) {
      current++
    } else {
      break
    }
  }

  return { current, best }
}

// ---------------------------------------------------------------------------
// Moving Average
// ---------------------------------------------------------------------------

/**
 * Calculate a simple moving average over a list of values.
 * Returns an array of averages, one for each position where a full window exists.
 *
 * If values.length < window, returns a single average of all values.
 * If values is empty, returns empty array.
 *
 * @param values - Numeric values (e.g., per-game win rates)
 * @param window - Window size for the moving average
 */
export function calcMovingAvg(values: readonly number[], window: number): number[] {
  if (values.length === 0) return []
  if (window <= 0) return []

  const effectiveWindow = Math.min(window, values.length)
  const result: number[] = []

  for (let i = effectiveWindow - 1; i < values.length; i++) {
    let sum = 0
    for (let j = i - effectiveWindow + 1; j <= i; j++) {
      sum += values[j]!
    }
    result.push(Math.round((sum / effectiveWindow) * 10) / 10)
  }

  return result
}

// ---------------------------------------------------------------------------
// Win Rate by Board Size
// ---------------------------------------------------------------------------

export interface BoardSizeStats {
  boardSize: number
  games: number
  wins: number
  winRate: number
}

/**
 * Calculate win rate broken down by board size.
 */
export function calcWinRateByBoardSize(games: readonly GameStatInput[]): BoardSizeStats[] {
  const groups = new Map<number, { total: number; wins: number }>()

  for (const g of games) {
    if (g.result == null || g.result.trim() === '') continue
    const existing = groups.get(g.boardSize) ?? { total: 0, wins: 0 }
    existing.total++
    if (parseResult(g.result).isUserWin) existing.wins++
    groups.set(g.boardSize, existing)
  }

  return Array.from(groups.entries())
    .map(([boardSize, { total, wins }]) => ({
      boardSize,
      games: total,
      wins,
      winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.boardSize - b.boardSize)
}
