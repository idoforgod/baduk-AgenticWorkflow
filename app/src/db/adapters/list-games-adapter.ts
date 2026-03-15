// =============================================================================
// db/adapters/list-games-adapter.ts — List games from Tauri SQLite
// =============================================================================
// Anti-Hallucination L1: Validates invoke result with GameSummarySchema (Zod).
// =============================================================================

import { z } from 'zod'
import { type GameSummaryDTO, GameSummarySchema } from '../schema/storage-schemas'

/**
 * List game summaries from Tauri SQLite, with Zod validation.
 */
export async function listGamesFromStorage(limit = 50, offset = 0): Promise<GameSummaryDTO[]> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    // Tauri invoke maps second arg keys to Rust fn parameters.
    // Rust: storage_list_games(state: State, filter: GameFilter)
    const raw = await invoke<unknown[]>('storage_list_games', {
      filter: {
        userId: 'default-user',
        limit,
        offset,
      },
    })

    // Anti-Hallucination L1: Zod validation for each item
    return z.array(GameSummarySchema).parse(raw)
  } catch (err) {
    console.error('[list-games-adapter] Failed to list games:', err)
    return []
  }
}
