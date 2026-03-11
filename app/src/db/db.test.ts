// =============================================================================
// db.test.ts — Repository CRUD Tests
// =============================================================================
// Tests for GameRepository and SettingsRepository.
// Tauri invoke() is mocked — no actual DB or Tauri runtime required.
//
// Test count target: 15+
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock @tauri-apps/api/core BEFORE importing repositories
// ---------------------------------------------------------------------------

const mockInvokeMap: Map<string, unknown> = new Map()
const mockInvokeFn = vi.fn(async (command: string, _args?: Record<string, unknown>) => {
  if (mockInvokeMap.has(command)) {
    return mockInvokeMap.get(command)
  }
  return undefined
})

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvokeFn,
}))

// Import after mock is set up
import { GameRepository } from './repositories/game-repository'
import { SettingsRepository } from './repositories/settings-repository'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGameRow(
  overrides: Partial<{
    id: string
    user_id: string
    board_size: number
    rules: string
    komi: number
    mode: string
    result: string | null
    started_at: number
    ended_at: number | null
    move_count: number
  }> = {}
) {
  return {
    id: 'game-uuid-1',
    user_id: 'user-uuid-1',
    board_size: 9,
    rules: 'tromp-taylor',
    komi: 6.5,
    mode: 'vs-ai',
    result: null,
    started_at: 1700000000,
    ended_at: null,
    move_count: 0,
    ...overrides,
  }
}

function makeMoveRow(
  overrides: Partial<{
    game_id: string
    move_number: number
    player: string
    coordinate: string | null
    timestamp: number
  }> = {}
) {
  return {
    game_id: 'game-uuid-1',
    move_number: 0,
    player: 'B',
    coordinate: 'D4',
    timestamp: 1700000010,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// GameRepository tests
// ---------------------------------------------------------------------------

describe('GameRepository', () => {
  let repo: GameRepository

  beforeEach(() => {
    repo = new GameRepository()
    mockInvokeMap.clear()
    mockInvokeFn.mockClear()
  })

  // --- saveGame ---

  it('saveGame: returns a non-empty game ID on success', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    const result = await repo.saveGame({
      userId: 'user-1',
      boardSize: 9,
      rules: 'tromp-taylor',
      komi: 6.5,
      mode: 'vs-ai',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toMatch(/^[0-9a-f-]{36}$/)
    }
  })

  it('saveGame: calls storage_save_game Tauri command', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    await repo.saveGame({
      userId: 'user-1',
      boardSize: 9,
      rules: 'tromp-taylor',
      komi: 6.5,
      mode: 'vs-ai',
    })
    expect(mockInvokeFn).toHaveBeenCalledWith(
      'storage_save_game',
      expect.objectContaining({ boardSize: 9 })
    )
  })

  it('saveGame: returns Err on Tauri error', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('DB locked'))
    const result = await repo.saveGame({
      userId: 'user-1',
      boardSize: 9,
      rules: 'tromp-taylor',
      komi: 6.5,
      mode: 'vs-ai',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('WRITE_FAILED')
      expect(result.error.module).toBe('storage')
    }
  })

  // --- loadGame ---

  it('loadGame: returns null when game is not found', async () => {
    mockInvokeFn.mockResolvedValueOnce(null) // storage_load_game returns null
    const result = await repo.loadGame('nonexistent-id')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeNull()
    }
  })

  it('loadGame: returns a GameRecord with moves on success', async () => {
    const row = makeGameRow({ id: 'game-1', board_size: 9 })
    const moveRow = makeMoveRow({ game_id: 'game-1', coordinate: 'D4' })
    mockInvokeFn
      .mockResolvedValueOnce(row) // storage_load_game
      .mockResolvedValueOnce([moveRow]) // storage_get_moves
    const result = await repo.loadGame('game-1')
    expect(result.ok).toBe(true)
    if (result.ok && result.value) {
      expect(result.value.gameId).toBe('game-1')
      expect(result.value.boardSize).toBe(9)
      expect(result.value.moves).toHaveLength(1)
      expect(result.value.moves[0].coordinate).toBe('D4')
    }
  })

  it('loadGame: returns Err on DB read failure', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Read error'))
    const result = await repo.loadGame('game-1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('READ_FAILED')
    }
  })

  // --- listGames ---

  it('listGames: returns empty array when no games exist', async () => {
    mockInvokeFn.mockResolvedValueOnce([])
    const result = await repo.listGames()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(0)
    }
  })

  it('listGames: returns correct GameSummary shape', async () => {
    const rows = [
      makeGameRow({ id: 'g1', result: 'B+R', ended_at: 1700001000, move_count: 42 }),
      makeGameRow({ id: 'g2', result: null, move_count: 15 }),
    ]
    mockInvokeFn.mockResolvedValueOnce(rows)
    const result = await repo.listGames()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0].gameId).toBe('g1')
      expect(result.value[0].result).toBe('B+R')
      expect(result.value[0].moveCount).toBe(42)
      expect(result.value[1].gameId).toBe('g2')
    }
  })

  it('listGames: passes filter to Tauri command', async () => {
    mockInvokeFn.mockResolvedValueOnce([])
    await repo.listGames({ mode: 'vs-ai', boardSize: 9, limit: 10 })
    expect(mockInvokeFn).toHaveBeenCalledWith(
      'storage_list_games',
      expect.objectContaining({ mode: 'vs-ai', boardSize: 9, limit: 10 })
    )
  })

  // --- deleteGame ---

  it('deleteGame: returns Ok on successful deletion', async () => {
    mockInvokeFn.mockResolvedValueOnce(true)
    const result = await repo.deleteGame('game-1')
    expect(result.ok).toBe(true)
  })

  it('deleteGame: returns NOT_FOUND when game does not exist', async () => {
    mockInvokeFn.mockResolvedValueOnce(false)
    const result = await repo.deleteGame('nonexistent')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND')
    }
  })

  // --- appendMove ---

  it('appendMove: calls storage_append_move with correct args', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    const move = {
      moveNumber: 0,
      player: 'B' as const,
      index: 30,
      coordinate: 'D4',
      timestamp: 1700000010,
      captures: [],
    }
    await repo.appendMove('game-1', move)
    expect(mockInvokeFn).toHaveBeenCalledWith(
      'storage_append_move',
      expect.objectContaining({
        gameId: 'game-1',
        player: 'B',
        coordinate: 'D4',
      })
    )
  })

  it('appendMove: returns Err on write failure', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Constraint violation'))
    const move = {
      moveNumber: 0,
      player: 'B' as const,
      index: 30,
      coordinate: 'D4',
      timestamp: 1700000010,
      captures: [],
    }
    const result = await repo.appendMove('game-1', move)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('WRITE_FAILED')
    }
  })

  // --- getMoves ---

  it('getMoves: returns correctly mapped MoveRecords', async () => {
    const rawMoves = [
      makeMoveRow({ move_number: 0, player: 'B', coordinate: 'D4' }),
      makeMoveRow({ move_number: 1, player: 'W', coordinate: 'Q16' }),
    ]
    mockInvokeFn.mockResolvedValueOnce(rawMoves)
    const result = await repo.getMoves('game-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0].player).toBe('B')
      expect(result.value[0].coordinate).toBe('D4')
      expect(result.value[1].player).toBe('W')
    }
  })

  it('getMoves: maps pass moves (null coordinate) correctly', async () => {
    const rawMoves = [makeMoveRow({ move_number: 0, player: 'B', coordinate: null })]
    mockInvokeFn.mockResolvedValueOnce(rawMoves)
    const result = await repo.getMoves('game-1')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0].coordinate).toBeNull()
      expect(result.value[0].index).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// SettingsRepository tests
// ---------------------------------------------------------------------------

describe('SettingsRepository', () => {
  let repo: SettingsRepository

  beforeEach(() => {
    repo = new SettingsRepository()
    mockInvokeFn.mockClear()
  })

  it('getSetting: returns null when key is not set', async () => {
    mockInvokeFn.mockResolvedValueOnce(null)
    const result = await repo.getSetting('nonexistent-key')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeNull()
    }
  })

  it('getSetting: returns the raw JSON string on success', async () => {
    mockInvokeFn.mockResolvedValueOnce('"dark"')
    const result = await repo.getSetting('theme')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('"dark"')
    }
  })

  it('getSetting: returns Err on DB read failure', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('DB error'))
    const result = await repo.getSetting('theme')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('READ_FAILED')
      expect(result.error.module).toBe('storage')
    }
  })

  it('setSetting: calls storage_set_setting with key and value', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    await repo.setSetting('theme', '"dark"')
    expect(mockInvokeFn).toHaveBeenCalledWith('storage_set_setting', {
      key: 'theme',
      value: '"dark"',
    })
  })

  it('setSetting: returns Err on write failure', async () => {
    mockInvokeFn.mockRejectedValueOnce(new Error('Disk full'))
    const result = await repo.setSetting('theme', '"dark"')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('WRITE_FAILED')
    }
  })

  it('getSettingWithDefault: returns default when key is null', async () => {
    mockInvokeFn.mockResolvedValueOnce(null)
    const result = await repo.getSettingWithDefault('aiDifficulty', 5)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(5)
    }
  })

  it('getSettingWithDefault: parses JSON value when key exists', async () => {
    mockInvokeFn.mockResolvedValueOnce('15')
    const result = await repo.getSettingWithDefault<number>('aiDifficulty', 5)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(15)
    }
  })

  it('getSettingWithDefault: returns default when stored value is corrupted JSON', async () => {
    mockInvokeFn.mockResolvedValueOnce('{ not valid json')
    const result = await repo.getSettingWithDefault('aiDifficulty', 5)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(5)
    }
  })

  it('setTypedSetting: serializes value to JSON and stores', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    await repo.setTypedSetting('aiDifficulty', 15)
    expect(mockInvokeFn).toHaveBeenCalledWith('storage_set_setting', {
      key: 'aiDifficulty',
      value: '15',
    })
  })

  it('setTypedSetting: can store complex objects', async () => {
    mockInvokeFn.mockResolvedValueOnce(undefined)
    await repo.setTypedSetting('timeControl', { main: 180, byoyomi: 10, periods: 3 })
    expect(mockInvokeFn).toHaveBeenCalledWith('storage_set_setting', {
      key: 'timeControl',
      value: '{"main":180,"byoyomi":10,"periods":3}',
    })
  })
})
