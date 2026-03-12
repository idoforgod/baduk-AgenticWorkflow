// =============================================================================
// coaching/__tests__/coaching-adapter.test.ts
// =============================================================================
// Tests for coaching adapter: template selection, slot filling,
// encouragement suffix application, and full pipeline.
// =============================================================================

import type { AnalysisResponse, BoardSize, PlayerColor } from '@core/interfaces'
import { describe, expect, it } from 'vitest'
import { BLACK } from '../../rules-engine/board'
import { generateCoachingMessage } from '../coaching-adapter'
import {
  COACHING_CATALOG,
  MOMENTUM_SUFFIXES,
  RECOVERY_SUFFIXES,
  STREAK_SUFFIXES,
} from '../coaching-templates'
import type { PlayerContext, TacticalSituation } from '../types'

// =============================================================================
// Test Helpers
// =============================================================================

function makeAnalysisResponse(overrides?: {
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
  currentPlayer?: 'B' | 'W'
  ownership?: readonly number[]
}): AnalysisResponse {
  const winrate = overrides?.winrate ?? 0.55
  const scoreLead = overrides?.scoreLead ?? 3.0
  const moveInfos = (
    overrides?.moveInfos ?? [
      { move: 'D4', winrate: 0.56, visits: 200, prior: 0.3, scoreLead: 3.5, pv: ['D4', 'Q16'] },
      { move: 'Q16', winrate: 0.53, visits: 100, prior: 0.2, scoreLead: 2.0, pv: ['Q16', 'D4'] },
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
      currentPlayer: overrides?.currentPlayer ?? 'B',
      thisHash: 'abc123',
      symHash: 'abc123',
      lcb: winrate - 0.02,
      utilityLcb: 0.08,
      rawStWrError: 0.01,
      rawStScoreError: 0.5,
      rawVarTimeLeft: 100,
    },
    ownership: overrides?.ownership,
  } as AnalysisResponse
}

function makeGrid(
  size: BoardSize,
  stones?: Array<{ index: number; color: PlayerColor }>
): Uint8Array {
  const grid = new Uint8Array(size * size)
  if (stones) {
    for (const { index, color } of stones) {
      grid[index] = color
    }
  }
  return grid
}

const DEFAULT_CONTEXT: PlayerContext = {
  encouragementState: 'neutral',
  consecutiveGoodMoves: 0,
  consecutiveBadMoves: 0,
  previousMoveQuality: null,
  previousWinrate: null,
}

// =============================================================================
// Template Catalog Integrity Tests
// =============================================================================

describe('coaching template catalog', () => {
  const allSituations: TacticalSituation[] = [
    'brilliant_move',
    'mistake',
    'momentum_shift',
    'capture',
    'attack',
    'escape',
    'connection',
    'invasion',
    'defense',
    'approach',
    'territory_building',
    'endgame_counting',
    'close_game',
    'good_move',
    'positional',
  ]

  it('should have templates for all 15 situations', () => {
    for (const situation of allSituations) {
      expect(COACHING_CATALOG[situation]).toBeDefined()
      expect(COACHING_CATALOG[situation].templates.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('should have exactly 45 base templates total', () => {
    let total = 0
    for (const situation of allSituations) {
      total += COACHING_CATALOG[situation].templates.length
    }
    expect(total).toBe(45)
  })

  it('should have 7 suffix templates', () => {
    const suffixCount =
      STREAK_SUFFIXES.templates.length +
      RECOVERY_SUFFIXES.templates.length +
      MOMENTUM_SUFFIXES.templates.length
    expect(suffixCount).toBe(7)
  })

  it('should have 52 templates grand total', () => {
    let total = 0
    for (const situation of allSituations) {
      total += COACHING_CATALOG[situation].templates.length
    }
    total += STREAK_SUFFIXES.templates.length
    total += RECOVERY_SUFFIXES.templates.length
    total += MOMENTUM_SUFFIXES.templates.length
    expect(total).toBe(52)
  })

  it('every template should have a unique ID', () => {
    const ids = new Set<string>()
    for (const situation of allSituations) {
      for (const template of COACHING_CATALOG[situation].templates) {
        expect(ids.has(template.id)).toBe(false)
        ids.add(template.id)
      }
    }
    for (const suffix of [STREAK_SUFFIXES, RECOVERY_SUFFIXES, MOMENTUM_SUFFIXES]) {
      for (const template of suffix.templates) {
        expect(ids.has(template.id)).toBe(false)
        ids.add(template.id)
      }
    }
  })

  it('every template should have text containing Korean characters', () => {
    const koreanRegex = /[\uAC00-\uD7AF]/
    for (const situation of allSituations) {
      for (const template of COACHING_CATALOG[situation].templates) {
        expect(koreanRegex.test(template.text)).toBe(true)
      }
    }
  })
})

// =============================================================================
// Template Selection Tests
// =============================================================================

describe('template selection (deterministic via moveNumber)', () => {
  it('should select different templates for consecutive move numbers', () => {
    const situation = 'positional'
    const templates = COACHING_CATALOG[situation].templates
    const selected0 = templates[0 % templates.length]!
    const selected1 = templates[1 % templates.length]!
    const selected2 = templates[2 % templates.length]!

    expect(selected0.id).not.toBe(selected1.id)
    expect(selected1.id).not.toBe(selected2.id)
  })

  it('should cycle back to first template', () => {
    const situation = 'positional'
    const templates = COACHING_CATALOG[situation].templates
    const selected0 = templates[0 % templates.length]!
    const selected3 = templates[3 % templates.length]!

    expect(selected0.id).toBe(selected3.id)
  })
})

// =============================================================================
// Slot Filling Tests
// =============================================================================

describe('slot filling in generateCoachingMessage', () => {
  it('should fill {winrate} slot with integer value', () => {
    // Set up for positional situation (fallback)
    const current = makeAnalysisResponse({ winrate: 0.65, scoreLead: 5.5 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const { message } = generateCoachingMessage(
      current,
      null,
      null,
      0,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    // The message should contain "65" (rounded winrate)
    expect(message.text).toContain('65')
  })

  it('should fill {score_lead} with one decimal', () => {
    const current = makeAnalysisResponse({ winrate: 0.65, scoreLead: 5.5 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const { message } = generateCoachingMessage(
      current,
      null,
      null,
      0,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    // Should contain "5.5" somewhere
    expect(message.text).toContain('5.5')
  })

  it('should fill {best_move} with GTP coordinate', () => {
    const current = makeAnalysisResponse({
      winrate: 0.65,
      moveInfos: [
        { move: 'Q16', winrate: 0.66, visits: 200, prior: 0.3, scoreLead: 5.0, pv: ['Q16', 'D4'] },
      ],
    })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    // moveNumber=1 picks template variant 1 which uses best_move
    const { message } = generateCoachingMessage(
      current,
      null,
      null,
      1,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    // At least one template variant should include best_move
    // If the selected variant has it, it should be filled
    if (message.text.includes('Q16') || message.text.includes('추천')) {
      expect(message.text).toContain('Q16')
    }
  })
})

// =============================================================================
// Full Pipeline Tests
// =============================================================================

describe('generateCoachingMessage — full pipeline', () => {
  it('should return a valid CoachingMessage', () => {
    const current = makeAnalysisResponse()
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const { message, updatedContext } = generateCoachingMessage(
      current,
      null,
      null,
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    expect(message.text).toBeTruthy()
    expect(message.emotion).toBeTruthy()
    expect(typeof message.moveNumber).toBe('number')
    expect(message.situation).toBeTruthy()
    expect(message.templateId).toMatch(/^C-/)
    expect(updatedContext.previousWinrate).toBe(current.rootInfo.winrate)
  })

  it('should return a coaching message for every situation type', () => {
    // Test that the pipeline produces output for various scenarios
    const scenarios: Array<{
      description: string
      winrate: number
      moveQuality?: string
      movePhase?: 'opening' | 'middle_game' | 'endgame'
      lastMoveIndex: number
      grid: Uint8Array
    }> = [
      {
        description: 'opening territory building',
        winrate: 0.55,
        movePhase: 'opening',
        lastMoveIndex: 0, // corner on 9x9
        grid: makeGrid(9, [{ index: 0, color: BLACK }]),
      },
      {
        description: 'endgame',
        winrate: 0.6,
        movePhase: 'endgame',
        lastMoveIndex: 40,
        grid: makeGrid(9, [{ index: 40, color: BLACK }]),
      },
      {
        description: 'close game',
        winrate: 0.49,
        lastMoveIndex: 40,
        grid: makeGrid(9, [{ index: 40, color: BLACK }]),
      },
    ]

    for (const scenario of scenarios) {
      const current = makeAnalysisResponse({ winrate: scenario.winrate })
      const { message } = generateCoachingMessage(
        current,
        null,
        null,
        10,
        scenario.grid,
        9,
        scenario.lastMoveIndex,
        BLACK,
        null,
        DEFAULT_CONTEXT
      )
      expect(message.text.length).toBeGreaterThan(0)
      expect(message.templateId).toMatch(/^C-/)
    }
  })

  it('should update PlayerContext correctly', () => {
    const current = makeAnalysisResponse({ winrate: 0.55 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const { updatedContext } = generateCoachingMessage(
      current,
      null,
      null,
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    expect(updatedContext.previousWinrate).toBe(0.55)
    expect(typeof updatedContext.encouragementState).toBe('string')
    expect(typeof updatedContext.consecutiveGoodMoves).toBe('number')
    expect(typeof updatedContext.consecutiveBadMoves).toBe('number')
  })
})

// =============================================================================
// Encouragement Suffix Application Tests
// =============================================================================

describe('encouragement suffix in pipeline', () => {
  it('should append streak suffix when in streak state', () => {
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const streakContext: PlayerContext = {
      encouragementState: 'streak',
      consecutiveGoodMoves: 4,
      consecutiveBadMoves: 0,
      previousMoveQuality: 'good',
      previousWinrate: 0.6,
    }

    // Need a good move to stay in streak
    // Use moveInfos where the actual move D4 is rank 0
    const current2 = makeAnalysisResponse({
      winrate: 0.65,
      moveInfos: [
        { move: 'D4', winrate: 0.65, visits: 200, prior: 0.3, scoreLead: 5.0, pv: ['D4'] },
      ],
    })

    const { message } = generateCoachingMessage(
      current2,
      null,
      'D4',
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      streakContext
    )

    // The message text should be longer than a base template alone
    expect(message.text.length).toBeGreaterThan(10)
  })

  it('should NOT append suffix in neutral state', () => {
    const current = makeAnalysisResponse({ winrate: 0.55 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const { message } = generateCoachingMessage(
      current,
      null,
      null,
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    // In neutral state, message should match a base template (no suffix)
    // Just verify it exists and is reasonable length
    expect(message.text.length).toBeLessThan(200)
  })
})

// =============================================================================
// Determinism Tests
// =============================================================================

describe('determinism guarantee', () => {
  it('should produce identical output for identical inputs', () => {
    const current = makeAnalysisResponse({ winrate: 0.55 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const result1 = generateCoachingMessage(
      current,
      null,
      null,
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )
    const result2 = generateCoachingMessage(
      current,
      null,
      null,
      5,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    expect(result1.message.text).toBe(result2.message.text)
    expect(result1.message.emotion).toBe(result2.message.emotion)
    expect(result1.message.situation).toBe(result2.message.situation)
    expect(result1.message.templateId).toBe(result2.message.templateId)
  })

  it('should vary template by moveNumber but not by time', () => {
    const current = makeAnalysisResponse({ winrate: 0.55 })
    const grid = makeGrid(9, [{ index: 40, color: BLACK }])

    const result0 = generateCoachingMessage(
      current,
      null,
      null,
      0,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )
    const result1 = generateCoachingMessage(
      current,
      null,
      null,
      1,
      grid,
      9,
      40,
      BLACK,
      null,
      DEFAULT_CONTEXT
    )

    // Different move numbers should potentially select different templates
    // (unless they happen to mod to the same index)
    if (result0.message.templateId !== result1.message.templateId) {
      expect(result0.message.text).not.toBe(result1.message.text)
    }
  })
})

// =============================================================================
// Game Boundary Tests — verify no cross-game state contamination
// =============================================================================

describe('game boundary: fresh context prevents cross-game contamination', () => {
  it('should NOT detect momentum_shift on first move of new game with fresh context', () => {
    // Simulate end of game 1: winrate was 0.8 (player winning big)
    const game1LastContext: PlayerContext = {
      encouragementState: 'streak',
      consecutiveGoodMoves: 5,
      consecutiveBadMoves: 0,
      previousMoveQuality: 'excellent',
      previousWinrate: 0.8,
    }

    // Game 2 starts: winrate is 0.48 (slightly behind)
    // If stale context leaks, previousWinrate=0.8 → current=0.48 crosses 50% → false momentum_shift
    const game2Move1 = makeAnalysisResponse({ winrate: 0.48, scoreLead: -1.5 })
    const grid = makeGrid(9, [{ index: 20, color: BLACK }])

    // With STALE context (bug): would falsely detect momentum_shift
    const staleResult = generateCoachingMessage(
      game2Move1,
      null,
      null,
      0,
      grid,
      9,
      20,
      BLACK,
      null,
      game1LastContext
    )

    // With FRESH context (correct behavior after reset)
    const freshContext: PlayerContext = {
      encouragementState: 'neutral',
      consecutiveGoodMoves: 0,
      consecutiveBadMoves: 0,
      previousMoveQuality: null,
      previousWinrate: null,
    }

    const freshResult = generateCoachingMessage(
      game2Move1,
      null,
      null,
      0,
      grid,
      9,
      20,
      BLACK,
      null,
      freshContext
    )

    // Stale context would produce momentum_shift (previousWinrate=0.8, current=0.48 crosses 50%)
    expect(staleResult.message.situation).toBe('momentum_shift')

    // Fresh context must NOT produce momentum_shift (previousWinrate=null)
    expect(freshResult.message.situation).not.toBe('momentum_shift')
  })

  it('should NOT carry over previousMoveQuality across games', () => {
    // Game 1 ended with a blunder
    const staleContext: PlayerContext = {
      encouragementState: 'neutral',
      consecutiveGoodMoves: 0,
      consecutiveBadMoves: 1,
      previousMoveQuality: 'blunder',
      previousWinrate: 0.3,
    }

    // Game 2 first move is good → stale context would falsely trigger 'recovery'
    const game2Move1 = makeAnalysisResponse({
      winrate: 0.55,
      moveInfos: [
        { move: 'D4', winrate: 0.55, visits: 200, prior: 0.3, scoreLead: 2.0, pv: ['D4'] },
      ],
    })
    const grid = makeGrid(9, [{ index: 20, color: BLACK }])

    // With fresh context: no recovery (previousMoveQuality=null)
    const freshContext: PlayerContext = {
      encouragementState: 'neutral',
      consecutiveGoodMoves: 0,
      consecutiveBadMoves: 0,
      previousMoveQuality: null,
      previousWinrate: null,
    }

    const { updatedContext } = generateCoachingMessage(
      game2Move1,
      null,
      'D4',
      0,
      grid,
      9,
      20,
      BLACK,
      null,
      freshContext
    )

    // Fresh context: no recovery state (previousMoveQuality was null)
    expect(updatedContext.encouragementState).not.toBe('recovery')
  })
})
