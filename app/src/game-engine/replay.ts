// =============================================================================
// game-engine/replay.ts — Pure function for replaying moves
// =============================================================================
// Extracts the common "replay moves from initial board" logic used by:
//   - store.ts: goToMove(), undo(), loadGameData()
//   - useReviewStore: loadGame(), goToMove()
//
// This is a pure function with no side effects. It takes an IRulesEngine,
// a board size, and a list of moves, then returns the reconstructed state.
//
// Layer: Domain logic (pure)
// Depends on: core/interfaces (types only)
// =============================================================================

import type { BoardSize, GameConfig, GameState, IRulesEngine, MoveRecord } from '@core/interfaces'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface ReplayResult {
  /** Reconstructed board as Uint8Array */
  board: Uint8Array
  /** Current player after replaying all moves */
  currentPlayer: 'B' | 'W'
  /** Number of consecutive passes at end of replay */
  consecutivePasses: number
  /** Ko point (forbidden intersection), or null */
  ko: number | null
  /** Black captures accumulated during replay */
  blackCaptures: number
  /** White captures accumulated during replay */
  whiteCaptures: number
  /** Set of all position hashes encountered */
  positionHashes: Set<bigint>
  /** The game phase after replay */
  phase: 'setup' | 'playing' | 'scoring' | 'finished'
}

// ---------------------------------------------------------------------------
// replayMoves — Pure function
// ---------------------------------------------------------------------------

/**
 * Replay a sequence of moves on a fresh board, returning the final state.
 *
 * This is the single source of truth for "given these moves, what does
 * the board look like?" Used by both the active game store and the
 * review-only store to ensure consistent behavior.
 *
 * @param rulesEngine - The injected rules engine instance
 * @param boardSize - Board dimensions (9, 13, or 19)
 * @param moves - Move records to replay, in order
 * @param config - Optional game config (for rules engine)
 * @returns The reconstructed board state after all moves
 */
export function replayMoves(
  rulesEngine: IRulesEngine,
  boardSize: BoardSize,
  moves: readonly MoveRecord[],
  config?: GameConfig
): ReplayResult {
  const initialBoard = rulesEngine.createBoard(boardSize)

  let gameState: GameState = {
    gameId: '',
    config: config ?? {
      boardSize,
      komi: boardSize === 9 ? 5.5 : 7.5,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
    },
    board: initialBoard,
    currentPlayer: 'B',
    moves: [],
    currentMoveIndex: 0,
    phase: 'playing',
    consecutivePasses: 0,
    positionHashes: new Set([initialBoard.hash]),
    koPoint: null,
    captures: { black: 0, white: 0 },
    timer: null,
  }

  for (const move of moves) {
    if (move.index === null && move.coordinate === null) {
      // Pass move
      const passResult = rulesEngine.applyPass(gameState)
      if (passResult.ok) gameState = passResult.value
    } else {
      // Stone placement — resolve index from coordinate if needed
      let moveIndex = move.index
      if (moveIndex === null && move.coordinate !== null) {
        moveIndex = gtpToIndexInternal(move.coordinate, boardSize)
      }
      if (moveIndex !== null && moveIndex >= 0) {
        const moveResult = rulesEngine.applyMove(gameState, moveIndex)
        if (moveResult.ok) gameState = moveResult.value
      }
    }
  }

  return {
    board: new Uint8Array(gameState.board.grid),
    currentPlayer: gameState.currentPlayer,
    consecutivePasses: gameState.consecutivePasses,
    ko: gameState.koPoint,
    blackCaptures: gameState.captures.black,
    whiteCaptures: gameState.captures.white,
    positionHashes: new Set(gameState.positionHashes),
    phase: gameState.phase,
  }
}

// ---------------------------------------------------------------------------
// Internal GTP coordinate helper (avoid circular import from store.ts)
// ---------------------------------------------------------------------------

/**
 * Convert GTP notation to board index. Returns -1 for invalid/pass.
 * Duplicated here to avoid circular dependency with store.ts.
 */
function gtpToIndexInternal(gtp: string, boardSize: BoardSize): number {
  if (!gtp || gtp.length === 0 || gtp.toLowerCase() === 'pass') return -1
  const letters = 'ABCDEFGHJKLMNOPQRST'
  const firstChar = gtp[0]
  if (!firstChar) return -1
  const col = letters.indexOf(firstChar.toUpperCase())
  if (col === -1) return -1
  const rowNumber = parseInt(gtp.slice(1), 10)
  if (Number.isNaN(rowNumber)) return -1
  const row = boardSize - rowNumber
  return row * boardSize + col
}
