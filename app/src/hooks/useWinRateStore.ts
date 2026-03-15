// =============================================================================
// hooks/useWinRateStore.ts — Win Rate History Store
// =============================================================================
// Dedicated zustand store for accumulating per-move win rate data.
// Written to by both useKataGoAnalysis (human turn analysis) and
// useAiOpponent (AI turn analysis). Read by GameScreen for display.
//
// Separation rationale: win rate tracking is orthogonal to both
// candidate move display and AI move selection. A dedicated store
// avoids coupling those concerns and prevents duplicate analysis requests.
//
// Extension: lastGameHistory preserves the previous game's win rate data
// for the "Last Game Highlights" dashboard feature (session-only).
// =============================================================================

import { create } from 'zustand'

export interface WinRateDataPoint {
  move: number
  blackWinRate: number
}

interface WinRateStore {
  /** Current game's win rate history */
  history: WinRateDataPoint[]
  /** Latest win rate value */
  currentWinRate: number | null
  /** Previous game's win rate history (session-only, not persisted) */
  lastGameHistory: WinRateDataPoint[]
  /** Add a data point to the current game */
  addDataPoint: (move: number, blackWinRate: number) => void
  /** Archive current history to lastGameHistory, then reset current */
  archiveCurrentGame: () => void
  /** Reset current game data (does NOT clear lastGameHistory) */
  reset: () => void
}

export const useWinRateStore = create<WinRateStore>()((set) => ({
  history: [],
  currentWinRate: null,
  lastGameHistory: [],

  addDataPoint(move, blackWinRate) {
    set((state) => {
      // Deduplicate: replace if same move number already exists
      const filtered = state.history.filter((p) => p.move !== move)
      return {
        history: [...filtered, { move, blackWinRate }].sort((a, b) => a.move - b.move),
        currentWinRate: blackWinRate,
      }
    })
  },

  archiveCurrentGame() {
    set((state) => ({
      lastGameHistory: state.history.length > 0 ? [...state.history] : state.lastGameHistory,
      history: [],
      currentWinRate: null,
    }))
  },

  reset() {
    set({ history: [], currentWinRate: null })
  },
}))
