// =============================================================================
// hooks/useExplanation.ts — React Hook for Move Explanation
// =============================================================================
// Subscribes to useAnalysisStore and useGameStore.
// On analysis update, generates tier-based explanations via ExplanationEngine.
// Follows the same Store → Hook → Component pattern as useCoaching.
// =============================================================================

import type { ExplanationOutput, Tier } from '@core/interfaces'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createExplanationEngine } from '../explanation-engine/explanation-engine'
import { useGameStore } from '../game-engine/store'
import { useAnalysisStore } from './useAnalysisStore'

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook that produces move explanations from KataGo analysis.
 *
 * Subscribes to:
 *   - useAnalysisStore: current/previous AnalysisResponse
 *   - useGameStore: moveHistory, boardSize, status
 *
 * Returns the current explanation, selected tier, and tier change handler.
 */
export function useExplanation() {
  const [tier, setTier] = useState<Tier>('beginner')
  const [explanation, setExplanation] = useState<ExplanationOutput | null>(null)
  const engineRef = useRef(createExplanationEngine())
  const lastProcessedMoveRef = useRef<number>(-1)
  const tierLoadedRef = useRef(false)

  // Restore persisted tier from storage on first mount
  useEffect(() => {
    if (tierLoadedRef.current) return
    tierLoadedRef.current = true
    import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke<string | null>('storage_get_setting', { key: 'explanation_tier' })
      )
      .then((saved) => {
        if (saved === 'beginner' || saved === 'intermediate' || saved === 'advanced') {
          setTier(saved)
        }
      })
      .catch(() => {
        // Storage unavailable (e.g., in tests) — use default
      })
  }, [])

  // Subscribe to analysis store
  const currentAnalysis = useAnalysisStore((s) => s.current)
  const previousAnalysis = useAnalysisStore((s) => s.previous)
  const analysisMoveNumber = useAnalysisStore((s) => s.moveNumber)

  // Subscribe to game store
  const status = useGameStore((s) => s.status)

  // Reset on new game
  useEffect(() => {
    if (status === 'not_started') {
      setExplanation(null)
      lastProcessedMoveRef.current = -1
      engineRef.current = createExplanationEngine()
    }
  }, [status])

  // Generate explanation when analysis updates
  useEffect(() => {
    if (!currentAnalysis || status !== 'playing') return

    const { moveHistory, boardSize } = useGameStore.getState()

    if (moveHistory.length === 0) return
    if (analysisMoveNumber === lastProcessedMoveRef.current) return

    lastProcessedMoveRef.current = analysisMoveNumber

    const lastMove = moveHistory[moveHistory.length - 1]
    if (!lastMove) return

    const actualMove = lastMove.coordinate ?? null
    const turnNumber = lastMove.moveNumber

    const result = engineRef.current.explain(
      currentAnalysis,
      previousAnalysis,
      actualMove,
      tier,
      turnNumber,
      boardSize
    )

    if (result.ok) {
      setExplanation(result.value)
    }
  }, [currentAnalysis, previousAnalysis, analysisMoveNumber, status, tier])

  const onTierChange = useCallback((newTier: Tier) => {
    setTier(newTier)

    // Persist tier to storage (fire-and-forget)
    // Note: storage_set_setting accepts serde_json::Value, so pass the string directly
    // Do NOT wrap in JSON.stringify — Rust serde will handle serialization
    import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        invoke('storage_set_setting', { key: 'explanation_tier', value: newTier })
      )
      .catch(() => {})

    // Re-explain with new tier if we have analysis data
    const { current, previous } = useAnalysisStore.getState()
    if (!current) return

    const { moveHistory, boardSize } = useGameStore.getState()
    if (moveHistory.length === 0) return

    const lastMove = moveHistory[moveHistory.length - 1]
    if (!lastMove) return

    const result = engineRef.current.explain(
      current,
      previous,
      lastMove.coordinate ?? null,
      newTier,
      lastMove.moveNumber,
      boardSize
    )

    if (result.ok) {
      setExplanation(result.value)
    }
  }, [])

  return { explanation, tier, onTierChange }
}
