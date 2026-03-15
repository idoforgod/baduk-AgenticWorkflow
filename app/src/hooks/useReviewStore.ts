// =============================================================================
// hooks/useReviewStore.ts — Review-only game store (AnalysisScreen)
// =============================================================================
// Completely independent from useGameStore. Loading a saved game for review
// does NOT affect the active game in GameScreen.
//
// Uses replayMoves() shared pure function for board reconstruction.
//
// SOT: This store is the SOT for review/analysis state.
//      useGameStore is the SOT for active game state.
//      They never read from or write to each other.
// =============================================================================

import type { BoardSize, IRulesEngine, MoveRecord } from '@core/interfaces'
import { create } from 'zustand'
import { replayMoves } from '../game-engine/replay'
import { createRulesEngine } from '../rules-engine'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface ReviewStoreState {
  /** Unique game identifier */
  gameId: string | null
  /** Board as Uint8Array (reconstructed via replayMoves) */
  board: Uint8Array
  /** Active board size */
  boardSize: BoardSize
  /** Full move history of the loaded game */
  moveHistory: MoveRecord[]
  /** Current review position (0 = initial, moveHistory.length = final) */
  currentMoveIndex: number
  /** Current player at review position */
  currentPlayer: 'B' | 'W'
  /** Whether a game is loaded */
  isLoaded: boolean
  /** Loading state */
  isLoading: boolean
}

interface ReviewStoreActions {
  /** Load a game from storage adapter result */
  loadGame(gameId: string, moves: MoveRecord[], boardSize: BoardSize): void
  /** Navigate to a specific move in the review */
  goToMove(moveNumber: number): void
  /** Reset the review store */
  reset(): void
}

type ReviewStore = ReviewStoreState & ReviewStoreActions

// ---------------------------------------------------------------------------
// Rules engine instance (review-only, separate from game store's)
// ---------------------------------------------------------------------------

let _reviewRulesEngine: IRulesEngine | null = null

function getReviewRulesEngine(): IRulesEngine {
  if (!_reviewRulesEngine) {
    _reviewRulesEngine = createRulesEngine()
  }
  return _reviewRulesEngine
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const INITIAL_SIZE: BoardSize = 9

export const useReviewStore = create<ReviewStore>()((set, get) => ({
  gameId: null,
  board: new Uint8Array(INITIAL_SIZE * INITIAL_SIZE),
  boardSize: INITIAL_SIZE,
  moveHistory: [],
  currentMoveIndex: 0,
  currentPlayer: 'B',
  isLoaded: false,
  isLoading: false,

  loadGame(gameId, moves, boardSize) {
    const engine = getReviewRulesEngine()
    const result = replayMoves(engine, boardSize, moves)

    set({
      gameId,
      board: result.board,
      boardSize,
      moveHistory: [...moves],
      currentMoveIndex: moves.length,
      currentPlayer: result.currentPlayer,
      isLoaded: true,
      isLoading: false,
    })
  },

  goToMove(moveNumber) {
    const state = get()
    const clamped = Math.max(0, Math.min(moveNumber, state.moveHistory.length))
    const targetMoves = state.moveHistory.slice(0, clamped)

    const engine = getReviewRulesEngine()
    const result = replayMoves(engine, state.boardSize, targetMoves)

    set({
      board: result.board,
      currentMoveIndex: clamped,
      currentPlayer: result.currentPlayer,
    })
  },

  reset() {
    set({
      gameId: null,
      board: new Uint8Array(INITIAL_SIZE * INITIAL_SIZE),
      boardSize: INITIAL_SIZE,
      moveHistory: [],
      currentMoveIndex: 0,
      currentPlayer: 'B',
      isLoaded: false,
      isLoading: false,
    })
  },
}))
