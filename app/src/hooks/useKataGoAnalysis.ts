// =============================================================================
// hooks/useKataGoAnalysis.ts — KataGo position analysis hook
// =============================================================================
// Runs KataGo analysis on the human's turn (Black) to show candidate moves.
//
// Hallucination prevention:
//   All analysis routes through KataGoService.analyze() which calls
//   parseAnalysisResponse() → Zod-validated MoveInfo/RootInfo fields.
//   No raw invoke() with TypeScript type assertions.
//
// Lifecycle:
//   KataGo initialization is handled by useKataGoInit() (called in GameScreen).
//   This hook only performs analysis via the shared KataGoService singleton.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AnalysisQuery, KataGoMove } from '../core/interfaces'
import { useGameStore } from '../game-engine/store'
import { extractTopMoves } from '../katago-bridge/response-parser'
import { useAnalysisStore } from './useAnalysisStore'
import { getKataGoService } from './useKataGo'
import { useWinRateStore } from './useWinRateStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CandidateMove {
  /** GTP coordinate (e.g. "D4") */
  move: string
  /** Board index */
  index: number
  /** Win rate 0-100 */
  winRate: number
  /** Score lead (positive = good for current player) */
  scoreLead: number
  /** Visit count (search depth) */
  visits: number
  /** Prior policy probability 0-100 */
  prior: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook that runs KataGo position analysis on the human's turn (Black).
 * Returns candidate moves for board overlay and an analyzing flag for UI state.
 *
 * @param serviceReady - Reactive signal from useKataGoInit(). When init completes
 *   (idle/initializing → ready), this flips to true and triggers the analysis effect.
 *   Without this parameter, the effect has no reactive dependency on init completion
 *   and would miss the first analysis opportunity (P0 bug fix).
 *
 * Data flow: KataGoService.analyze() → parseAnalysisResponse() → extractTopMoves()
 * All fields are Zod-validated before reaching this hook.
 */
export function useKataGoAnalysis(serviceReady: boolean) {
  const [candidates, setCandidates] = useState<CandidateMove[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryIdRef = useRef(0)
  const analyzingRef = useRef(false) // Synchronous guard against concurrent analysis (P1 fix)

  const boardSize = useGameStore((s) => s.boardSize)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const moveHistory = useGameStore((s) => s.moveHistory)
  const status = useGameStore((s) => s.status)
  const config = useGameStore((s) => s.config)

  const addWinRateDataPoint = useWinRateStore((s) => s.addDataPoint)
  const resetWinRate = useWinRateStore((s) => s.reset)

  // Run analysis via validated KataGoService pipeline
  const analyze = useCallback(async () => {
    // P1 fix: synchronous re-entry guard — React state updates are async,
    // so isAnalyzing alone cannot prevent concurrent analyze() calls.
    if (analyzingRef.current) return
    const service = getKataGoService()
    if (!service.isHealthy() || status !== 'playing') return

    queryIdRef.current += 1
    const qid = `analysis-${queryIdRef.current}`

    // Build moves in KataGo format: [["B","D4"],["W","Q16"],...]
    const moves = moveHistory.map((m): KataGoMove => [m.player, m.coordinate ?? 'pass'])

    const query: AnalysisQuery = {
      id: qid,
      moves,
      rules: 'tromp-taylor',
      boardXSize: boardSize,
      boardYSize: boardSize,
      komi: config?.komi ?? 7.5,
      maxVisits: 50,
    }

    analyzingRef.current = true
    setIsAnalyzing(true)
    try {
      // Route through KataGoService.analyze() → parseAnalysisResponse() → Zod validation
      const result = await service.analyze(query)

      if (result.ok) {
        // Extract top 5 candidates from validated response
        const top5 = extractTopMoves(result.value, 5).map((mi) => ({
          move: mi.move,
          index: gtpToIndex(mi.move, boardSize),
          winRate: Math.round(mi.winrate * 1000) / 10,
          scoreLead: Math.round(mi.scoreLead * 10) / 10,
          visits: mi.visits,
          prior: Math.round(mi.prior * 1000) / 10,
        }))

        setCandidates(top5)

        // Feed coaching system with validated analysis response
        useAnalysisStore.getState().setAnalysis(result.value, moveHistory.length)

        // Record win rate to shared store (Black's perspective)
        const { winrate: rootWinrate, currentPlayer: rootCurrentPlayer } = result.value.rootInfo
        const blackWinRate =
          rootCurrentPlayer === 'B'
            ? Math.round(rootWinrate * 1000) / 10
            : Math.round((1 - rootWinrate) * 1000) / 10
        addWinRateDataPoint(moveHistory.length, blackWinRate)
      } else {
        console.error('KataGo analysis failed:', result.error.message)
        setCandidates([])
      }
    } catch (e) {
      console.error('KataGo analysis error:', e)
      setError(String(e))
      setCandidates([])
    } finally {
      analyzingRef.current = false
      setIsAnalyzing(false)
    }
  }, [status, moveHistory, boardSize, config, addWinRateDataPoint])

  // Trigger analysis when it's the human's turn (Black)
  // P0 fix: serviceReady is a reactive dependency that flips when useKataGoInit()
  // transitions from 'initializing' to 'ready'. Without this, the effect would
  // never re-fire after init completes (imperatively checking service.isHealthy()
  // is not reactive — React doesn't know when the service state changes).
  useEffect(() => {
    if (currentPlayer !== 'B' || status !== 'playing' || !serviceReady) return

    // Small delay to let the board render first
    const timeout = setTimeout(() => {
      analyze()
    }, 100)

    return () => clearTimeout(timeout)
  }, [currentPlayer, status, moveHistory.length, serviceReady, analyze])

  // Clear candidates when game ends or not playing
  useEffect(() => {
    if (status !== 'playing') {
      setCandidates([])
    }
    if (status === 'not_started') {
      resetWinRate()
      useAnalysisStore.getState().reset()
    }
  }, [status, resetWinRate])

  return { candidates, isAnalyzing, error }
}

// ---------------------------------------------------------------------------
// GTP coordinate to board index converter
// ---------------------------------------------------------------------------
function gtpToIndex(gtp: string, boardSize: number): number {
  if (!gtp || gtp.toLowerCase() === 'pass') return -1
  const letters = 'ABCDEFGHJKLMNOPQRST'
  const col = letters.indexOf(gtp[0].toUpperCase())
  if (col === -1) return -1
  const rowNumber = parseInt(gtp.slice(1), 10)
  if (Number.isNaN(rowNumber)) return -1
  const row = boardSize - rowNumber
  return row * boardSize + col
}
