// =============================================================================
// hooks/useCoaching.ts — React Hook for Coaching Messages
// =============================================================================
// Subscribes to useAnalysisStore and useGameStore.
// On analysis update, generates coaching messages via the coaching adapter.
// Manages PlayerContext state across moves.
// =============================================================================

import type { PlayerColor } from '@core/interfaces'
import { useEffect, useRef, useState } from 'react'
import { generateCoachingMessage } from '../coaching/coaching-adapter'
import type { CoachingMessage, PlayerContext } from '../coaching/types'
import { useGameStore } from '../game-engine/store'
import { BLACK, WHITE } from '../rules-engine/board'
import { useAnalysisStore } from './useAnalysisStore'

// =============================================================================
// Initial Player Context
// =============================================================================

const INITIAL_CONTEXT: PlayerContext = {
  encouragementState: 'neutral',
  consecutiveGoodMoves: 0,
  consecutiveBadMoves: 0,
  previousMoveQuality: null,
  previousWinrate: null,
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook that produces coaching messages from KataGo analysis + board state.
 *
 * Subscribes to:
 *   - useAnalysisStore: current/previous AnalysisResponse
 *   - useGameStore: board grid, move history, board size
 *
 * Returns an array of recent coaching messages (max 20 retained).
 */
export function useCoaching() {
  const [messages, setMessages] = useState<CoachingMessage[]>([])
  const contextRef = useRef<PlayerContext>(INITIAL_CONTEXT)
  const lastProcessedMoveRef = useRef<number>(-1)

  // Subscribe to analysis store
  const currentAnalysis = useAnalysisStore((s) => s.current)
  const previousAnalysis = useAnalysisStore((s) => s.previous)
  const analysisMoveNumber = useAnalysisStore((s) => s.moveNumber)

  // Subscribe to game store — only reactive dependencies that trigger coaching
  const status = useGameStore((s) => s.status)

  // Reset on new game
  useEffect(() => {
    if (status === 'not_started') {
      setMessages([])
      contextRef.current = INITIAL_CONTEXT
      lastProcessedMoveRef.current = -1
    }
  }, [status])

  // Generate coaching message when analysis updates
  useEffect(() => {
    if (!currentAnalysis || status !== 'playing') return

    // Read game state snapshot (non-reactive — avoids unnecessary re-renders)
    const { board, boardSize, moveHistory } = useGameStore.getState()

    if (moveHistory.length === 0) return
    if (analysisMoveNumber === lastProcessedMoveRef.current) return

    lastProcessedMoveRef.current = analysisMoveNumber

    // Get the last move info
    const lastMove = moveHistory[moveHistory.length - 1]
    if (!lastMove) return

    const lastMoveIndex = lastMove.index ?? -1
    const actualMove = lastMove.coordinate ?? null
    const moveNumber = lastMove.moveNumber

    // Determine the player who just played
    const player: PlayerColor = lastMove.player === 'B' ? BLACK : WHITE

    // Get ownership from current analysis (if available)
    const ownership = currentAnalysis.ownership ?? null

    // Generate coaching message
    const { message, updatedContext } = generateCoachingMessage(
      currentAnalysis,
      previousAnalysis,
      actualMove,
      moveNumber,
      board,
      boardSize,
      lastMoveIndex,
      player,
      ownership,
      contextRef.current
    )

    // Update context
    contextRef.current = updatedContext

    // Append message, keep max 20
    setMessages((prev) => {
      const updated = [...prev, message]
      return updated.length > 20 ? updated.slice(-20) : updated
    })
  }, [currentAnalysis, previousAnalysis, analysisMoveNumber, status])

  return { messages }
}
