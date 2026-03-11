// =============================================================================
// features/onboarding/TutorialScenarios.ts — Pre-configured Board Scenarios
// =============================================================================
// Provides board positions for interactive tutorial steps.
// Each scenario is a pure data object — no side effects.
//
// Board layout convention (9x9, index = row * size + col):
//   0  1  2  3  4  5  6  7  8
//   9  10 11 12 13 14 15 16 17
//   18 19 20 21 22 23 24 25 26
//   27 28 29 30 31 32 33 34 35
//   36 37 38 39 40 41 42 43 44
//   45 46 47 48 49 50 51 52 53
//   54 55 56 57 58 59 60 61 62
//   63 64 65 66 67 68 69 70 71
//   72 73 74 75 76 77 78 79 80
//
// CellState: 0 = Empty, 1 = Black, 2 = White
// =============================================================================

import type { CellState } from '@core/interfaces'
import type { BoardScenario } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const E: CellState = 0 // Empty
const B: CellState = 1 // Black
const W: CellState = 2 // White

// ---------------------------------------------------------------------------
// Scenario: First Stone (any legal move on an empty 9x9 board)
// ---------------------------------------------------------------------------

/**
 * First Stone scenario: empty 9x9 board.
 * The user can place a stone on any intersection.
 * This teaches the basic act of placing a stone.
 */
export const FIRST_STONE_SCENARIO: BoardScenario = {
  boardSize: 9,
  initialBoard: new Array<CellState>(81).fill(E),
  playerToMove: 'B',
  targetIndices: null, // any legal move is accepted
  highlightIndices: [20, 24, 40, 56, 60], // star points on 9x9
  expectedCaptures: [],
  successMessage: 'Great job! You placed your first stone on the board.',
}

// ---------------------------------------------------------------------------
// Scenario: Capture Experience (simple capture on 9x9)
// ---------------------------------------------------------------------------

/**
 * Capture scenario: a white stone at the center (index 40) is nearly
 * surrounded by black stones. The user places the final black stone
 * to capture it.
 *
 * Board (center area):
 *        col 3  4  5
 * row 3:       B
 * row 4:    B  W  (target)
 * row 5:       B
 *
 * White at index 40 (row 4, col 4) has black stones at:
 *   - index 31 (row 3, col 4) — above
 *   - index 39 (row 4, col 3) — left
 *   - index 49 (row 5, col 4) — below
 *
 * The only liberty is index 41 (row 4, col 5) — to the right.
 * User places black at index 41 to capture white at index 40.
 */
export function createCaptureScenario(): BoardScenario {
  const board: CellState[] = new Array<CellState>(81).fill(E)

  // Place black stones surrounding the white stone
  board[31] = B // above (row 3, col 4)
  board[39] = B // left  (row 4, col 3)
  board[49] = B // below (row 5, col 4)

  // Place the white stone to be captured
  board[40] = W // center (row 4, col 4)

  return {
    boardSize: 9,
    initialBoard: board,
    playerToMove: 'B',
    targetIndices: [41], // the only move that captures
    highlightIndices: [41], // highlight the target
    expectedCaptures: [40], // white stone at center is captured
    successMessage:
      'You captured the white stone! When a stone has no liberties (empty neighbors), it is removed from the board.',
  }
}

// ---------------------------------------------------------------------------
// Alternative Capture Scenario (corner capture — simpler visual)
// ---------------------------------------------------------------------------

/**
 * Corner capture scenario: a white stone in the corner (index 0)
 * is almost captured. Black is at index 1 (right neighbor).
 * User places black at index 9 (below) to capture.
 *
 * Board (top-left):
 *        col 0  1
 * row 0:    W  B
 * row 1: (target)
 *
 * White at index 0 (row 0, col 0) has only 1 liberty: index 9.
 */
export function createCornerCaptureScenario(): BoardScenario {
  const board: CellState[] = new Array<CellState>(81).fill(E)

  board[0] = W // corner white stone
  board[1] = B // black to the right

  return {
    boardSize: 9,
    initialBoard: board,
    playerToMove: 'B',
    targetIndices: [9], // place below to capture
    highlightIndices: [9],
    expectedCaptures: [0], // corner stone captured
    successMessage:
      'Corner capture! Stones in the corner only have 2 neighbors, making them easier to capture.',
  }
}

// ---------------------------------------------------------------------------
// Multi-stone Capture Scenario (captures a group of 2)
// ---------------------------------------------------------------------------

/**
 * Multi-stone capture: two white stones in a line, almost surrounded.
 *
 * Board (center area):
 *        col 3  4  5  6
 * row 3:       B  B
 * row 4:    B  W  W  (target)
 * row 5:       B  B
 *
 * White group at indices 40, 41 with one liberty at index 42.
 */
export function createMultiCaptureScenario(): BoardScenario {
  const board: CellState[] = new Array<CellState>(81).fill(E)

  // Black stones surrounding
  board[31] = B // above first white
  board[32] = B // above second white
  board[39] = B // left of first white
  board[49] = B // below first white
  board[50] = B // below second white

  // White group to capture
  board[40] = W
  board[41] = W

  return {
    boardSize: 9,
    initialBoard: board,
    playerToMove: 'B',
    targetIndices: [42],
    highlightIndices: [42],
    expectedCaptures: [40, 41],
    successMessage:
      'You captured two stones at once! Connected stones form a group and are captured together when they have no liberties.',
  }
}

// ---------------------------------------------------------------------------
// Scenario Registry
// ---------------------------------------------------------------------------

/**
 * Get the board scenario for a given tutorial step.
 * Returns null for non-interactive steps.
 */
export function getScenarioForStep(stepId: string): BoardScenario | null {
  switch (stepId) {
    case 'first_stone':
      return FIRST_STONE_SCENARIO
    case 'capture_experience':
      return createCaptureScenario()
    default:
      return null
  }
}
