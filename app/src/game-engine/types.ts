// =============================================================================
// game-engine/types.ts — Game engine internal types
// =============================================================================
// These types extend the shared core interfaces with game-engine-specific
// shapes needed by the Zustand store and SGF export.
// =============================================================================

import type {
  BoardSize,
  GameConfig,
  GamePhase,
  GameResult,
  MoveRecord,
  Player,
  TimerState,
} from '@core/interfaces'

// ---------------------------------------------------------------------------
// Zustand Store Shape
// ---------------------------------------------------------------------------

/**
 * The Zustand GameReducer store state shape.
 * This is the canonical in-memory representation of an active game.
 *
 * Design notes:
 * - `board` is stored as Uint8Array for memory efficiency (Step 3 spec).
 * - `hashHistory` stores the sequence of Zobrist hashes for superko detection.
 * - Undo is supported by keeping the full move history and replaying.
 */
export interface GameStoreState {
  // --- Identity ---
  /** Null before game starts */
  gameId: string | null
  /** Configuration (board size, komi, rules, mode) */
  config: GameConfig | null

  // --- Board ---
  /** Flat 1D board array. grid[row * size + col] = CellState (0/1/2) */
  board: Uint8Array
  /** Active board size */
  boardSize: BoardSize

  // --- Turn ---
  currentPlayer: Player
  /** Number of consecutive passes (2 = game ends per DKS C15) */
  consecutivePasses: number
  /** Ko point: board index forbidden for next move, or null */
  ko: number | null

  // --- History ---
  /** Append-only move list (DKS R25: FollowedBy ordering) */
  moveHistory: MoveRecord[]
  /** Sequence of Zobrist hashes for superko detection (DKS C08) */
  hashHistory: bigint[]
  /** Current move index for review mode navigation */
  currentMoveIndex: number

  // --- Captures ---
  captures: { black: number; white: number }

  // --- Lifecycle ---
  status: 'not_started' | 'playing' | 'scoring' | 'finished'
  result: GameResult | null
  timer: TimerState | null
  phase: GamePhase
}

// ---------------------------------------------------------------------------
// Store Actions
// ---------------------------------------------------------------------------

export interface GameStoreActions {
  /** Initialize a new game with the given configuration */
  createGame(boardSize: BoardSize, komi: number, config?: Partial<GameConfig>): void
  /** Place a stone (delegates validation to rules engine) */
  playMove(index: number): { success: boolean; error?: string }
  /** Pass the current turn */
  pass(): { success: boolean; error?: string }
  /** Resign (the given player loses) */
  resign(color: Player): void
  /** Undo the last move (restores previous board state) */
  undo(): { success: boolean }
  /** Load a game from storage data */
  loadGameData(gameId: string, moves: MoveRecord[], config: GameConfig): void
  /** Persist the current state to storage (returns async result) */
  saveGame(): Promise<{ success: boolean; gameId?: string }>
  /** Navigate to a specific move in review mode */
  goToMove(moveNumber: number): void
  /** Set the game result (called after scoring) */
  setResult(result: GameResult): void
  /** Reset the store to initial state */
  reset(): void
}

/** Combined Zustand store type */
export type GameStore = GameStoreState & GameStoreActions

// ---------------------------------------------------------------------------
// SGF Export Types
// ---------------------------------------------------------------------------

/** Input to the SGF export function */
export interface SGFExportInput {
  gameId: string
  boardSize: BoardSize
  komi: number
  rules: string
  blackPlayerName?: string
  whitePlayerName?: string
  result?: string
  moves: readonly MoveRecord[]
  date?: string
}
