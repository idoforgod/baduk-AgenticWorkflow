// =============================================================================
// coaching/__tests__/strategic-classifier.test.ts
// =============================================================================
// Tests for the tactical classification algorithm.
// Covers all 15 TacticalSituation types, priority chain ordering,
// edge cases, and encouragement state machine transitions.
// =============================================================================

import type { AnalysisResponse, BoardSize, MoveQuality, PlayerColor } from '@core/interfaces'
import { describe, expect, it } from 'vitest'
import type { ParsedAnalysis } from '../../explanation-engine/types'
import { BLACK, EMPTY, WHITE } from '../../rules-engine/board'
import { transitionEncouragementFSM } from '../coaching-adapter'
import {
  classifySpatial,
  classifyTacticalSituation,
  computeAdjacentGroups,
} from '../strategic-classifier'
import type { TacticalSituation } from '../types'

// =============================================================================
// Test Helpers
// =============================================================================

/** Build a minimal AnalysisResponse for testing */
function makeAnalysisResponse(overrides: {
  winrate?: number
  scoreLead?: number
  moveInfos?: Array<{
    move: string
    winrate: number
    visits: number
    prior: number
    scoreLead: number
    pv: string[]
  }>
  ownership?: readonly number[]
  currentPlayer?: 'B' | 'W'
}): AnalysisResponse {
  const winrate = overrides.winrate ?? 0.55
  const scoreLead = overrides.scoreLead ?? 3.0
  const moveInfos = (
    overrides.moveInfos ?? [
      { move: 'D4', winrate: 0.56, visits: 200, prior: 0.3, scoreLead: 3.5, pv: ['D4', 'Q16'] },
    ]
  ).map((mi, i) => ({
    move: mi.move,
    visits: mi.visits,
    edgeVisits: mi.visits,
    winrate: mi.winrate,
    scoreMean: mi.scoreLead,
    scoreLead: mi.scoreLead,
    scoreStdev: 5.0,
    scoreSelfplay: mi.scoreLead,
    prior: mi.prior,
    utility: 0.1,
    utilityLcb: 0.08,
    lcb: mi.winrate - 0.02,
    order: i,
    weight: 1.0,
    edgeWeight: 1.0,
    playSelectionValue: mi.visits,
    pv: mi.pv,
    pvVisits: mi.pv.map(() => 50),
    pvEdgeVisits: mi.pv.map(() => 50),
    isSymmetryOf: '',
  }))

  return {
    id: 'test-1',
    isDuringSearch: false,
    turnNumber: 10,
    moveInfos,
    rootInfo: {
      winrate,
      scoreLead,
      scoreSelfplay: scoreLead,
      scoreStdev: 5.0,
      utility: 0.1,
      visits: 200,
      currentPlayer: overrides.currentPlayer ?? 'B',
      thisHash: 'abc123',
      symHash: 'abc123',
      lcb: winrate - 0.02,
      utilityLcb: 0.08,
      rawStWrError: 0.01,
      rawStScoreError: 0.5,
      rawVarTimeLeft: 100,
    },
    ownership: overrides.ownership,
  } as AnalysisResponse
}

/** Build a ParsedAnalysis with specific moveQuality and winratePct */
function makeParsedAnalysis(overrides: {
  moveQuality?: MoveQuality | null
  winratePct?: number
  movePhase?: 'opening' | 'middle_game' | 'endgame'
  winrateDeltaPct?: number
  raw?: AnalysisResponse
  pvShort?: string
}): ParsedAnalysis {
  const raw = overrides.raw ?? makeAnalysisResponse({ winrate: (overrides.winratePct ?? 55) / 100 })

  return {
    raw,
    previous: null,
    actualMove: null,
    turnNumber: 10,
    boardSize: 9 as BoardSize,
    computed: {
      winrateDelta: null,
      scoreLeadDelta: null,
      bestMovePlayed: false,
      moveRank: null,
      topMoveGap: 0,
      movePhase: overrides.movePhase ?? 'middle_game',
      confidenceLevel: 'high' as const,
    },
    moveQuality: overrides.moveQuality ?? null,
    winratePct: overrides.winratePct ?? 55,
    bestWinratePct: 56,
    winrateDeltaPct: overrides.winrateDeltaPct ?? 0,
    scoreLeadDeltaAbs: 0,
    pvShort: overrides.pvShort ?? 'D4 -> Q16',
    pvMedium: 'D4 -> Q16 -> R10',
    pvLong: 'D4 -> Q16 -> R10 -> C3 -> E5',
    koValue: 0,
    priorPct: 30,
    lcbPct: 53,
    categoryHint: null,
    previousAssessmentLabel: 'even position',
    currentAssessmentLabel: 'slight advantage',
    candidatesCount: 5,
  }
}

/** Create a 9x9 board with specific stones placed */
function makeBoard(
  size: BoardSize,
  stones: Array<{ index: number; color: PlayerColor }>
): Uint8Array {
  const grid = new Uint8Array(size * size)
  for (const { index, color } of stones) {
    grid[index] = color
  }
  return grid
}

// =============================================================================
// classifySpatial() Tests
// =============================================================================

describe('classifySpatial', () => {
  it('should classify corner positions on 9x9', () => {
    // Top-left corner: row=0, col=0
    expect(classifySpatial(0, 9)).toBe('corner')
    // Row=2, Col=2 (within threshold=3)
    expect(classifySpatial(2 * 9 + 2, 9)).toBe('corner')
  })

  it('should classify side positions on 9x9', () => {
    // Top edge, center column: row=0, col=4
    expect(classifySpatial(0 * 9 + 4, 9)).toBe('side')
    // Left edge, center row: row=4, col=0
    expect(classifySpatial(4 * 9 + 0, 9)).toBe('side')
  })

  it('should classify center positions on 9x9', () => {
    // Center: row=4, col=4
    expect(classifySpatial(4 * 9 + 4, 9)).toBe('center')
  })

  it('should classify corner positions on 19x19', () => {
    // Row=0, Col=0
    expect(classifySpatial(0, 19)).toBe('corner')
    // Row=4, Col=4 (within threshold=5)
    expect(classifySpatial(4 * 19 + 4, 19)).toBe('corner')
  })

  it('should classify side positions on 19x19', () => {
    // Row=0, Col=9 (near top, center column)
    expect(classifySpatial(0 * 19 + 9, 19)).toBe('side')
  })

  it('should classify center positions on 19x19', () => {
    // Row=9, Col=9 (dead center)
    expect(classifySpatial(9 * 19 + 9, 19)).toBe('center')
  })

  it('should classify corner positions on 13x13', () => {
    // Row=0, Col=0
    expect(classifySpatial(0, 13)).toBe('corner')
    // Row=3, Col=3 (within threshold=4)
    expect(classifySpatial(3 * 13 + 3, 13)).toBe('corner')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 1: Quality-Based
// =============================================================================

describe('classifyTacticalSituation — Tier 1 (quality)', () => {
  const grid = makeBoard(9, [])
  const boardSize: BoardSize = 9

  it('should return brilliant_move when moveQuality is brilliant', () => {
    const parsed = makeParsedAnalysis({ moveQuality: 'brilliant' })
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)).toBe(
      'brilliant_move'
    )
  })

  it('should return mistake when moveQuality is blunder', () => {
    const parsed = makeParsedAnalysis({ moveQuality: 'blunder' })
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)).toBe(
      'mistake'
    )
  })

  it('should return mistake when moveQuality is mistake', () => {
    const parsed = makeParsedAnalysis({ moveQuality: 'mistake' })
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)).toBe(
      'mistake'
    )
  })

  it('should NOT return mistake for inaccuracy', () => {
    const parsed = makeParsedAnalysis({ moveQuality: 'inaccuracy' })
    const result = classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)
    expect(result).not.toBe('mistake')
    expect(result).not.toBe('brilliant_move')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 2: Momentum
// =============================================================================

describe('classifyTacticalSituation — Tier 2 (momentum)', () => {
  const grid = makeBoard(9, [])
  const boardSize: BoardSize = 9

  it('should detect momentum_shift when crossing up from below 50%', () => {
    const parsed = makeParsedAnalysis({
      winratePct: 55,
      raw: makeAnalysisResponse({ winrate: 0.55 }),
    })
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, 0.45)).toBe(
      'momentum_shift'
    )
  })

  it('should detect momentum_shift when crossing down from above 50%', () => {
    const parsed = makeParsedAnalysis({
      winratePct: 45,
      raw: makeAnalysisResponse({ winrate: 0.45 }),
    })
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, 0.55)).toBe(
      'momentum_shift'
    )
  })

  it('should NOT detect momentum_shift when staying above 50%', () => {
    const parsed = makeParsedAnalysis({
      winratePct: 60,
      raw: makeAnalysisResponse({ winrate: 0.6 }),
    })
    const result = classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, 0.55)
    expect(result).not.toBe('momentum_shift')
  })

  it('should NOT detect momentum_shift when previousWinrate is null', () => {
    const parsed = makeParsedAnalysis({
      winratePct: 55,
      raw: makeAnalysisResponse({ winrate: 0.55 }),
    })
    const result = classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)
    expect(result).not.toBe('momentum_shift')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 3: Board-State Tactical
// =============================================================================

describe('classifyTacticalSituation — Tier 3 (board-state)', () => {
  const boardSize: BoardSize = 9

  it('should detect capture when adjacent opponent has 1 liberty', () => {
    // Place our stone at index 10 (row=1, col=1)
    // Opponent at index 11 (row=1, col=2) with 1 liberty
    // Surround opponent: stones at 2 (row=0, col=2), 20 (row=2, col=2)
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
      { index: 2, color: BLACK }, // above opponent
      { index: 20, color: BLACK }, // below opponent
      // opponent's only freedom is to the right (index 12)
    ])
    // Actually: neighbors of 11 are: 2 (Black), 20 (Black), 10 (Black), 12 (empty)
    // That's 1 liberty at index 12. But let's also block it:
    grid[12] = BLACK
    // Now opponent at 11 has 0 liberties — but we want atari (1 liberty).
    // Let's redo: leave 12 empty and one neighbor open
    grid[12] = EMPTY
    // Actually with 10=Black, 2=Black, 20=Black, index 11 neighbors are:
    // 11-9=2 (Black), 11+9=20 (Black), 11-1=10 (Black), 11+1=12 (empty)
    // So liberties = {12}, size = 1. This IS atari.

    const parsed = makeParsedAnalysis({})
    expect(classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, null)).toBe(
      'capture'
    )
  })

  it('should detect attack when adjacent opponent has 2-3 liberties', () => {
    // Place our stone at index 10, opponent at index 11 with 2 liberties
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
      { index: 2, color: BLACK }, // above opponent (blocks one liberty)
    ])
    // Neighbors of 11: 2 (Black), 20 (empty), 10 (Black), 12 (empty)
    // Liberties: {20, 12} = 2 liberties

    const parsed = makeParsedAnalysis({})
    expect(classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, null)).toBe('attack')
  })

  it('should detect escape when own group has few liberties and surrounded', () => {
    // Set up a board where the adjacent opponent groups all have 4+ liberties,
    // but own group has <= 3 liberties and is surrounded (adjOpponentCount >= 2).
    const grid = makeBoard(9, [
      // Black stone in the center area
      { index: 40, color: BLACK }, // row=4, col=4, center of 9x9
      // White stones on two sides (must have 4+ liberties each)
      { index: 31, color: WHITE }, // row=3, col=4 (above): neighbors 22,40,30,32
      { index: 49, color: WHITE }, // row=5, col=4 (below): neighbors 40,58,48,50
      // Add more white stones to make groups larger (more liberties)
      { index: 22, color: WHITE }, // extends group of 31: stones={31,22}, libs={13,23,21,30,32} minus occupied
      { index: 58, color: WHITE }, // extends group of 49: stones={49,58}, libs={67,59,57,48,50} minus occupied
    ])
    // 40's neighbors: 31(W), 49(W), 39(empty), 41(empty)
    // Own group (40): liberties = {39, 41} -> size=2 (<=3)
    // adjOpponentCount: 31(W) + 49(W) = 2 (>=2)
    // Opponent group containing 31: {31, 22}; liberties include 13, 23, 21, 30, 32 -> many (>3)
    // Opponent group containing 49: {49, 58}; liberties include 48, 50, 67, 59, 57 -> many (>3)
    // So attack should NOT fire, escape should fire.

    const parsed = makeParsedAnalysis({})
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe('escape')
  })

  it('should detect connection when 2+ friendly neighbors', () => {
    // Black at 10, friendly stones at 1 and 9
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 1, color: BLACK }, // above
      { index: 9, color: BLACK }, // left
    ])
    // adjFriendlyNeighborCount = 2

    const parsed = makeParsedAnalysis({})
    expect(classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, null)).toBe(
      'connection'
    )
  })

  it('should prioritize capture over attack', () => {
    // Two opponent groups: one in atari, one with 2 liberties
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE }, // this one in atari
      { index: 2, color: BLACK },
      { index: 20, color: BLACK },
      // 11 neighbors: 2(B), 20(B), 10(B), 12(empty) -> 1 liberty
      { index: 9, color: WHITE }, // another group with more liberties
    ])

    const parsed = makeParsedAnalysis({})
    const result = classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, null)
    // Should be capture, not attack
    expect(result).toBe('capture')
  })

  it('should skip board-state tier for pass moves (index -1)', () => {
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
    ])
    const parsed = makeParsedAnalysis({ winratePct: 70 })
    // index -1 means pass
    const result = classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)
    // Should not be any tier 3 result
    expect(['capture', 'attack', 'escape', 'connection']).not.toContain(result)
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 4: Spatial-Strategic
// =============================================================================

describe('classifyTacticalSituation — Tier 4 (spatial)', () => {
  const boardSize: BoardSize = 9

  it('should detect invasion when playing into opponent territory', () => {
    // Black plays at index 4 (row=0, col=4), ownership says this is White's area
    const grid = makeBoard(9, [{ index: 4, color: BLACK }])
    const ownership = new Array(81).fill(-0.5) // All White territory

    const parsed = makeParsedAnalysis({ winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 4, BLACK, ownership, null)).toBe(
      'invasion'
    )
  })

  it('should detect invasion for White player with positive ownership', () => {
    // White plays at index 4, ownership = +0.5 means Black territory
    // For White: effectiveOwnership = -ownership = -0.5 < -0.3 -> invasion
    const grid = makeBoard(9, [{ index: 4, color: WHITE }])
    const ownership = new Array(81).fill(0.5) // All Black territory

    const parsed = makeParsedAnalysis({ winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 4, WHITE, ownership, null)).toBe(
      'invasion'
    )
  })

  it('should detect defense when protecting own territory with adjacent opponent', () => {
    // Black plays at index 40 (center, row=4, col=4), ownership > 0.3, adjacent opponent
    // Opponent group must have 4+ liberties so attack doesn't fire first.
    const grid = makeBoard(9, [
      { index: 40, color: BLACK },
      { index: 41, color: WHITE }, // adjacent opponent at col=5
      { index: 42, color: WHITE }, // extend the group for more liberties
    ])
    // Opponent group: {41, 42}, neighbors include 32,50,40,43,33,51
    // Liberties: {32, 50, 43, 33, 51} = 5 (>3), so no attack
    const ownership = new Array(81).fill(0.5) // Black territory

    const parsed = makeParsedAnalysis({ winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, ownership, null)).toBe(
      'defense'
    )
  })

  it('should detect approach in opening corner with adjacent opponent', () => {
    // Opening phase, corner position, adjacent opponent
    // The adjacent opponent group must have 4+ liberties to avoid attack trigger.
    const grid = makeBoard(9, [
      { index: 0, color: BLACK }, // row=0, col=0 (corner)
      { index: 1, color: WHITE }, // adjacent opponent (col=1)
      { index: 2, color: WHITE }, // extend opponent group
      { index: 3, color: WHITE }, // extend more for plenty of liberties
    ])
    // Opponent group {1,2,3}: liberties include 10,11,12,4 -> 4+ liberties, no attack

    const parsed = makeParsedAnalysis({ movePhase: 'opening', winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 0, BLACK, null, null)).toBe(
      'approach'
    )
  })

  it('should detect territory_building in opening corner with no opponent', () => {
    const grid = makeBoard(9, [{ index: 0, color: BLACK }])

    const parsed = makeParsedAnalysis({ movePhase: 'opening', winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 0, BLACK, null, null)).toBe(
      'territory_building'
    )
  })

  it('should detect territory_building on side in opening', () => {
    // Side position: row=0, col=4 on 9x9 board
    const sideIndex = 4
    const grid = makeBoard(9, [{ index: sideIndex, color: BLACK }])

    const parsed = makeParsedAnalysis({ movePhase: 'opening', winratePct: 55 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, sideIndex, BLACK, null, null)).toBe(
      'territory_building'
    )
  })

  it('should skip ownership-based checks when ownership is null', () => {
    const grid = makeBoard(9, [{ index: 4, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'middle_game', winratePct: 55 })
    // No ownership -> invasion/defense skipped, should fall through
    const result = classifyTacticalSituation(parsed, grid, boardSize, 4, BLACK, null, null)
    expect(result).not.toBe('invasion')
    expect(result).not.toBe('defense')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 5: Game-State
// =============================================================================

describe('classifyTacticalSituation — Tier 5 (game-state)', () => {
  const boardSize: BoardSize = 9

  it('should detect endgame_counting in endgame phase', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'endgame', winratePct: 60 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'endgame_counting'
    )
  })

  it('should detect close_game when winrate is near 50%', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'middle_game', winratePct: 48 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'close_game'
    )
  })

  it('should detect close_game at winrate 46%', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'middle_game', winratePct: 46 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'close_game'
    )
  })

  it('should NOT detect close_game at winrate 56% (exactly at boundary)', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'middle_game', winratePct: 56 })
    // abs(56-50)=6, not < 5
    const result = classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)
    expect(result).not.toBe('close_game')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 6: Positive Feedback
// =============================================================================

describe('classifyTacticalSituation — Tier 6 (good_move)', () => {
  const boardSize: BoardSize = 9

  it('should detect good_move for excellent quality', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ moveQuality: 'excellent', winratePct: 65 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'good_move'
    )
  })

  it('should detect good_move for good quality', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ moveQuality: 'good', winratePct: 65 })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'good_move'
    )
  })

  it('should NOT detect good_move for acceptable quality', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ moveQuality: 'acceptable', winratePct: 65 })
    const result = classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)
    expect(result).not.toBe('good_move')
  })
})

// =============================================================================
// classifyTacticalSituation() — TIER 7: Fallback
// =============================================================================

describe('classifyTacticalSituation — Tier 7 (positional fallback)', () => {
  const boardSize: BoardSize = 9

  it('should return positional as final fallback', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({
      moveQuality: null,
      winratePct: 65,
      movePhase: 'middle_game',
    })
    // No quality, no momentum, center position in middle game, winrate 65% (not close),
    // no adjacent opponent => positional
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'positional'
    )
  })

  it('should return positional for acceptable quality in middle game with high winrate', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({
      moveQuality: 'acceptable',
      winratePct: 70,
      movePhase: 'middle_game',
    })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)).toBe(
      'positional'
    )
  })
})

// =============================================================================
// Priority Chain Order Tests
// =============================================================================

describe('priority chain order', () => {
  const boardSize: BoardSize = 9

  it('should prioritize brilliant_move over all board-state checks', () => {
    // Set up a board with capture opportunity, but move is brilliant
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
      { index: 2, color: BLACK },
      { index: 20, color: BLACK },
    ])
    grid[12] = EMPTY // 11 has 1 liberty

    const parsed = makeParsedAnalysis({ moveQuality: 'brilliant' })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, null)).toBe(
      'brilliant_move'
    )
  })

  it('should prioritize mistake over momentum_shift', () => {
    const grid = makeBoard(9, [])
    const parsed = makeParsedAnalysis({
      moveQuality: 'blunder',
      winratePct: 55,
      raw: makeAnalysisResponse({ winrate: 0.55 }),
    })
    // This would cross 50% boundary, but blunder takes priority
    expect(classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, 0.45)).toBe(
      'mistake'
    )
  })

  it('should prioritize momentum_shift over board-state capture', () => {
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
      { index: 2, color: BLACK },
      { index: 20, color: BLACK },
    ])
    // 11 has 1 liberty, would be capture, but momentum crosses

    const parsed = makeParsedAnalysis({
      winratePct: 55,
      raw: makeAnalysisResponse({ winrate: 0.55 }),
    })
    expect(classifyTacticalSituation(parsed, grid, boardSize, 10, BLACK, null, 0.45)).toBe(
      'momentum_shift'
    )
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  const boardSize: BoardSize = 9

  it('should handle null moveQuality gracefully', () => {
    const grid = makeBoard(9, [{ index: 40, color: BLACK }])
    const parsed = makeParsedAnalysis({ moveQuality: null, winratePct: 65 })
    const result = classifyTacticalSituation(parsed, grid, boardSize, 40, BLACK, null, null)
    // Should not crash, should return something
    expect(typeof result).toBe('string')
    expect(result).not.toBe('brilliant_move')
    expect(result).not.toBe('mistake')
    expect(result).not.toBe('good_move')
  })

  it('should handle pass move (lastMoveIndex = -1)', () => {
    const grid = makeBoard(9, [])
    const parsed = makeParsedAnalysis({ winratePct: 55 })
    const result = classifyTacticalSituation(parsed, grid, boardSize, -1, BLACK, null, null)
    expect(typeof result).toBe('string')
  })

  it('should handle empty board', () => {
    const grid = new Uint8Array(81)
    const parsed = makeParsedAnalysis({ movePhase: 'opening', winratePct: 50 })
    const result = classifyTacticalSituation(parsed, grid, boardSize, 0, BLACK, null, null)
    expect(typeof result).toBe('string')
  })

  it('should handle first move of game (no previous data)', () => {
    const grid = makeBoard(9, [{ index: 20, color: BLACK }])
    const parsed = makeParsedAnalysis({ movePhase: 'opening', winratePct: 50 })
    const result = classifyTacticalSituation(parsed, grid, boardSize, 20, BLACK, null, null)
    // First move, no previous winrate, opening phase, side position
    expect(typeof result).toBe('string')
  })
})

// =============================================================================
// computeAdjacentGroups() Tests
// =============================================================================

describe('computeAdjacentGroups', () => {
  it('should find adjacent opponent groups', () => {
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 11, color: WHITE },
      { index: 19, color: WHITE },
    ])

    const result = computeAdjacentGroups(grid, 9, 10, BLACK)
    // Opponent at 11 and 19 are separate groups
    expect(result.adjOpponentCount).toBe(2)
  })

  it('should count friendly neighbors', () => {
    const grid = makeBoard(9, [
      { index: 10, color: BLACK },
      { index: 1, color: BLACK },
      { index: 9, color: BLACK },
    ])

    const result = computeAdjacentGroups(grid, 9, 10, BLACK)
    expect(result.adjFriendlyNeighborCount).toBe(2)
  })

  it('should find own group', () => {
    const grid = makeBoard(9, [{ index: 10, color: BLACK }])

    const result = computeAdjacentGroups(grid, 9, 10, BLACK)
    expect(result.ownGroup).not.toBeNull()
    expect(result.ownGroup!.stones.has(10)).toBe(true)
  })
})

// =============================================================================
// Encouragement State Machine Tests
// =============================================================================

describe('transitionEncouragementFSM', () => {
  it('should stay neutral on good move if consecutive < 3', () => {
    const result = transitionEncouragementFSM('neutral', 'good_move', 'good', null, 1, 0, false)
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(2)
  })

  it('should transition to streak after 3 consecutive good moves', () => {
    const result = transitionEncouragementFSM('neutral', 'good_move', 'good', null, 2, 0, false)
    expect(result.nextState).toBe('streak')
    expect(result.nextConsecutiveGoodMoves).toBe(3)
  })

  it('should stay in streak on more good moves', () => {
    const result = transitionEncouragementFSM('streak', 'good_move', 'excellent', null, 5, 0, false)
    expect(result.nextState).toBe('streak')
    expect(result.nextConsecutiveGoodMoves).toBe(6)
  })

  it('should break streak on bad move', () => {
    const result = transitionEncouragementFSM('streak', 'mistake', 'blunder', null, 5, 0, false)
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(0)
    expect(result.nextConsecutiveBadMoves).toBe(1)
  })

  it('should break streak on inaccuracy', () => {
    const result = transitionEncouragementFSM(
      'streak',
      'positional',
      'inaccuracy',
      null,
      5,
      0,
      false
    )
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(0)
  })

  it('should transition to recovery when previous was bad and current is good', () => {
    const result = transitionEncouragementFSM(
      'neutral',
      'good_move',
      'good',
      'blunder',
      0,
      1,
      false
    )
    expect(result.nextState).toBe('recovery')
    expect(result.nextConsecutiveGoodMoves).toBe(1)
    expect(result.nextConsecutiveBadMoves).toBe(0)
  })

  it('should transition recovery override from streak state too', () => {
    const result = transitionEncouragementFSM(
      'streak',
      'good_move',
      'excellent',
      'mistake',
      5,
      0,
      false
    )
    expect(result.nextState).toBe('recovery')
  })

  it('should transition to momentum on momentum_shift with winrate improvement', () => {
    const result = transitionEncouragementFSM('neutral', 'momentum_shift', null, null, 0, 0, true)
    expect(result.nextState).toBe('momentum')
  })

  it('should NOT transition to momentum if winrate did not improve', () => {
    const result = transitionEncouragementFSM('neutral', 'momentum_shift', null, null, 0, 0, false)
    expect(result.nextState).toBe('neutral')
  })

  it('recovery should be single-move state (reverts to neutral logic)', () => {
    const result = transitionEncouragementFSM('recovery', 'positional', null, 'good', 1, 0, false)
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(0)
  })

  it('momentum should be single-move state (reverts to neutral logic)', () => {
    const result = transitionEncouragementFSM('momentum', 'positional', 'good', null, 0, 0, false)
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(1)
  })

  it('should reset consecutive good moves on null moveQuality', () => {
    const result = transitionEncouragementFSM('neutral', 'positional', null, null, 2, 0, false)
    expect(result.nextState).toBe('neutral')
    expect(result.nextConsecutiveGoodMoves).toBe(0)
  })
})
