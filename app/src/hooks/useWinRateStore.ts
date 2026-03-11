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
// =============================================================================

import { create } from 'zustand'

export interface WinRateDataPoint {
  move: number
  blackWinRate: number
}

interface WinRateStore {
  history: WinRateDataPoint[]
  currentWinRate: number | null
  addDataPoint: (move: number, blackWinRate: number) => void
  reset: () => void
}

export const useWinRateStore = create<WinRateStore>()((set) => ({
  history: [],
  currentWinRate: null,

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

  reset() {
    set({ history: [], currentWinRate: null })
  },
}))
