// =============================================================================
// db/adapters/save-game-adapter.ts — Save game to Tauri SQLite
// =============================================================================
// Reads full game state from useGameStore and persists via storage_save_game.
//
// Anti-Hallucination: Validates payload with SaveGamePayloadSchema (Zod)
// before sending to Rust. Any field mismatch throws at runtime.
//
// This adapter BYPASSES GameRepository because:
//   1. GameRepository.saveGame() generates a new gameId (conflicts with store's)
//   2. GameRepository calls non-existent Rust commands (storage_append_move, etc.)
//   3. Direct invoke with Zod validation is simpler and safer
//
// Layer: Infrastructure adapter
// Depends on: db/schema/storage-schemas, game-engine/store (read-only)
// =============================================================================

import { useGameStore } from '../../game-engine/store'
import { type SaveGamePayloadDTO, SaveGamePayloadSchema } from '../schema/storage-schemas'

/**
 * Build a SaveGamePayload from the current game store state.
 * Validates via Zod before returning.
 *
 * @throws {ZodError} if the payload doesn't match the Rust struct contract
 */
export function buildSavePayload(gameId: string): SaveGamePayloadDTO {
  const state = useGameStore.getState()

  const raw = {
    id: gameId,
    userId: 'default-user',
    boardSize: state.boardSize,
    rules: state.config?.rules ?? 'tromp-taylor',
    komi: state.config?.komi ?? (state.boardSize === 9 ? 5.5 : 7.5),
    mode: state.config?.mode ?? 'vs-ai',
    result: state.result?.resultString ?? null,
    startedAt: state.startedAt ?? Math.floor(Date.now() / 1000),
    endedAt: state.status === 'finished' ? Math.floor(Date.now() / 1000) : null,
    moves: state.moveHistory.map((m) => ({
      moveNumber: m.moveNumber,
      player: m.player,
      coordinate: m.coordinate,
      timestamp: m.timestamp,
    })),
  }

  // Anti-Hallucination L1: Zod validation before invoke
  return SaveGamePayloadSchema.parse(raw)
}

/**
 * Save the current game to Tauri SQLite storage.
 * Called by the store's saveGameFn injection.
 *
 * @returns true if save succeeded, false otherwise
 */
export async function saveGameToStorage(gameId: string): Promise<boolean> {
  try {
    const payload = buildSavePayload(gameId)
    const { invoke } = await import('@tauri-apps/api/core')
    // Tauri invoke maps second arg keys to Rust fn parameters.
    // Rust: storage_save_game(state: State, payload: SaveGamePayload)
    // 'state' is auto-injected by Tauri, so we pass { payload: ... }
    await invoke('storage_save_game', { payload })
    return true
  } catch (err) {
    console.error('[save-game-adapter] Failed to save game:', err)
    return false
  }
}

/**
 * Factory function that creates a saveGameFn compatible with
 * configureGameStore's second parameter signature:
 *   (gameId: string, moves: MoveRecord[]) => Promise<boolean>
 *
 * The `moves` parameter is ignored because we read the full state
 * from useGameStore.getState() inside buildSavePayload().
 * This ensures ALL fields (result, config, startedAt, etc.) are included.
 */
export function createSaveGameFn(): (gameId: string) => Promise<boolean> {
  return saveGameToStorage
}
