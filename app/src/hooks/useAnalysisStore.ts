// =============================================================================
// hooks/useAnalysisStore.ts — Shared Analysis Response Store
// =============================================================================
// Dedicated zustand store for sharing the latest KataGo AnalysisResponse
// across the coaching system and future consumers.
//
// Written to by both useKataGoAnalysis (human turn) and useAiOpponent (AI turn).
// Read by useCoaching for coaching message generation.
//
// Pattern: identical to useWinRateStore — a dedicated store to decouple
// analysis data flow from the hooks that produce it.
// =============================================================================

import type { AnalysisResponse } from '@core/interfaces'
import { create } from 'zustand'

interface AnalysisStore {
  /** Current analysis response (latest) */
  current: AnalysisResponse | null
  /** Previous analysis response (one move earlier) */
  previous: AnalysisResponse | null
  /** Move number when the current analysis was recorded */
  moveNumber: number
  /** Update with a new analysis response */
  setAnalysis: (response: AnalysisResponse, moveNumber: number) => void
  /** Reset store (e.g., on new game) */
  reset: () => void
}

export const useAnalysisStore = create<AnalysisStore>()((set) => ({
  current: null,
  previous: null,
  moveNumber: 0,

  setAnalysis(response, moveNumber) {
    set((state) => ({
      previous: state.current,
      current: response,
      moveNumber,
    }))
  },

  reset() {
    set({ current: null, previous: null, moveNumber: 0 })
  },
}))
