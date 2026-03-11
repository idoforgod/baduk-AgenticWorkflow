// =============================================================================
// game-engine.test.ts — GameReducer State Transition Tests
// =============================================================================
// Tests the Zustand store (GameReducer) using a mock IRulesEngine.
// No actual rules-engine module is imported — verifies DI contract.
//
// Test count target: 30+
// =============================================================================

import type {
  BoardSize,
  BoardState,
  GameState,
  Group,
  IRulesEngine,
  Result,
  RulesError,
  ScoreResult,
  TerritoryMap,
} from '@core/interfaces'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { configureGameStore, gtpToIndex, indexToGTP, useGameStore } from './store'

// ---------------------------------------------------------------------------
// Mock IRulesEngine
// ---------------------------------------------------------------------------

function makeBoardState(size: BoardSize, cells?: number[]): BoardState {
  const grid = new Uint8Array(size * size)
  if (cells) {
    for (let i = 0; i < cells.length; i++) {
      grid[i] = cells[i]
    }
  }
  return { size, grid, hash: BigInt(cells ? cells.join('') : '0') || 0n }
}

/**
 * Creates a minimal mock IRulesEngine suitable for store tests.
 * All methods return sensible defaults; individual tests can override.
 */
function createMockRulesEngine(): IRulesEngine {
  const createBoard = vi.fn((size: BoardSize): BoardState => makeBoardState(size))

  const isLegalMove = vi.fn((_state: GameState, _index: number): boolean => true)

  const getLegalMoves = vi.fn((_state: GameState): number[] => [0, 1, 2, 3])

  const applyMove = vi.fn((state: GameState, index: number): Result<GameState, RulesError> => {
    // Simple mock: place the stone and switch player
    const newGrid = new Uint8Array(state.board.grid)
    newGrid[index] = state.currentPlayer === 'B' ? 1 : 2
    const newBoard: BoardState = {
      size: state.board.size,
      grid: newGrid,
      hash: BigInt(index + 1),
    }
    const newState: GameState = {
      ...state,
      board: newBoard,
      currentPlayer: state.currentPlayer === 'B' ? 'W' : 'B',
      consecutivePasses: 0,
      koPoint: null,
      positionHashes: new Set([...state.positionHashes, BigInt(index + 1)]),
      moves: [...state.moves],
    }
    return { ok: true, value: newState }
  })

  const applyPass = vi.fn((state: GameState): Result<GameState, RulesError> => {
    const newConsecutivePasses = state.consecutivePasses + 1
    const phase = newConsecutivePasses >= 2 ? 'finished' : state.phase
    const newState: GameState = {
      ...state,
      currentPlayer: state.currentPlayer === 'B' ? 'W' : 'B',
      consecutivePasses: newConsecutivePasses,
      phase,
      koPoint: null,
    }
    return { ok: true, value: newState }
  })

  const computeScore = vi.fn(
    (): ScoreResult => ({
      blackScore: 45,
      whiteScore: 30,
      komi: 6.5,
      scoreDifferential: 8.5,
      winner: 'B',
      territory: {
        black: new Set([0, 1, 2]),
        white: new Set([78, 79, 80]),
        dame: new Set(),
      },
      dameCount: 0,
    })
  )

  const isGameOver = vi.fn((state: GameState): boolean => state.phase === 'finished')

  const getGroup = vi.fn((): Group | null => null)

  const getTerritory = vi.fn(
    (): TerritoryMap => ({
      black: new Set(),
      white: new Set(),
      dame: new Set(),
    })
  )

  return {
    createBoard,
    isLegalMove,
    getLegalMoves,
    applyMove,
    applyPass,
    computeScore,
    isGameOver,
    getGroup,
    getTerritory,
  }
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let mockEngine: IRulesEngine

beforeEach(() => {
  mockEngine = createMockRulesEngine()
  configureGameStore(mockEngine)
  useGameStore.getState().reset()
})

// ---------------------------------------------------------------------------
// createGame tests
// ---------------------------------------------------------------------------

describe('createGame', () => {
  it('initializes board to empty 9x9', () => {
    useGameStore.getState().createGame(9, 6.5)
    const state = useGameStore.getState()
    expect(state.boardSize).toBe(9)
    expect(state.board).toHaveLength(81)
    expect(Array.from(state.board).every((c) => c === 0)).toBe(true)
  })

  it('sets status to playing', () => {
    useGameStore.getState().createGame(9, 6.5)
    expect(useGameStore.getState().status).toBe('playing')
  })

  it('sets currentPlayer to Black (DKS C14)', () => {
    useGameStore.getState().createGame(9, 6.5)
    expect(useGameStore.getState().currentPlayer).toBe('B')
  })

  it('assigns a non-empty gameId', () => {
    useGameStore.getState().createGame(9, 6.5)
    expect(useGameStore.getState().gameId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('initializes captures to 0/0', () => {
    useGameStore.getState().createGame(9, 6.5)
    const { captures } = useGameStore.getState()
    expect(captures.black).toBe(0)
    expect(captures.white).toBe(0)
  })

  it('sets phase to playing', () => {
    useGameStore.getState().createGame(9, 6.5)
    expect(useGameStore.getState().phase).toBe('playing')
  })

  it('initializes consecutivePasses to 0', () => {
    useGameStore.getState().createGame(9, 6.5)
    expect(useGameStore.getState().consecutivePasses).toBe(0)
  })

  it('calls rulesEngine.createBoard with the given size', () => {
    useGameStore.getState().createGame(13, 7.5)
    expect(mockEngine.createBoard).toHaveBeenCalledWith(13)
  })

  it('supports 19x19 board', () => {
    const bg = makeBoardState(19)
    vi.mocked(mockEngine.createBoard).mockReturnValueOnce(bg)
    useGameStore.getState().createGame(19, 7.5)
    expect(useGameStore.getState().boardSize).toBe(19)
    expect(useGameStore.getState().board).toHaveLength(361)
  })
})

// ---------------------------------------------------------------------------
// playMove tests
// ---------------------------------------------------------------------------

describe('playMove', () => {
  beforeEach(() => {
    useGameStore.getState().createGame(9, 6.5)
  })

  it('returns success when move is legal', () => {
    const result = useGameStore.getState().playMove(0)
    expect(result.success).toBe(true)
  })

  it('updates board state after move', () => {
    useGameStore.getState().playMove(40)
    const board = useGameStore.getState().board
    // Mock applyMove places a 1 (Black) at the index
    expect(board[40]).toBe(1)
  })

  it('switches currentPlayer from Black to White', () => {
    useGameStore.getState().playMove(0)
    expect(useGameStore.getState().currentPlayer).toBe('W')
  })

  it('switches currentPlayer from White to Black', () => {
    useGameStore.getState().playMove(0)
    useGameStore.getState().playMove(1)
    expect(useGameStore.getState().currentPlayer).toBe('B')
  })

  it('adds move to moveHistory', () => {
    useGameStore.getState().playMove(40)
    const history = useGameStore.getState().moveHistory
    expect(history).toHaveLength(1)
    expect(history[0].moveNumber).toBe(0)
    expect(history[0].player).toBe('B')
  })

  it('returns failure when game is not active', () => {
    useGameStore.getState().reset()
    const result = useGameStore.getState().playMove(0)
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns failure when move is illegal', () => {
    vi.mocked(mockEngine.isLegalMove).mockReturnValueOnce(false)
    const result = useGameStore.getState().playMove(0)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Illegal move')
  })

  it('increments currentMoveIndex after each move', () => {
    useGameStore.getState().playMove(0)
    expect(useGameStore.getState().currentMoveIndex).toBe(1)
    useGameStore.getState().playMove(1)
    expect(useGameStore.getState().currentMoveIndex).toBe(2)
  })

  it('sets coordinate in move record', () => {
    useGameStore.getState().playMove(40) // index 40 on 9x9 = E5
    const move = useGameStore.getState().moveHistory[0]
    expect(move.coordinate).toBeTruthy()
    expect(move.coordinate).toMatch(/^[A-HJ-T]\d+$/)
  })

  it('uses rulesEngine.isLegalMove for validation', () => {
    useGameStore.getState().playMove(5)
    expect(mockEngine.isLegalMove).toHaveBeenCalledOnce()
  })

  it('uses rulesEngine.applyMove to compute new state', () => {
    useGameStore.getState().playMove(5)
    expect(mockEngine.applyMove).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// pass tests
// ---------------------------------------------------------------------------

describe('pass', () => {
  beforeEach(() => {
    useGameStore.getState().createGame(9, 6.5)
  })

  it('adds a pass move to history with null coordinate', () => {
    useGameStore.getState().pass()
    const history = useGameStore.getState().moveHistory
    expect(history).toHaveLength(1)
    expect(history[0].coordinate).toBeNull()
    expect(history[0].index).toBeNull()
  })

  it('switches player after pass', () => {
    useGameStore.getState().pass()
    expect(useGameStore.getState().currentPlayer).toBe('W')
  })

  it('increments consecutivePasses', () => {
    useGameStore.getState().pass()
    expect(useGameStore.getState().consecutivePasses).toBe(1)
  })

  it('ends game after two consecutive passes (DKS C15)', () => {
    useGameStore.getState().pass()
    useGameStore.getState().pass()
    expect(useGameStore.getState().status).toBe('finished')
    expect(useGameStore.getState().phase).toBe('finished')
  })

  it('resets consecutivePasses after a stone move', () => {
    useGameStore.getState().pass()
    useGameStore.getState().playMove(40)
    expect(useGameStore.getState().consecutivePasses).toBe(0)
  })

  it('returns failure when game is not active', () => {
    useGameStore.getState().reset()
    const result = useGameStore.getState().pass()
    expect(result.success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resign tests
// ---------------------------------------------------------------------------

describe('resign', () => {
  beforeEach(() => {
    useGameStore.getState().createGame(9, 6.5)
  })

  it('sets status to finished', () => {
    useGameStore.getState().resign('B')
    expect(useGameStore.getState().status).toBe('finished')
  })

  it('sets winner to White when Black resigns', () => {
    useGameStore.getState().resign('B')
    const result = useGameStore.getState().result
    expect(result?.winner).toBe('W')
    expect(result?.resultString).toBe('W+R')
  })

  it('sets winner to Black when White resigns', () => {
    useGameStore.getState().resign('W')
    const result = useGameStore.getState().result
    expect(result?.winner).toBe('B')
    expect(result?.resultString).toBe('B+R')
  })

  it('sets endReason to resignation', () => {
    useGameStore.getState().resign('B')
    expect(useGameStore.getState().result?.endReason).toBe('resignation')
  })
})

// ---------------------------------------------------------------------------
// undo tests
// ---------------------------------------------------------------------------

describe('undo', () => {
  beforeEach(() => {
    useGameStore.getState().createGame(9, 6.5)
  })

  it('removes the last move from history', () => {
    useGameStore.getState().playMove(40)
    useGameStore.getState().playMove(41)
    useGameStore.getState().undo()
    expect(useGameStore.getState().moveHistory).toHaveLength(1)
  })

  it('returns success: false when no moves to undo', () => {
    const result = useGameStore.getState().undo()
    expect(result.success).toBe(false)
  })

  it('returns success: true when there are moves', () => {
    useGameStore.getState().playMove(40)
    const result = useGameStore.getState().undo()
    expect(result.success).toBe(true)
  })

  it('restores the previous player after undo', () => {
    useGameStore.getState().playMove(40)
    // After one move, it's White's turn; after undo, should be Black
    useGameStore.getState().undo()
    expect(useGameStore.getState().currentPlayer).toBe('B')
  })
})

// ---------------------------------------------------------------------------
// reset tests
// ---------------------------------------------------------------------------

describe('reset', () => {
  it('clears all state after a game', () => {
    useGameStore.getState().createGame(9, 6.5)
    useGameStore.getState().playMove(40)
    useGameStore.getState().reset()
    const state = useGameStore.getState()
    expect(state.gameId).toBeNull()
    expect(state.status).toBe('not_started')
    expect(state.moveHistory).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// setResult tests
// ---------------------------------------------------------------------------

describe('setResult', () => {
  it('sets the result and marks game finished', () => {
    useGameStore.getState().createGame(9, 6.5)
    useGameStore.getState().setResult({
      winner: 'B',
      resultString: 'B+8.5',
      score: null,
      endReason: 'scoring',
    })
    const state = useGameStore.getState()
    expect(state.result?.resultString).toBe('B+8.5')
    expect(state.status).toBe('finished')
  })
})

// ---------------------------------------------------------------------------
// Coordinate helper tests
// ---------------------------------------------------------------------------

describe('indexToGTP', () => {
  it('converts index 0 to A9 on a 9x9 board', () => {
    expect(indexToGTP(0, 9)).toBe('A9')
  })

  it('converts index 80 (bottom-right) to J1 on 9x9', () => {
    // 9x9: row=8, col=8; col8=J (skip I), row=9-8=1
    expect(indexToGTP(80, 9)).toBe('J1')
  })

  it('converts center of 9x9 (index 40) to E5', () => {
    // row=4, col=4; col4=E, row=9-4=5
    expect(indexToGTP(40, 9)).toBe('E5')
  })
})

describe('gtpToIndex', () => {
  it('converts A9 to index 0 on 9x9', () => {
    expect(gtpToIndex('A9', 9)).toBe(0)
  })

  it('converts J1 to index 80 on 9x9', () => {
    expect(gtpToIndex('J1', 9)).toBe(80)
  })

  it('returns -1 for pass', () => {
    expect(gtpToIndex('pass', 9)).toBe(-1)
  })

  it('round-trips: indexToGTP then gtpToIndex', () => {
    for (const idx of [0, 1, 8, 9, 40, 72, 80]) {
      const gtp = indexToGTP(idx, 9)
      const recovered = gtpToIndex(gtp, 9)
      expect(recovered).toBe(idx)
    }
  })
})
