// =============================================================================
// db/adapters/load-game-adapter.ts — Load game from Tauri SQLite
// =============================================================================
// Anti-Hallucination L1: Validates invoke result with GameRecordSchema (Zod).
// =============================================================================

import type { BoardSize, GameConfig, GameMode, MoveRecord, RulesetString } from '@core/interfaces'
import { type GameRecordDTO, GameRecordSchema } from '../schema/storage-schemas'

/**
 * Load a game record from Tauri SQLite, with Zod validation.
 * Returns null if the game doesn't exist.
 */
export async function loadGameFromStorage(
  gameId: string
): Promise<{ config: GameConfig; moves: MoveRecord[] } | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await invoke<GameRecordDTO | null>('storage_load_game', { gameId })
    if (!raw) return null

    // Anti-Hallucination L1: Zod validation
    const record = GameRecordSchema.parse(raw)

    const config: GameConfig = {
      boardSize: record.boardSize as BoardSize,
      komi: record.komi,
      rules: record.rules as RulesetString,
      mode: record.mode as GameMode,
    }

    const moves: MoveRecord[] = record.moves.map((m) => ({
      moveNumber: m.moveNumber,
      player: m.player as 'B' | 'W',
      index: null, // Will be resolved during replay via coordinate
      coordinate: m.coordinate,
      timestamp: m.timestamp,
      captures: [],
    }))

    return { config, moves }
  } catch (err) {
    console.error('[load-game-adapter] Failed to load game:', err)
    return null
  }
}
