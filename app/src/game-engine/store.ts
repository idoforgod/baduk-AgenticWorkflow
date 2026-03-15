// =============================================================================
// game-engine/store.ts — GameReducer Zustand Store
// =============================================================================
// This is the central in-memory game state manager.
// It uses dependency injection (IRulesEngine) rather than direct imports.
//
// Architecture decision: The store does NOT import the rules-engine module.
// The rules engine is injected at runtime via `configureGameStore()`.
// This enables testing with mock rules engines and respects the module boundary.
//
// Layer: Application (Layer 3)
// Depends on: core/interfaces, game-engine/types
// Does NOT depend on: rules-engine (injected), storage (injected via saveGame)
// =============================================================================

import type {
  BoardSize,
  BoardState,
  GameConfig,
  GameResult,
  IRulesEngine,
  MoveRecord,
  Player,
} from '@core/interfaces'
import { create } from 'zustand'
import type { GameStore, GameStoreState } from './types'

// ---------------------------------------------------------------------------
// Injected dependencies (set once at app bootstrap)
// ---------------------------------------------------------------------------

let _rulesEngine: IRulesEngine | null = null
let _saveGameFn: ((gameId: string, moves: MoveRecord[]) => Promise<boolean>) | null = null

/**
 * Configure the game store with its required dependencies.
 * Must be called before any store actions are invoked.
 * Called once at app startup in main.tsx after DI setup.
 */
export function configureGameStore(
  rulesEngine: IRulesEngine,
  saveGameFn?: (gameId: string, moves: MoveRecord[]) => Promise<boolean>
): void {
  _rulesEngine = rulesEngine
  _saveGameFn = saveGameFn ?? null
}

/** Get the injected rules engine or throw if not configured */
function getRulesEngine(): IRulesEngine {
  if (!_rulesEngine) {
    throw new Error('GameStore: IRulesEngine not configured. Call configureGameStore() first.')
  }
  return _rulesEngine
}

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

/** Create an empty flat board Uint8Array of the given size */
function createEmptyBoard(size: BoardSize): Uint8Array {
  return new Uint8Array(size * size)
}

/**
 * Convert Zustand store board + metadata to a BoardState for the rules engine.
 * Builds a fake Zobrist hash from the last element of hashHistory.
 */
function toBoardState(state: GameStoreState): BoardState {
  return {
    size: state.boardSize,
    grid: state.board,
    hash: state.hashHistory.length > 0 ? state.hashHistory[state.hashHistory.length - 1] : 0n,
  }
}

/**
 * Reconstruct a GameState object that IRulesEngine methods expect.
 * IRulesEngine.applyMove / applyPass accept a GameState, not just a BoardState.
 */
function toGameState(state: GameStoreState): import('@core/interfaces').GameState {
  return {
    gameId: state.gameId ?? '',
    config: state.config ?? {
      boardSize: state.boardSize,
      komi: 7.5,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
    },
    board: toBoardState(state),
    currentPlayer: state.currentPlayer,
    moves: state.moveHistory,
    currentMoveIndex: state.currentMoveIndex,
    phase: state.phase,
    consecutivePasses: state.consecutivePasses,
    positionHashes: new Set(state.hashHistory),
    koPoint: state.ko,
    captures: state.captures,
    timer: state.timer,
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_BOARD_SIZE: BoardSize = 9

const initialState: GameStoreState = {
  gameId: null,
  config: null,
  board: createEmptyBoard(INITIAL_BOARD_SIZE),
  boardSize: INITIAL_BOARD_SIZE,
  currentPlayer: 'B',
  consecutivePasses: 0,
  ko: null,
  moveHistory: [],
  hashHistory: [],
  currentMoveIndex: 0,
  captures: { black: 0, white: 0 },
  startedAt: null,
  status: 'not_started',
  result: null,
  timer: null,
  phase: 'setup',
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useGameStore = create<GameStore>()((set, get) => ({
  ...initialState,

  // -------------------------------------------------------------------------
  // createGame — initialize a new game
  // -------------------------------------------------------------------------
  createGame(boardSize: BoardSize, komi: number, configOverride?: Partial<GameConfig>): void {
    const rulesEngine = getRulesEngine()
    const boardState = rulesEngine.createBoard(boardSize)
    const gameId = crypto.randomUUID()

    const config: GameConfig = {
      boardSize,
      komi,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
      ...configOverride,
    }

    set({
      gameId,
      config,
      board: new Uint8Array(boardState.grid),
      boardSize,
      currentPlayer: 'B',
      consecutivePasses: 0,
      ko: null,
      moveHistory: [],
      hashHistory: [boardState.hash],
      currentMoveIndex: 0,
      captures: { black: 0, white: 0 },
      startedAt: Math.floor(Date.now() / 1000),
      status: 'playing',
      result: null,
      timer: null,
      phase: 'playing',
    })
  },

  // -------------------------------------------------------------------------
  // playMove — place a stone at the given board index
  // -------------------------------------------------------------------------
  playMove(index: number): { success: boolean; error?: string } {
    const state = get()
    if (state.status !== 'playing') {
      return { success: false, error: 'Game is not active' }
    }

    const rulesEngine = getRulesEngine()
    const gameState = toGameState(state)

    if (!rulesEngine.isLegalMove(gameState, index)) {
      return { success: false, error: 'Illegal move' }
    }

    const result = rulesEngine.applyMove(gameState, index)
    if (!result.ok) {
      return { success: false, error: result.error.message }
    }

    const newGameState = result.value
    const newBoardGrid = new Uint8Array(newGameState.board.grid)

    // Use authoritative capture counts from the rules engine result
    const blackCaptures = newGameState.captures.black
    const whiteCaptures = newGameState.captures.white

    const moveRecord: MoveRecord = {
      moveNumber: state.moveHistory.length,
      player: state.currentPlayer,
      index,
      coordinate: indexToGTP(index, state.boardSize),
      timestamp: Math.floor(Date.now() / 1000),
      captures: newGameState.moves[newGameState.moves.length - 1]?.captures ?? [],
    }

    const newStatus = newGameState.phase === 'finished' ? 'finished' : 'playing'

    set({
      board: newBoardGrid,
      currentPlayer: newGameState.currentPlayer,
      consecutivePasses: newGameState.consecutivePasses,
      ko: newGameState.koPoint,
      moveHistory: [...state.moveHistory, moveRecord],
      hashHistory: [...state.hashHistory, newGameState.board.hash],
      currentMoveIndex: state.moveHistory.length + 1,
      captures: { black: blackCaptures, white: whiteCaptures },
      status: newStatus,
      phase: newGameState.phase,
    })

    return { success: true }
  },

  // -------------------------------------------------------------------------
  // pass — pass the current turn
  // -------------------------------------------------------------------------
  pass(): { success: boolean; error?: string } {
    const state = get()
    if (state.status !== 'playing') {
      return { success: false, error: 'Game is not active' }
    }

    const rulesEngine = getRulesEngine()
    const gameState = toGameState(state)
    const result = rulesEngine.applyPass(gameState)
    if (!result.ok) {
      return { success: false, error: result.error.message }
    }

    const newGameState = result.value

    const moveRecord: MoveRecord = {
      moveNumber: state.moveHistory.length,
      player: state.currentPlayer,
      index: null,
      coordinate: null,
      timestamp: Math.floor(Date.now() / 1000),
      captures: [],
    }

    const newStatus = newGameState.phase === 'finished' ? 'finished' : 'playing'
    const newConsecutivePasses = newGameState.consecutivePasses

    set({
      currentPlayer: newGameState.currentPlayer,
      consecutivePasses: newConsecutivePasses,
      ko: null,
      moveHistory: [...state.moveHistory, moveRecord],
      hashHistory: [...state.hashHistory, newGameState.board.hash],
      currentMoveIndex: state.moveHistory.length + 1,
      status: newStatus,
      phase: newGameState.phase,
    })

    return { success: true }
  },

  // -------------------------------------------------------------------------
  // resign — end the game by resignation
  // -------------------------------------------------------------------------
  resign(color: Player): void {
    const winner: Player = color === 'B' ? 'W' : 'B'
    const resultString = `${winner}+R`

    const gameResult: GameResult = {
      winner,
      resultString,
      score: null,
      endReason: 'resignation',
    }

    set({
      status: 'finished',
      phase: 'finished',
      result: gameResult,
    })
  },

  // -------------------------------------------------------------------------
  // undo — revert the last move
  // -------------------------------------------------------------------------
  undo(): { success: boolean } {
    const state = get()
    if (state.moveHistory.length === 0) {
      return { success: false }
    }

    const rulesEngine = getRulesEngine()

    // Replay moves 0..N-2 from the initial board to reconstruct state
    const movesToReplay = state.moveHistory.slice(0, -1)
    const newBoard = rulesEngine.createBoard(state.boardSize)

    let replayState: import('@core/interfaces').GameState = {
      gameId: state.gameId ?? '',
      config: state.config ?? {
        boardSize: state.boardSize,
        komi: 7.5,
        rules: 'tromp-taylor',
        mode: 'vs-ai',
      },
      board: newBoard,
      currentPlayer: 'B',
      moves: [],
      currentMoveIndex: 0,
      phase: 'playing',
      consecutivePasses: 0,
      positionHashes: new Set([newBoard.hash]),
      koPoint: null,
      captures: { black: 0, white: 0 },
      timer: null,
    }

    let blackCaptures = 0
    let whiteCaptures = 0

    for (const move of movesToReplay) {
      if (move.index === null) {
        const passResult = rulesEngine.applyPass(replayState)
        if (passResult.ok) replayState = passResult.value
      } else {
        const moveResult = rulesEngine.applyMove(replayState, move.index)
        if (moveResult.ok) {
          // Count captures
          const prevGrid = replayState.board.grid
          const newGrid = moveResult.value.board.grid
          for (let i = 0; i < newGrid.length; i++) {
            if (prevGrid[i] !== 0 && newGrid[i] === 0) {
              if (replayState.currentPlayer === 'B') blackCaptures++
              else whiteCaptures++
            }
          }
          replayState = moveResult.value
        }
      }
    }

    set({
      board: new Uint8Array(replayState.board.grid),
      currentPlayer: replayState.currentPlayer,
      consecutivePasses: replayState.consecutivePasses,
      ko: replayState.koPoint,
      moveHistory: movesToReplay,
      hashHistory: Array.from(replayState.positionHashes),
      currentMoveIndex: movesToReplay.length,
      captures: { black: blackCaptures, white: whiteCaptures },
      status: 'playing',
      phase: 'playing',
    })

    return { success: true }
  },

  // -------------------------------------------------------------------------
  // loadGameData — restore game from persisted records
  // -------------------------------------------------------------------------
  loadGameData(gameId: string, moves: MoveRecord[], config: GameConfig): void {
    const rulesEngine = getRulesEngine()
    const initialBoard = rulesEngine.createBoard(config.boardSize)

    let replayState: import('@core/interfaces').GameState = {
      gameId,
      config,
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

    let blackCaptures = 0
    let whiteCaptures = 0

    for (const move of moves) {
      // Detect pass: both index and coordinate are null
      const isPass = move.index === null && move.coordinate === null
      if (isPass) {
        const passResult = rulesEngine.applyPass(replayState)
        if (passResult.ok) replayState = passResult.value
      } else {
        // Resolve index: use move.index if available, otherwise convert from coordinate
        let moveIndex = move.index
        if (moveIndex === null && move.coordinate !== null) {
          moveIndex = gtpToIndex(move.coordinate, config.boardSize)
        }
        if (moveIndex !== null) {
          const moveResult = rulesEngine.applyMove(replayState, moveIndex)
          if (moveResult.ok) {
            replayState = moveResult.value
            blackCaptures = replayState.captures.black
            whiteCaptures = replayState.captures.white
          }
        }
      }
    }

    set({
      gameId,
      config,
      board: new Uint8Array(replayState.board.grid),
      boardSize: config.boardSize,
      currentPlayer: replayState.currentPlayer,
      consecutivePasses: replayState.consecutivePasses,
      ko: replayState.koPoint,
      moveHistory: [...moves],
      hashHistory: Array.from(replayState.positionHashes),
      currentMoveIndex: moves.length,
      captures: { black: blackCaptures, white: whiteCaptures },
      status: replayState.phase === 'finished' ? 'finished' : 'playing',
      result: null,
      timer: null,
      phase: replayState.phase,
    })
  },

  // -------------------------------------------------------------------------
  // saveGame — persist to storage via injected save function
  // -------------------------------------------------------------------------
  async saveGame(): Promise<{ success: boolean; gameId?: string }> {
    const state = get()
    if (!state.gameId || !_saveGameFn) {
      return { success: false }
    }
    try {
      const ok = await _saveGameFn(state.gameId, state.moveHistory)
      return { success: ok, gameId: state.gameId }
    } catch {
      return { success: false }
    }
  },

  // -------------------------------------------------------------------------
  // goToMove — review mode navigation
  // -------------------------------------------------------------------------
  goToMove(moveNumber: number): void {
    const state = get()
    const targetMoves = state.moveHistory.slice(0, moveNumber)
    const rulesEngine = getRulesEngine()
    const initialBoard = rulesEngine.createBoard(state.boardSize)

    let replayState: import('@core/interfaces').GameState = {
      gameId: state.gameId ?? '',
      config: state.config ?? {
        boardSize: state.boardSize,
        komi: 7.5,
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

    for (const move of targetMoves) {
      if (move.index === null) {
        const r = rulesEngine.applyPass(replayState)
        if (r.ok) replayState = r.value
      } else {
        const r = rulesEngine.applyMove(replayState, move.index)
        if (r.ok) replayState = r.value
      }
    }

    set({
      board: new Uint8Array(replayState.board.grid),
      currentPlayer: replayState.currentPlayer,
      currentMoveIndex: moveNumber,
    })
  },

  // -------------------------------------------------------------------------
  // setResult — record the final game result
  // -------------------------------------------------------------------------
  setResult(result: GameResult): void {
    set({ result, status: 'finished', phase: 'finished' })
  },

  // -------------------------------------------------------------------------
  // reset — clear all state
  // -------------------------------------------------------------------------
  reset(): void {
    set({ ...initialState, board: createEmptyBoard(INITIAL_BOARD_SIZE) })
  },
}))

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/**
 * Convert a board index to GTP notation (e.g., index 0 on 9x9 = "A9").
 * GTP skips the letter 'I' to avoid confusion with '1'.
 */
export function indexToGTP(index: number, boardSize: BoardSize): string {
  const col = index % boardSize
  const row = Math.floor(index / boardSize)
  // GTP columns: A B C D E F G H J K ...
  const letters = 'ABCDEFGHJKLMNOPQRST'
  const colLetter = letters[col]
  // GTP row 1 is the bottom row; in our array row 0 = top
  const rowNumber = boardSize - row
  return `${colLetter}${rowNumber}`
}

/**
 * Convert GTP notation to board index.
 * Returns -1 for invalid input or pass.
 */
export function gtpToIndex(gtp: string, boardSize: BoardSize): number {
  if (!gtp || gtp.toLowerCase() === 'pass') return -1
  const letters = 'ABCDEFGHJKLMNOPQRST'
  const colLetter = gtp[0].toUpperCase()
  const col = letters.indexOf(colLetter)
  if (col === -1) return -1
  const rowNumber = parseInt(gtp.slice(1), 10)
  if (Number.isNaN(rowNumber)) return -1
  const row = boardSize - rowNumber
  return row * boardSize + col
}
