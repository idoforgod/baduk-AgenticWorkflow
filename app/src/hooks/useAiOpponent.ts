import type { GameState } from '@core/interfaces'
import { invoke } from '@tauri-apps/api/core'
import { useEffect } from 'react'
import { indexToGTP, useGameStore } from '../game-engine/store'
import { createRulesEngine } from '../rules-engine'

const rulesEngine = createRulesEngine()

/**
 * Hook that automatically plays an AI move when it's White's turn.
 *
 * Strategy:
 * 1. If KataGo is available → use KataGo analysis to pick the best move
 * 2. Fallback → weighted random (for when KataGo is offline)
 */
export function useAiOpponent() {
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const status = useGameStore((s) => s.status)

  useEffect(() => {
    if (currentPlayer !== 'W' || status !== 'playing') return

    const timeout = setTimeout(async () => {
      const s = useGameStore.getState()
      if (s.currentPlayer !== 'W' || s.status !== 'playing') return

      // Try KataGo first
      const kataGoMove = await tryKataGoMove(s)
      if (kataGoMove !== null) {
        if (kataGoMove === -1) {
          s.pass()
        } else {
          s.playMove(kataGoMove)
        }
        return
      }

      // Fallback: random AI
      playRandomMove(s)
    }, 400)

    return () => clearTimeout(timeout)
  }, [currentPlayer, status])
}

/**
 * Try to get a move from KataGo. Returns board index, -1 for pass, or null if unavailable.
 */
async function tryKataGoMove(s: ReturnType<typeof useGameStore.getState>): Promise<number | null> {
  try {
    // Check KataGo status
    const katagoStatus = await invoke<string>('katago_get_status')
    if (katagoStatus !== 'Ready' && katagoStatus !== 'Analyzing') {
      return null
    }

    // Build moves in KataGo format
    const moves: [string, string][] = s.moveHistory.map((m) => [m.player, m.coordinate ?? 'pass'])

    const response = await invoke<{
      moveInfos: Array<{
        move: string
        visits: number
        winrate: number
        scoreLead: number
        order: number
      }>
    }>('katago_analyze', {
      query: {
        id: `ai-move-${Date.now()}`,
        moves,
        rules: 'tromp-taylor',
        boardXSize: s.boardSize,
        boardYSize: s.boardSize,
        komi: s.config?.komi ?? 7.5,
        maxVisits: 200, // Strong play
        rootPolicyTemperature: null,
        includeOwnership: false,
        analyzeTurns: null,
        priority: 10, // High priority for AI moves
        initialStones: null,
        overrideSettings: null,
      },
    })

    if (response.moveInfos && response.moveInfos.length > 0) {
      const bestMove = response.moveInfos[0]
      if (bestMove.move === 'pass') return -1
      return gtpToIndex(bestMove.move, s.boardSize)
    }

    return null
  } catch {
    // KataGo unavailable — fall back to random
    return null
  }
}

/** Fallback random move picker */
function playRandomMove(s: ReturnType<typeof useGameStore.getState>) {
  const gameState: GameState = {
    gameId: s.gameId ?? '',
    config: s.config ?? {
      boardSize: s.boardSize,
      komi: 7.5,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
    },
    board: {
      size: s.boardSize,
      grid: s.board,
      hash: s.hashHistory.length > 0 ? s.hashHistory[s.hashHistory.length - 1] : 0n,
    },
    currentPlayer: s.currentPlayer,
    moves: s.moveHistory,
    currentMoveIndex: s.moveHistory.length,
    phase: s.phase,
    consecutivePasses: s.consecutivePasses,
    positionHashes: new Set(s.hashHistory),
    koPoint: s.ko,
    captures: s.captures,
    timer: null,
  }

  const legalMoves = rulesEngine.getLegalMoves(gameState)
  if (legalMoves.length === 0) {
    s.pass()
    return
  }

  // Weighted random: prefer 3rd/4th line
  const weighted = legalMoves.map((index) => {
    const row = Math.floor(index / s.boardSize)
    const col = index % s.boardSize
    const distFromEdge = Math.min(row, col, s.boardSize - 1 - row, s.boardSize - 1 - col)
    if (distFromEdge === 0) return { index, weight: 1 }
    if (distFromEdge === 1) return { index, weight: 2 }
    if (distFromEdge === 2) return { index, weight: 4 }
    return { index, weight: 3 }
  })

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
  let pick = Math.random() * totalWeight
  let chosen = weighted[0].index
  for (const w of weighted) {
    pick -= w.weight
    if (pick <= 0) {
      chosen = w.index
      break
    }
  }

  s.playMove(chosen)
}

/** GTP coordinate to board index */
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
