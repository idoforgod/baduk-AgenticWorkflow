import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameStore } from '../game-engine/store'

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

type KataGoState = 'idle' | 'initializing' | 'ready' | 'analyzing' | 'failed'

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKataGoAnalysis() {
  const [candidates, setCandidates] = useState<CandidateMove[]>([])
  const [kataGoState, setKataGoState] = useState<KataGoState>('idle')
  const [error, setError] = useState<string | null>(null)
  const queryIdRef = useRef(0)
  const initAttemptedRef = useRef(false)

  const board = useGameStore((s) => s.board)
  const boardSize = useGameStore((s) => s.boardSize)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const moveHistory = useGameStore((s) => s.moveHistory)
  const status = useGameStore((s) => s.status)
  const config = useGameStore((s) => s.config)

  // Initialize KataGo on first game start
  useEffect(() => {
    if (status !== 'playing' || initAttemptedRef.current) return
    initAttemptedRef.current = true

    async function init() {
      setKataGoState('initializing')
      try {
        // Rust backend resolves resource paths internally — we just pass config options
        await invoke('katago_initialize', {
          config: {
            configPath: '',
            modelPath: '',
            humanModelPath: null,
            analysisThreads: 1,
          },
        })
        setKataGoState('ready')
        setError(null)
      } catch (e) {
        console.error('KataGo init failed:', e)
        setKataGoState('failed')
        setError(String(e))
      }
    }
    init()

    return () => {
      invoke('katago_shutdown').catch(() => {})
    }
  }, [status])

  // Run analysis after each move
  const analyze = useCallback(async () => {
    if (kataGoState !== 'ready' || status !== 'playing') return

    queryIdRef.current += 1
    const qid = `analysis-${queryIdRef.current}`

    // Build moves array in KataGo format: [["B","D4"],["W","Q16"],...]
    const moves: [string, string][] = moveHistory.map((m) => [m.player, m.coordinate ?? 'pass'])

    setKataGoState('analyzing')
    try {
      const response = await invoke<{
        moveInfos: Array<{
          move: string
          visits: number
          winrate: number
          scoreLead: number
          prior: number
          order: number
        }>
        rootInfo: { winrate: number; scoreLead: number; visits: number }
      }>('katago_analyze', {
        query: {
          id: qid,
          moves,
          rules: 'tromp-taylor',
          boardXSize: boardSize,
          boardYSize: boardSize,
          komi: config?.komi ?? 7.5,
          maxVisits: 50,
          rootPolicyTemperature: null,
          includeOwnership: false,
          analyzeTurns: null,
          priority: 0,
          initialStones: null,
          overrideSettings: null,
        },
      })

      // Parse top 5 candidates from moveInfos
      const top5 = (response.moveInfos || []).slice(0, 5).map((mi) => {
        const moveName = mi.move ?? 'pass'
        const idx = gtpToIndex(moveName, boardSize)
        return {
          move: moveName,
          index: idx,
          winRate: Math.round((mi.winrate ?? 0.5) * 1000) / 10,
          scoreLead: Math.round((mi.scoreLead ?? 0) * 10) / 10,
          visits: mi.visits ?? 0,
          prior: Math.round((mi.prior ?? 0) * 1000) / 10,
        }
      })

      setCandidates(top5)
      setKataGoState('ready')
    } catch (e) {
      console.error('KataGo analysis failed:', e)
      setKataGoState('ready') // Don't set failed — allow retry
      setCandidates([])
    }
  }, [kataGoState, status, moveHistory, boardSize, config])

  // Trigger analysis when it's the human's turn (Black)
  useEffect(() => {
    if (currentPlayer !== 'B' || status !== 'playing' || kataGoState !== 'ready') return

    // Small delay to let the board render first
    const timeout = setTimeout(() => {
      analyze()
    }, 100)

    return () => clearTimeout(timeout)
  }, [currentPlayer, status, kataGoState, moveHistory.length, analyze])

  // Clear candidates when game ends or not playing
  useEffect(() => {
    if (status !== 'playing') {
      setCandidates([])
    }
  }, [status])

  return { candidates, kataGoState, error }
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
