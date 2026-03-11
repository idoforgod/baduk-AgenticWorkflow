// =============================================================================
// Core Rules Engine — Tromp-Taylor Rules Implementation
// =============================================================================
// Layer 2 (Domain) — Pure functions implementing IRulesEngine.
// Implements: All 10 Tromp-Taylor rules (TT-01 through TT-10).
// DKS coverage: Rules, Constraints C01-C12, Edge Cases EC-01 through EC-20.
// =============================================================================

import type {
  BoardSize,
  BoardState,
  GameState,
  Group,
  IRulesEngine,
  MoveRecord,
  Player,
  PlayerColor,
  Result,
  RulesError,
  ScoreResult,
  TerritoryMap,
} from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'
import {
  BLACK,
  createEmptyBoard,
  EMPTY,
  findCapturesAround,
  findGroup,
  hasLiberties,
  indexToGTP,
  isValidIndex,
  opponentColor,
  WHITE,
} from './board'
import { chineseScore, computeTerritory } from './scoring'
import { computeFullHash, hashPlaceStone, hashRemoveStone } from './zobrist'

// =============================================================================
// Error Construction Helpers
// =============================================================================

function rulesError(code: RulesError['code'], message: string): RulesError {
  return { module: 'rules', code, message }
}

// =============================================================================
// TrompTaylorRulesEngine — IRulesEngine implementation
// =============================================================================

export class TrompTaylorRulesEngine implements IRulesEngine {
  // -------------------------------------------------------------------------
  // createBoard
  // -------------------------------------------------------------------------

  createBoard(size: BoardSize): BoardState {
    if (size !== 9 && size !== 13 && size !== 19) {
      throw rulesError('INVALID_BOARD_SIZE', `Invalid board size: ${size}. Must be 9, 13, or 19.`)
    }
    return createEmptyBoard(size)
  }

  // -------------------------------------------------------------------------
  // isLegalMove
  // -------------------------------------------------------------------------

  isLegalMove(state: GameState, index: number): boolean {
    const { board, currentPlayer, koPoint, positionHashes } = state

    // Bounds check
    if (!isValidIndex(index, board.size)) return false

    // Occupied check (C06)
    if (board.grid[index] !== EMPTY) return false

    // Game already ended
    if (state.phase === 'finished' || state.consecutivePasses >= 2) return false

    // Simple ko check (optimization)
    if (koPoint === index) return false

    // Simulate the move to check for suicide and superko
    const color: PlayerColor = currentPlayer === 'B' ? BLACK : WHITE
    const opponent = opponentColor(color)

    // Place stone on a copy
    const newGrid = new Uint8Array(board.grid)
    newGrid[index] = color

    // Capture opponent groups
    const captures = findCapturesAround(newGrid, board.size, index, opponent)
    for (const c of captures) {
      newGrid[c] = EMPTY
    }

    // Check if the placed stone's group has liberties (suicide check)
    if (captures.length === 0 && !hasLiberties(newGrid, board.size, index)) {
      // Under Tromp-Taylor, suicide is legal BUT the resulting position
      // is checked against superko. If suicide would recreate a previous
      // position (which single-stone suicide always does), it is forbidden.

      // Self-capture: remove own group
      const selfGroup = findGroup(newGrid, board.size, index)
      if (selfGroup !== null) {
        for (const s of selfGroup.stones) {
          newGrid[s] = EMPTY
        }
      }
    }

    // Compute resulting hash for superko check
    let newHash = board.hash
    newHash = hashPlaceStone(newHash, board.size, index, color)
    for (const c of captures) {
      newHash = hashRemoveStone(newHash, board.size, c, opponent)
    }

    // If suicide occurred, also account for removed own stones
    if (captures.length === 0 && newGrid[index] === EMPTY) {
      // The stone was self-captured. We need to recompute the hash
      // since the self-capture removed stones we already hashed in.
      newHash = computeFullHash(newGrid, board.size)
    }

    // Superko check (C08): resulting position must not match any previous position
    if (positionHashes.has(newHash)) return false

    return true
  }

  // -------------------------------------------------------------------------
  // getLegalMoves
  // -------------------------------------------------------------------------

  getLegalMoves(state: GameState): number[] {
    const total = state.board.size * state.board.size
    const legal: number[] = []

    for (let i = 0; i < total; i++) {
      if (this.isLegalMove(state, i)) {
        legal.push(i)
      }
    }

    return legal
  }

  // -------------------------------------------------------------------------
  // applyMove
  // -------------------------------------------------------------------------

  applyMove(state: GameState, index: number): Result<GameState, RulesError> {
    const { board, currentPlayer, positionHashes } = state

    // Validate: game not ended
    if (state.phase === 'finished' || state.consecutivePasses >= 2) {
      return Err(rulesError('GAME_ALREADY_ENDED', 'Game has already ended.'))
    }

    // Validate: index in bounds
    if (!isValidIndex(index, board.size)) {
      return Err(
        rulesError(
          'INVALID_INDEX',
          `Index ${index} is out of bounds for ${board.size}x${board.size} board.`
        )
      )
    }

    // Validate: intersection is empty
    if (board.grid[index] !== EMPTY) {
      return Err(rulesError('OCCUPIED_INTERSECTION', `Intersection ${index} is already occupied.`))
    }

    // Validate: not ko point
    if (state.koPoint === index) {
      return Err(rulesError('KO_VIOLATION', `Cannot play at ko point ${index}.`))
    }

    const color: PlayerColor = currentPlayer === 'B' ? BLACK : WHITE
    const opponent = opponentColor(color)

    // Step 1: Place stone (TT-07 step 1)
    const newGrid = new Uint8Array(board.grid)
    newGrid[index] = color

    let newHash = hashPlaceStone(board.hash, board.size, index, color)

    // Step 2: Capture opponent groups (TT-07 step 2)
    const capturedIndices = findCapturesAround(newGrid, board.size, index, opponent)
    for (const c of capturedIndices) {
      newGrid[c] = EMPTY
      newHash = hashRemoveStone(newHash, board.size, c, opponent)
    }

    // Step 3: Self-capture / suicide (TT-07 step 3)
    let selfCaptured: number[] = []
    if (capturedIndices.length === 0 && !hasLiberties(newGrid, board.size, index)) {
      const selfGroup = findGroup(newGrid, board.size, index)
      if (selfGroup !== null) {
        selfCaptured = Array.from(selfGroup.stones)
        for (const s of selfCaptured) {
          newGrid[s] = EMPTY
          newHash = hashRemoveStone(newHash, board.size, s, color)
        }
      }
    }

    // Superko check (C08)
    if (positionHashes.has(newHash)) {
      return Err(rulesError('SUPERKO_VIOLATION', `Move at ${index} violates positional superko.`))
    }

    // Step 4: Determine ko point (DKS R29, EC-01)
    let newKoPoint: number | null = null
    if (capturedIndices.length === 1 && selfCaptured.length === 0) {
      // Check if the capturing stone forms a group of size 1 with exactly 1 liberty
      const capturingGroup = findGroup(newGrid, board.size, index)
      if (
        capturingGroup !== null &&
        capturingGroup.stones.size === 1 &&
        capturingGroup.liberties.size === 1
      ) {
        newKoPoint = capturedIndices[0]!
      }
    }

    // Step 5: Build new board state
    const newBoard: BoardState = {
      size: board.size,
      grid: newGrid,
      hash: newHash,
    }

    // Step 6: Build new position hash set
    const newPositionHashes = new Set(positionHashes)
    newPositionHashes.add(newHash)

    // Step 7: Build move record
    const nextPlayer: Player = currentPlayer === 'B' ? 'W' : 'B'
    const allCaptures = [...capturedIndices, ...selfCaptured]

    const moveRecord: MoveRecord = {
      moveNumber: state.moves.length,
      player: currentPlayer,
      index,
      coordinate: indexToGTP(index, board.size),
      timestamp: Math.floor(Date.now() / 1000),
      captures: allCaptures,
    }

    // Step 8: Update capture counts
    const newCaptures = {
      black:
        state.captures.black +
        (currentPlayer === 'B' ? capturedIndices.length : selfCaptured.length),
      white:
        state.captures.white +
        (currentPlayer === 'W' ? capturedIndices.length : selfCaptured.length),
    }

    // Step 9: Build new game state
    const newState: GameState = {
      gameId: state.gameId,
      config: state.config,
      board: newBoard,
      currentPlayer: nextPlayer,
      moves: [...state.moves, moveRecord],
      currentMoveIndex: state.currentMoveIndex + 1,
      phase: 'playing',
      consecutivePasses: 0,
      positionHashes: newPositionHashes,
      koPoint: newKoPoint,
      captures: newCaptures,
      timer: state.timer,
    }

    return Ok(newState)
  }

  // -------------------------------------------------------------------------
  // applyPass
  // -------------------------------------------------------------------------

  applyPass(state: GameState): Result<GameState, RulesError> {
    // Validate: game not ended
    if (state.phase === 'finished') {
      return Err(rulesError('GAME_ALREADY_ENDED', 'Game has already ended.'))
    }

    const newConsecutivePasses = state.consecutivePasses + 1
    const nextPlayer: Player = state.currentPlayer === 'B' ? 'W' : 'B'
    const gameEnding = newConsecutivePasses >= 2

    const moveRecord: MoveRecord = {
      moveNumber: state.moves.length,
      player: state.currentPlayer,
      index: null,
      coordinate: null,
      timestamp: Math.floor(Date.now() / 1000),
      captures: [],
    }

    const newState: GameState = {
      gameId: state.gameId,
      config: state.config,
      board: state.board,
      currentPlayer: nextPlayer,
      moves: [...state.moves, moveRecord],
      currentMoveIndex: state.currentMoveIndex + 1,
      phase: gameEnding ? 'finished' : 'playing',
      consecutivePasses: newConsecutivePasses,
      positionHashes: state.positionHashes,
      koPoint: null, // Ko point is cleared after a pass
      captures: state.captures,
      timer: state.timer,
    }

    return Ok(newState)
  }

  // -------------------------------------------------------------------------
  // computeScore
  // -------------------------------------------------------------------------

  computeScore(board: BoardState, komi: number): ScoreResult {
    return chineseScore(board, komi)
  }

  // -------------------------------------------------------------------------
  // isGameOver
  // -------------------------------------------------------------------------

  isGameOver(state: GameState): boolean {
    return state.phase === 'finished' || state.consecutivePasses >= 2
  }

  // -------------------------------------------------------------------------
  // getGroup
  // -------------------------------------------------------------------------

  getGroup(board: BoardState, index: number): Group | null {
    if (!isValidIndex(index, board.size)) return null
    return findGroup(board.grid, board.size, index)
  }

  // -------------------------------------------------------------------------
  // getTerritory
  // -------------------------------------------------------------------------

  getTerritory(board: BoardState): TerritoryMap {
    return computeTerritory(board)
  }
}

// =============================================================================
// Factory function (preferred over direct construction)
// =============================================================================

/**
 * Create a new TrompTaylorRulesEngine instance.
 * This is the only way to obtain an IRulesEngine in production code.
 */
export function createRulesEngine(): IRulesEngine {
  return new TrompTaylorRulesEngine()
}

// =============================================================================
// Game State Factory
// =============================================================================

/**
 * Create a fresh GameState for a new game.
 * Convenience function that initializes all fields per DKS C13-C14.
 *
 * @param size - Board size.
 * @param komi - Komi value. Default: 7.5 for 19x19, 5.5 for 9/13.
 * @param gameId - Optional game ID. Defaults to a new UUID.
 * @returns A fully initialized GameState ready for play.
 */
export function createGameState(size: BoardSize, komi?: number, gameId?: string): GameState {
  const defaultKomi = size === 19 ? 7.5 : 5.5
  const board = createEmptyBoard(size)

  // The initial empty board hash must be in the position history
  const positionHashes = new Set<bigint>()
  positionHashes.add(board.hash)

  return {
    gameId: gameId ?? crypto.randomUUID(),
    config: {
      boardSize: size,
      komi: komi ?? defaultKomi,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
    },
    board,
    currentPlayer: 'B',
    moves: [],
    currentMoveIndex: -1,
    phase: 'playing',
    consecutivePasses: 0,
    positionHashes,
    koPoint: null,
    captures: { black: 0, white: 0 },
    timer: null,
  }
}
