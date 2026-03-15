// =============================================================================
// hooks/useGameHistory.ts — Game history + statistics for HomeScreen
// =============================================================================
// Fetches game list from SQLite via list-games-adapter (Zod validated).
// Computes player statistics using pure functions from utils/calcStats.
//
// SOT: SQLite is the SOT for persisted games.
//      This hook is a read-only consumer.
// =============================================================================

import { useCallback, useEffect, useState } from 'react'
import { listGamesFromStorage } from '../db/adapters/list-games-adapter'
import type { GameSummaryDTO } from '../db/schema/storage-schemas'
import {
  type BoardSizeStats,
  calcStreak,
  calcWinRate,
  calcWinRateByBoardSize,
  type GameStatInput,
  type PlayerStats,
} from '../utils/calcStats'
import { formatRelativeDate } from '../utils/formatRelativeDate'
import { parseResult } from '../utils/parseResult'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentGame {
  id: string
  result: 'win' | 'loss' | 'draw' | 'ongoing'
  boardSize: number
  moveCount: number
  date: string // Relative date string
  opponent: string // "vs AI" or "vs AI Lv.5"
}

export interface GameHistoryState {
  games: RecentGame[]
  stats: PlayerStats
  boardSizeStats: BoardSizeStats[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summaryToRecentGame(s: GameSummaryDTO): RecentGame {
  const parsed = parseResult(s.result)
  let result: RecentGame['result']
  if (parsed.method === 'ongoing') result = 'ongoing'
  else if (parsed.method === 'jigo') result = 'draw'
  else if (parsed.isUserWin) result = 'win'
  else result = 'loss'

  return {
    id: s.id,
    result,
    boardSize: s.boardSize,
    moveCount: s.moveCount,
    date: formatRelativeDate(s.startedAt),
    opponent: 'vs AI',
  }
}

function summariesToStatInput(summaries: readonly GameSummaryDTO[]): GameStatInput[] {
  return summaries.map((s) => ({
    result: s.result,
    boardSize: s.boardSize,
    startedAt: s.startedAt,
    moveCount: s.moveCount,
  }))
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const EMPTY_STATS: PlayerStats = {
  winRate: 0,
  totalGames: 0,
  currentStreak: 0,
  bestStreak: 0,
}

export function useGameHistory(): GameHistoryState {
  const [games, setGames] = useState<RecentGame[]>([])
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS)
  const [boardSizeStats, setBoardSizeStats] = useState<BoardSizeStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const summaries = await listGamesFromStorage(50)
      const recentGames = summaries.map(summaryToRecentGame)
      const statInputs = summariesToStatInput(summaries)

      const winRate = calcWinRate(statInputs)
      const streak = calcStreak(statInputs)
      const bySizeStats = calcWinRateByBoardSize(statInputs)

      setGames(recentGames)
      setStats({
        winRate,
        totalGames: summaries.length,
        currentStreak: streak.current,
        bestStreak: streak.best,
      })
      setBoardSizeStats(bySizeStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { games, stats, boardSizeStats, isLoading, error, refresh }
}
