// =============================================================================
// GameRepository — CRUD operations for the `games` and `moves` tables
// =============================================================================
// All database access is routed through Tauri invoke() commands.
// In tests, invoke() is mocked via vi.mock('@tauri-apps/api/core').
//
// Layer: Infrastructure (Layer 1)
// Depends on: IStoragePort (core/interfaces.ts), schema types (db/schema)
// =============================================================================

import type {
  BoardSize,
  GameFilter,
  GameMode,
  GameRecord,
  GameSummary,
  MoveRecord,
  NewGamePayload,
  Result,
  RulesetString,
  StorageError,
} from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'

// ---------------------------------------------------------------------------
// Tauri invoke abstraction — replaced by vi.mock in tests
// ---------------------------------------------------------------------------

/**
 * Dynamic import of Tauri's invoke function.
 * At runtime this calls the Rust-side SQLite commands.
 * In tests this is replaced by vi.mock('@tauri-apps/api/core').
 */
async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

// ---------------------------------------------------------------------------
// Raw DB row shapes returned by Tauri Rust commands
// ---------------------------------------------------------------------------

interface GameRow {
  id: string
  user_id: string
  board_size: number
  rules: string
  komi: number
  mode: string
  result: string | null
  started_at: number
  ended_at: number | null
}

interface MoveRowRaw {
  game_id: string
  move_number: number
  player: string
  coordinate: string | null
  timestamp: number
}

// ---------------------------------------------------------------------------
// Row -> domain type converters
// ---------------------------------------------------------------------------

function rowToGameSummary(row: GameRow, moveCount: number): GameSummary {
  return {
    gameId: row.id,
    boardSize: row.board_size as BoardSize,
    mode: row.mode as GameMode,
    result: row.result,
    moveCount,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function rawMoveToMoveRecord(raw: MoveRowRaw): MoveRecord {
  return {
    moveNumber: raw.move_number,
    player: raw.player as 'B' | 'W',
    // coordinate is GTP notation (e.g., "C4"); index is computed during replay
    index: null,
    coordinate: raw.coordinate,
    timestamp: raw.timestamp,
    captures: [],
  }
}

function rowToGameRecord(row: GameRow, moves: MoveRecord[]): GameRecord {
  return {
    gameId: row.id,
    userId: row.user_id,
    boardSize: row.board_size as BoardSize,
    rules: row.rules as RulesetString,
    komi: row.komi,
    mode: row.mode as GameMode,
    result: row.result,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    moves,
  }
}

// ---------------------------------------------------------------------------
// GameRepository
// ---------------------------------------------------------------------------

export class GameRepository {
  /**
   * Save a new game record to storage.
   * Corresponds to INSERT INTO games (...).
   */
  async saveGame(payload: NewGamePayload): Promise<Result<string, StorageError>> {
    try {
      const gameId = crypto.randomUUID()
      await tauriInvoke('storage_save_game', {
        id: gameId,
        userId: payload.userId,
        boardSize: payload.boardSize,
        rules: payload.rules,
        komi: payload.komi,
        mode: payload.mode,
        startedAt: Math.floor(Date.now() / 1000),
      })
      return Ok(gameId)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to save game: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Load a complete game record (metadata + moves) by ID.
   */
  async loadGame(gameId: string): Promise<Result<GameRecord | null, StorageError>> {
    try {
      const row = await tauriInvoke<GameRow | null>('storage_load_game', { gameId })
      if (!row) return Ok(null)

      const rawMoves = await tauriInvoke<MoveRowRaw[]>('storage_get_moves', { gameId })
      const moves = rawMoves.map(rawMoveToMoveRecord)
      return Ok(rowToGameRecord(row, moves))
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'READ_FAILED' as const,
        message: `Failed to load game ${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * List game summaries with optional filtering.
   */
  async listGames(filter?: GameFilter): Promise<Result<readonly GameSummary[], StorageError>> {
    try {
      const rows = await tauriInvoke<Array<GameRow & { move_count: number }>>(
        'storage_list_games',
        {
          mode: filter?.mode,
          boardSize: filter?.boardSize,
          completed: filter?.completed,
          limit: filter?.limit,
          offset: filter?.offset,
        }
      )
      const summaries = rows.map((row) => rowToGameSummary(row, row.move_count))
      return Ok(summaries)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'READ_FAILED' as const,
        message: `Failed to list games: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Delete a game and all cascaded data (moves, analysis).
   */
  async deleteGame(gameId: string): Promise<Result<void, StorageError>> {
    try {
      const deleted = await tauriInvoke<boolean>('storage_delete_game', { gameId })
      if (!deleted) {
        return Err({
          module: 'storage' as const,
          code: 'NOT_FOUND' as const,
          message: `Game ${gameId} not found`,
        })
      }
      return Ok(undefined)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to delete game ${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Append a single move to the move log (append-only).
   */
  async appendMove(gameId: string, move: MoveRecord): Promise<Result<void, StorageError>> {
    try {
      await tauriInvoke('storage_append_move', {
        gameId,
        moveNumber: move.moveNumber,
        player: move.player,
        coordinate: move.coordinate,
        timestamp: move.timestamp,
      })
      return Ok(undefined)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to append move to game ${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Get all moves for a game, ordered by move_number ascending.
   */
  async getMoves(gameId: string): Promise<Result<readonly MoveRecord[], StorageError>> {
    try {
      const rawMoves = await tauriInvoke<MoveRowRaw[]>('storage_get_moves', { gameId })
      return Ok(rawMoves.map(rawMoveToMoveRecord))
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'READ_FAILED' as const,
        message: `Failed to get moves for game ${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Update a game's result and end timestamp (called when game finishes).
   */
  async updateGameResult(
    gameId: string,
    result: string,
    endedAt: number
  ): Promise<Result<void, StorageError>> {
    try {
      await tauriInvoke('storage_update_game_result', { gameId, result, endedAt })
      return Ok(undefined)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to update result for game ${gameId}: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
}
