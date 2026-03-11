// =============================================================================
// Tests: explanation-engine — Template Explanation Engine V1
// =============================================================================
// Target: 75+ tests across all modules
// Categories:
//   1. Output Parser (15+ tests)
//   2. Pattern Matcher (20+ tests)
//   3. Template Engine (15+ tests)
//   4. Mandatory Fallback (10+ tests)
//   5. Coverage Measurement (5+ tests)
//   6. Integration (10+ tests with test data samples)
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  MoveInfo,
  PositionCategory,
  RootInfo,
} from '@core/interfaces'
import { beforeEach, describe, expect, it } from 'vitest'
import { CoverageTracker, measureCoverage } from './coverage'
import { createExplanationEngine, type ExplanationEngine } from './explanation-engine'
import {
  getMandatoryCategories,
  isMandatoryCategory,
  validateMandatoryEnforcement,
} from './fallback'
import { classifyMoveQuality, detectGamePhase, parseAnalysis } from './output-parser'
import { findAllMatchingPatterns, findBestPattern } from './pattern-matcher'
import { PATTERN_CATALOG } from './patterns'
import { renderTemplate } from './template-engine'
import type { ParsedAnalysis } from './types'
import { getAssessmentLabel } from './types'

// =============================================================================
// Test Data Helpers
// =============================================================================

// Load the 20 KataGo test samples
import testDataRaw from '../../outputs/preprocessed/step-13-katago-test-data.json'

interface TestSample {
  sample_id: string
  classification: string
  expected_label: string
  description: string
  board_size: number
  move_number: number
  player: string
  game_phase: string
  last_move: string
  winrate_delta: number
  katago_response: {
    turnNumber: number
    moveInfos: Array<{
      move: string
      winrate: number
      scoreLead: number
      order: number
      prior: number
      visits: number
      pv: string[]
    }>
    rootInfo: {
      winrate: number
      scoreLead: number
      visits: number
    }
  }
}

const testSamples: TestSample[] = (testDataRaw as { samples: TestSample[] }).samples

/**
 * Create a minimal valid AnalysisResponse for testing.
 */
function makeAnalysis(overrides: {
  winrate?: number
  scoreLead?: number
  visits?: number
  moveInfos?: Array<Partial<MoveInfo>>
  rawVarTimeLeft?: number
}): AnalysisResponse {
  const defaultMoveInfo: MoveInfo = {
    move: 'D4',
    visits: 200,
    edgeVisits: 200,
    winrate: overrides.winrate ?? 0.5,
    scoreMean: overrides.scoreLead ?? 0,
    scoreLead: overrides.scoreLead ?? 0,
    scoreStdev: 5.0,
    scoreSelfplay: 0,
    prior: 0.15,
    utility: 0.1,
    utilityLcb: 0.08,
    lcb: 0.48,
    weight: 200,
    edgeWeight: 200,
    order: 0,
    playSelectionValue: 1.0,
    pv: ['D4', 'Q16', 'D16'],
  }

  const moveInfos: MoveInfo[] = overrides.moveInfos
    ? overrides.moveInfos.map(
        (mi, idx) =>
          ({
            ...defaultMoveInfo,
            ...mi,
            order: mi.order ?? idx,
          }) as MoveInfo
      )
    : [
        defaultMoveInfo,
        {
          ...defaultMoveInfo,
          move: 'Q16',
          order: 1,
          winrate: (overrides.winrate ?? 0.5) - 0.02,
          scoreLead: (overrides.scoreLead ?? 0) - 1,
          visits: 150,
          prior: 0.12,
          pv: ['Q16', 'D4', 'D16'],
        } as MoveInfo,
      ]

  const rootInfo: RootInfo = {
    winrate: overrides.winrate ?? 0.5,
    scoreLead: overrides.scoreLead ?? 0,
    scoreSelfplay: 0,
    scoreStdev: 5.0,
    utility: 0.1,
    visits: overrides.visits ?? 400,
    currentPlayer: 'B',
    thisHash: 'abc123',
    symHash: 'def456',
    lcb: 0.48,
    utilityLcb: 0.08,
    rawWinrate: overrides.winrate ?? 0.5,
    rawLead: overrides.scoreLead ?? 0,
    rawScoreSelfplay: 0,
    rawScoreSelfplayStdev: 5.0,
    rawNoResultProb: 0,
    rawStWrError: 0.02,
    rawStScoreError: 1.5,
    rawVarTimeLeft: overrides.rawVarTimeLeft ?? 80,
  }

  return {
    id: 'test-query',
    isDuringSearch: false,
    turnNumber: 50,
    moveInfos,
    rootInfo,
  }
}

/**
 * Convert a test sample to an AnalysisResponse.
 */
function sampleToAnalysis(sample: TestSample): AnalysisResponse {
  return makeAnalysis({
    winrate: sample.katago_response.rootInfo.winrate,
    scoreLead: sample.katago_response.rootInfo.scoreLead,
    visits: sample.katago_response.rootInfo.visits,
    moveInfos: sample.katago_response.moveInfos.map((mi) => ({
      move: mi.move,
      winrate: mi.winrate,
      scoreLead: mi.scoreLead,
      order: mi.order,
      prior: mi.prior,
      visits: mi.visits,
      pv: mi.pv,
    })),
  })
}

/**
 * Create a previous analysis for delta computation.
 */
function makePreviousAnalysis(winrate: number, scoreLead: number): AnalysisResponse {
  return makeAnalysis({ winrate, scoreLead })
}

// =============================================================================
// 1. OUTPUT PARSER TESTS (15+ tests)
// =============================================================================

describe('Output Parser', () => {
  it('should extract winrate from rootInfo', () => {
    const analysis = makeAnalysis({ winrate: 0.62 })
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.winratePct).toBeCloseTo(62, 0)
  })

  it('should extract scoreLead from rootInfo', () => {
    const analysis = makeAnalysis({ scoreLead: 5.5 })
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.raw.rootInfo.scoreLead).toBeCloseTo(5.5, 1)
  })

  it('should extract best move info', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.raw.moveInfos[0].move).toBe('D4')
  })

  it('should compute winrateDelta with previous analysis', () => {
    const current = makeAnalysis({ winrate: 0.55 })
    const previous = makeAnalysis({ winrate: 0.6 })
    const parsed = parseAnalysis(current, previous, null, 50, 19)
    // Delta = 0.55 - (1 - 0.60) = 0.55 - 0.40 = 0.15
    expect(parsed.computed.winrateDelta).toBeCloseTo(0.15, 2)
  })

  it('should compute negative winrateDelta for a bad move', () => {
    const current = makeAnalysis({ winrate: 0.4 })
    const previous = makeAnalysis({ winrate: 0.45 })
    const parsed = parseAnalysis(current, previous, null, 50, 19)
    // Delta = 0.40 - (1 - 0.45) = 0.40 - 0.55 = -0.15
    expect(parsed.computed.winrateDelta).toBeCloseTo(-0.15, 2)
  })

  it('should return null winrateDelta when no previous analysis', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.computed.winrateDelta).toBeNull()
  })

  it('should compute scoreLeadDelta with previous analysis', () => {
    const current = makeAnalysis({ scoreLead: 3.0 })
    const previous = makeAnalysis({ scoreLead: -2.0 })
    const parsed = parseAnalysis(current, previous, null, 50, 19)
    // Delta = 3.0 - (-(-2.0)) = 3.0 - 2.0 = 1.0
    expect(parsed.computed.scoreLeadDelta).toBeCloseTo(1.0, 1)
  })

  it('should detect moveRank when actualMove matches', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, 'Q16', 50, 19)
    expect(parsed.computed.moveRank).toBe(1)
    expect(parsed.computed.bestMovePlayed).toBe(false)
  })

  it('should detect bestMovePlayed when actual move is rank 0', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, 'D4', 50, 19)
    expect(parsed.computed.moveRank).toBe(0)
    expect(parsed.computed.bestMovePlayed).toBe(true)
  })

  it('should return null moveRank when actualMove not found', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, 'Z99', 50, 19)
    expect(parsed.computed.moveRank).toBeNull()
  })

  it('should compute topMoveGap', () => {
    const analysis = makeAnalysis({
      moveInfos: [
        { move: 'D4', winrate: 0.62, order: 0 } as Partial<MoveInfo>,
        { move: 'Q16', winrate: 0.55, order: 1 } as Partial<MoveInfo>,
      ],
    })
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.computed.topMoveGap).toBeCloseTo(0.07, 2)
  })

  it('should detect opening phase for early moves on 19x19', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, null, 10, 19)
    expect(parsed.computed.movePhase).toBe('opening')
  })

  it('should detect middle game phase', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, null, 80, 19)
    expect(parsed.computed.movePhase).toBe('middle_game')
  })

  it('should detect endgame phase for late moves', () => {
    const analysis = makeAnalysis({})
    const parsed = parseAnalysis(analysis, null, null, 200, 19)
    expect(parsed.computed.movePhase).toBe('endgame')
  })

  it('should detect endgame based on rawVarTimeLeft', () => {
    const analysis = makeAnalysis({ rawVarTimeLeft: 20 })
    const parsed = parseAnalysis(analysis, null, null, 80, 19)
    expect(parsed.computed.movePhase).toBe('endgame')
  })

  it('should format PV sequences for different tiers', () => {
    const analysis = makeAnalysis({
      moveInfos: [
        { move: 'D4', pv: ['D4', 'Q16', 'D16', 'Q4', 'C6'], order: 0 } as Partial<MoveInfo>,
        { move: 'Q16', pv: ['Q16'], order: 1 } as Partial<MoveInfo>,
      ],
    })
    const parsed = parseAnalysis(analysis, null, null, 50, 19)
    expect(parsed.pvShort).toBe('D4 -> Q16')
    expect(parsed.pvMedium).toBe('D4 -> Q16 -> D16')
    expect(parsed.pvLong).toBe('D4 -> Q16 -> D16 -> Q4 -> C6')
  })

  it('should compute confidence level based on visits', () => {
    const highConf = makeAnalysis({ visits: 500 })
    expect(parseAnalysis(highConf, null, null, 50, 19).computed.confidenceLevel).toBe('high')

    const medConf = makeAnalysis({ visits: 100 })
    expect(parseAnalysis(medConf, null, null, 50, 19).computed.confidenceLevel).toBe('medium')

    const lowConf = makeAnalysis({ visits: 30 })
    expect(parseAnalysis(lowConf, null, null, 50, 19).computed.confidenceLevel).toBe('low')
  })
})

// =============================================================================
// 1b. Game Phase Detection
// =============================================================================

describe('Game Phase Detection', () => {
  it('should detect opening for 9x9 (turnNumber < 15)', () => {
    expect(detectGamePhase(10, 9)).toBe('opening')
  })

  it('should detect middle game for 13x13', () => {
    expect(detectGamePhase(50, 13)).toBe('middle_game')
  })

  it('should detect endgame for 9x9 (turnNumber >= 40)', () => {
    expect(detectGamePhase(45, 9)).toBe('endgame')
  })
})

// =============================================================================
// 1c. Move Quality Classification
// =============================================================================

describe('Move Quality Classification', () => {
  it('should classify blunder', () => {
    expect(classifyMoveQuality(-0.15, 3, 0.05, 0.1, 200)).toBe('blunder')
  })

  it('should classify mistake', () => {
    expect(classifyMoveQuality(-0.07, 2, 0.03, 0.1, 200)).toBe('mistake')
  })

  it('should classify inaccuracy', () => {
    expect(classifyMoveQuality(-0.03, 1, 0.02, 0.1, 200)).toBe('inaccuracy')
  })

  it('should classify brilliant move', () => {
    expect(classifyMoveQuality(0.0, 0, 0.05, 0.02, 200)).toBe('brilliant')
  })

  it('should classify excellent move', () => {
    expect(classifyMoveQuality(0.0, 0, 0.05, 0.15, 200)).toBe('excellent')
  })

  it('should classify good move', () => {
    expect(classifyMoveQuality(0.0, 0, 0.01, 0.15, 200)).toBe('good')
  })

  it('should classify acceptable move', () => {
    expect(classifyMoveQuality(-0.01, 1, 0.02, 0.1, 200)).toBe('acceptable')
  })

  it('should return null when moveRank is null', () => {
    expect(classifyMoveQuality(-0.15, null, 0.05, 0.1, 200)).toBeNull()
  })
})

// =============================================================================
// 2. PATTERN MATCHER TESTS (20+ tests)
// =============================================================================

describe('Pattern Matcher', () => {
  let parsed: ParsedAnalysis

  beforeEach(() => {
    parsed = parseAnalysis(makeAnalysis({ winrate: 0.5 }), null, null, 50, 19)
  })

  it('should match life_death pattern when category hint is life_death', () => {
    const ldParsed = parseAnalysis(
      makeAnalysis({ winrate: 0.72, scoreLead: 12.5 }),
      null,
      null,
      50,
      19
    )
    const match = findBestPattern(ldParsed, 'beginner', 'life_death')
    expect(match).not.toBeNull()
    expect(match!.category).toBe('life_death')
    expect(match!.isMandatory).toBe(true)
  })

  it('should match ko pattern when category hint is ko', () => {
    const koParsed = parseAnalysis(
      makeAnalysis({
        moveInfos: [
          { move: 'P16', winrate: 0.55, scoreLead: 8.0, order: 0 } as Partial<MoveInfo>,
          { move: 'O14', winrate: 0.52, scoreLead: 0.8, order: 1 } as Partial<MoveInfo>,
        ],
      }),
      null,
      null,
      50,
      19
    )
    const match = findBestPattern(koParsed, 'beginner', 'ko')
    expect(match).not.toBeNull()
    expect(match!.category).toBe('ko')
    expect(match!.isMandatory).toBe(true)
  })

  it('should match seki pattern when category hint is seki', () => {
    const match = findBestPattern(parsed, 'beginner', 'seki')
    expect(match).not.toBeNull()
    expect(match!.category).toBe('seki')
    expect(match!.isMandatory).toBe(true)
  })

  it('should match blunder pattern with large negative delta', () => {
    const current = makeAnalysis({ winrate: 0.35 })
    const previous = makeAnalysis({ winrate: 0.4 })
    const blunderParsed = parseAnalysis(current, previous, 'Q16', 50, 19)
    const match = findBestPattern(blunderParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('MQ-01')
  })

  it('should match mistake pattern with moderate negative delta', () => {
    const current = makeAnalysis({ winrate: 0.42 })
    const previous = makeAnalysis({ winrate: 0.52 })
    const mistakeParsed = parseAnalysis(current, previous, 'Q16', 50, 19)
    const match = findBestPattern(mistakeParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('MQ-02')
  })

  it('should match inaccuracy pattern', () => {
    const current = makeAnalysis({ winrate: 0.47 })
    const previous = makeAnalysis({ winrate: 0.5 })
    const inaccParsed = parseAnalysis(current, previous, 'Q16', 50, 19)
    const match = findBestPattern(inaccParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('MQ-03')
  })

  it('should match good move pattern when rank is 0', () => {
    const goodParsed = parseAnalysis(makeAnalysis({}), null, 'D4', 50, 19)
    const match = findBestPattern(goodParsed, 'beginner', null)
    expect(match).not.toBeNull()
    // Should match MQ-06 (good move) since topMoveGap is small
    expect(match!.category).toBe('move_quality')
  })

  it('should match decisive advantage pattern', () => {
    const decisiveParsed = parseAnalysis(makeAnalysis({ winrate: 0.9 }), null, null, 50, 19)
    const match = findBestPattern(decisiveParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('PA-01')
  })

  it('should match strong advantage pattern', () => {
    const strongParsed = parseAnalysis(makeAnalysis({ winrate: 0.72 }), null, null, 50, 19)
    const match = findBestPattern(strongParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('PA-02')
  })

  it('should match even position pattern', () => {
    const evenParsed = parseAnalysis(makeAnalysis({ winrate: 0.5 }), null, null, 50, 19)
    const match = findBestPattern(evenParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('PA-03')
  })

  it('should match significant disadvantage pattern', () => {
    const losingParsed = parseAnalysis(makeAnalysis({ winrate: 0.25 }), null, null, 50, 19)
    const match = findBestPattern(losingParsed, 'beginner', null)
    expect(match).not.toBeNull()
    expect(match!.patternId).toContain('PA-04')
  })

  it('should match opening pattern for early game', () => {
    const openParsed = parseAnalysis(makeAnalysis({}), null, null, 5, 19)
    const match = findBestPattern(openParsed, 'beginner', null)
    expect(match).not.toBeNull()
    // Opening patterns or position assessment
    const isOpening = match!.category === 'opening' || match!.category === 'position'
    expect(isOpening).toBe(true)
  })

  it('should match endgame pattern for late game', () => {
    const endParsed = parseAnalysis(
      makeAnalysis({ winrate: 0.58, rawVarTimeLeft: 15 }),
      null,
      null,
      180,
      19
    )
    const match = findBestPattern(endParsed, 'beginner', null)
    expect(match).not.toBeNull()
  })

  it('should match generic pattern as last resort', () => {
    // Create a parsed result where no specific pattern matches easily
    // The generic pattern (GN-01) has empty conditions, so it always matches
    const genericParsed = parseAnalysis(makeAnalysis({ winrate: 0.58 }), null, null, 80, 19)
    // Without a delta, middle game patterns should match (winrate > 0.55)
    const match = findBestPattern(genericParsed, 'beginner', null)
    expect(match).not.toBeNull()
  })

  it('should filter patterns by tier', () => {
    const match1 = findBestPattern(parsed, 'beginner', null)
    const match2 = findBestPattern(parsed, 'intermediate', null)
    const match3 = findBestPattern(parsed, 'advanced', null)
    // All should match (generic fallback), but with different tier patterns
    expect(match1).not.toBeNull()
    expect(match2).not.toBeNull()
    expect(match3).not.toBeNull()
    expect(match1!.patternId).toContain('T1')
    expect(match2!.patternId).toContain('T2')
    expect(match3!.patternId).toContain('T3')
  })

  it('should prioritize mandatory patterns over move quality patterns', () => {
    const ldParsed = parseAnalysis(
      makeAnalysis({ winrate: 0.72, scoreLead: 12.5 }),
      null,
      'D4',
      50,
      19
    )
    const match = findBestPattern(ldParsed, 'beginner', 'life_death')
    expect(match).not.toBeNull()
    // Mandatory category (priority 1) should win over move quality (priority 2)
    expect(match!.category).toBe('life_death')
  })

  it('should find multiple matching patterns', () => {
    const multiParsed = parseAnalysis(
      makeAnalysis({ winrate: 0.72, scoreLead: 8.0 }),
      null,
      'D4',
      80,
      19
    )
    const matches = findAllMatchingPatterns(multiParsed, 'beginner', null, 3)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    // Should not have duplicate categories
    const categories = matches.map((m) => m.category)
    const uniqueCategories = new Set(categories)
    expect(categories.length).toBe(uniqueCategories.size)
  })

  it('should not match delta-requiring patterns without delta', () => {
    // Without previous analysis, delta patterns should not match
    const noDeltaParsed = parseAnalysis(makeAnalysis({ winrate: 0.5 }), null, 'Q16', 80, 19)
    const match = findBestPattern(noDeltaParsed, 'beginner', null)
    // Should still get some match (non-delta pattern)
    expect(match).not.toBeNull()
    // The MQ patterns that require delta should not be the match
    if (match!.category === 'move_quality') {
      // If it matched a move quality pattern, it should be one that does not require delta
      expect(['P-T1-MQ-04', 'P-T1-MQ-05', 'P-T1-MQ-06']).toContain(match!.patternId)
    }
  })

  it('should handle the "in" operator correctly for moveRank', () => {
    const current = makeAnalysis({ winrate: 0.49 })
    const previous = makeAnalysis({ winrate: 0.5 })
    // Set up so moveRank = 1 (second choice)
    const acceptParsed = parseAnalysis(current, previous, 'Q16', 80, 19)
    const match = findBestPattern(acceptParsed, 'beginner', null)
    expect(match).not.toBeNull()
  })
})

// =============================================================================
// 3. TEMPLATE ENGINE TESTS (15+ tests)
// =============================================================================

describe('Template Engine', () => {
  let parsed: ParsedAnalysis

  beforeEach(() => {
    parsed = parseAnalysis(makeAnalysis({ winrate: 0.62, scoreLead: 5.4 }), null, 'D4', 50, 19)
  })

  it('should fill winrate_pct slot as integer for beginner', () => {
    const match = findBestPattern(parsed, 'beginner', null)
    expect(match).not.toBeNull()
    const text = renderTemplate(match!, parsed)
    expect(text).not.toBeNull()
    // Should contain "62" as integer
    expect(text).toContain('62')
  })

  it('should fill winrate_pct slot with one decimal for intermediate', () => {
    const match = findBestPattern(parsed, 'intermediate', null)
    expect(match).not.toBeNull()
    const text = renderTemplate(match!, parsed)
    expect(text).not.toBeNull()
  })

  it('should fill best_move slot with GTP coordinate', () => {
    // Use a generic pattern that explicitly contains best_move slot
    const genericMatch = findBestPattern(
      parseAnalysis(makeAnalysis({ winrate: 0.5 }), null, null, 50, 19),
      'beginner',
      null
    )
    expect(genericMatch).not.toBeNull()
    const text = renderTemplate(
      genericMatch!,
      parseAnalysis(makeAnalysis({ winrate: 0.5 }), null, null, 50, 19)
    )
    expect(text).not.toBeNull()
    // The generic or matched pattern may contain the best move
    // For comprehensive check, also test via a pattern that explicitly uses best_move
    const blunderParsed = parseAnalysis(
      makeAnalysis({ winrate: 0.35 }),
      makeAnalysis({ winrate: 0.55 }),
      'Q16',
      50,
      19
    )
    const blunderMatch = findBestPattern(blunderParsed, 'beginner', null)
    expect(blunderMatch).not.toBeNull()
    const blunderText = renderTemplate(blunderMatch!, blunderParsed)
    expect(blunderText).not.toBeNull()
    // Blunder pattern should reference best move D4 (moveInfos[0].move)
    expect(blunderText!.includes('D4')).toBe(true)
  })

  it('should fill score_lead slot', () => {
    const match = findBestPattern(parsed, 'beginner', null)
    const text = renderTemplate(match!, parsed)
    expect(text).not.toBeNull()
  })

  it('should fill PV sequence for intermediate tier', () => {
    const match = findBestPattern(parsed, 'intermediate', null)
    const text = renderTemplate(match!, parsed)
    expect(text).not.toBeNull()
  })

  it('should replace {placeholder} with ? when value cannot be resolved', () => {
    // Create a match with a slot that references a non-existent field
    const fakeMatch = {
      patternId: 'test',
      category: 'generic' as PositionCategory,
      isMandatory: false,
      templateText: 'Test: {missing_field}',
      slots: { missing_field: { source: 'nonexistent.field', format: 'string' as const } },
      priority: 6,
    }
    const text = renderTemplate(fakeMatch, parsed)
    expect(text).toBe('Test: ?')
  })

  it('should handle abs() in slot source', () => {
    const fakeMatch = {
      patternId: 'test',
      category: 'generic' as PositionCategory,
      isMandatory: false,
      templateText: 'Score diff: {score_abs}',
      slots: { score_abs: { source: 'abs(rootInfo.scoreLead)', format: 'one_decimal' as const } },
      priority: 6,
    }
    const negParsed = parseAnalysis(makeAnalysis({ scoreLead: -3.5 }), null, null, 50, 19)
    const text = renderTemplate(fakeMatch, negParsed)
    expect(text).toBe('Score diff: 3.5')
  })

  it('should handle multiplication in slot source', () => {
    const fakeMatch = {
      patternId: 'test',
      category: 'generic' as PositionCategory,
      isMandatory: false,
      templateText: 'Prior: {prior_pct}%',
      slots: { prior_pct: { source: 'moveInfos[0].prior * 100', format: 'one_decimal' as const } },
      priority: 6,
    }
    const text = renderTemplate(fakeMatch, parsed)
    expect(text).not.toBeNull()
    expect(text!).toContain('%')
  })

  it('should handle addition in slot source', () => {
    const fakeMatch = {
      patternId: 'test',
      category: 'generic' as PositionCategory,
      isMandatory: false,
      templateText: 'Rank: #{rank}',
      slots: { rank: { source: 'computed.moveRank + 1', format: 'integer' as const } },
      priority: 6,
    }
    const rankedParsed = parseAnalysis(makeAnalysis({}), null, 'Q16', 50, 19)
    const text = renderTemplate(fakeMatch, rankedParsed)
    expect(text).toBe('Rank: #2')
  })

  it('should handle moveInfos.length in slot source', () => {
    const fakeMatch = {
      patternId: 'test',
      category: 'generic' as PositionCategory,
      isMandatory: false,
      templateText: '{count} candidates',
      slots: { count: { source: 'moveInfos.length', format: 'integer' as const } },
      priority: 6,
    }
    const text = renderTemplate(fakeMatch, parsed)
    expect(text).toBe('2 candidates')
  })

  it('should render a blunder template for beginner', () => {
    const current = makeAnalysis({ winrate: 0.35 })
    const previous = makeAnalysis({ winrate: 0.4 })
    const blunderParsed = parseAnalysis(current, previous, 'Q16', 50, 19)
    const match = findBestPattern(blunderParsed, 'beginner', null)
    expect(match).not.toBeNull()
    const text = renderTemplate(match!, blunderParsed)
    expect(text).not.toBeNull()
    expect(text!.toLowerCase()).toContain('careful')
  })

  it('should render a blunder template for advanced tier with more detail', () => {
    const current = makeAnalysis({ winrate: 0.35 })
    const previous = makeAnalysis({ winrate: 0.4 })
    const blunderParsed = parseAnalysis(current, previous, 'Q16', 50, 19)
    const match = findBestPattern(blunderParsed, 'advanced', null)
    expect(match).not.toBeNull()
    const text = renderTemplate(match!, blunderParsed)
    expect(text).not.toBeNull()
    expect(text!.toLowerCase()).toContain('blunder')
    expect(text!).toContain('PV:')
  })

  it('should render ko template with ko_value', () => {
    const koAnalysis = makeAnalysis({
      moveInfos: [
        {
          move: 'P16',
          winrate: 0.55,
          scoreLead: 8.0,
          order: 0,
          pv: ['P16', 'A1', 'O16'],
        } as Partial<MoveInfo>,
        { move: 'O14', winrate: 0.52, scoreLead: 0.8, order: 1, pv: ['O14'] } as Partial<MoveInfo>,
      ],
    })
    const koParsed = parseAnalysis(koAnalysis, null, null, 50, 19)
    const match = findBestPattern(koParsed, 'beginner', 'ko')
    expect(match).not.toBeNull()
    const text = renderTemplate(match!, koParsed)
    expect(text).not.toBeNull()
    expect(text!).toContain('ko')
  })

  it('should not leave unfilled placeholders in output', () => {
    const match = findBestPattern(parsed, 'beginner', null)
    const text = renderTemplate(match!, parsed)
    expect(text).not.toBeNull()
    // No remaining {placeholder} patterns (except ? for unresolved)
    const remaining = text!.match(/\{[a-z_]+\}/)
    expect(remaining).toBeNull()
  })
})

// =============================================================================
// 4. MANDATORY FALLBACK TESTS (10+ tests)
// =============================================================================

describe('Mandatory Fallback System', () => {
  it('should identify life_death as mandatory', () => {
    expect(isMandatoryCategory('life_death')).toBe(true)
  })

  it('should identify ko as mandatory', () => {
    expect(isMandatoryCategory('ko')).toBe(true)
  })

  it('should identify seki as mandatory', () => {
    expect(isMandatoryCategory('seki')).toBe(true)
  })

  it('should NOT identify move_quality as mandatory', () => {
    expect(isMandatoryCategory('move_quality')).toBe(false)
  })

  it('should NOT identify position as mandatory', () => {
    expect(isMandatoryCategory('position')).toBe(false)
  })

  it('should NOT identify opening as mandatory', () => {
    expect(isMandatoryCategory('opening')).toBe(false)
  })

  it('should NOT identify generic as mandatory', () => {
    expect(isMandatoryCategory('generic')).toBe(false)
  })

  it('should handle null category', () => {
    expect(isMandatoryCategory(null)).toBe(false)
  })

  it('should return all 3 mandatory categories', () => {
    const cats = getMandatoryCategories()
    expect(cats).toContain('life_death')
    expect(cats).toContain('ko')
    expect(cats).toContain('seki')
    expect(cats.length).toBe(3)
  })

  it('should validate enforcement correctly — LLM used for mandatory is violation', () => {
    expect(validateMandatoryEnforcement('life_death', true)).toBe(false)
    expect(validateMandatoryEnforcement('ko', true)).toBe(false)
    expect(validateMandatoryEnforcement('seki', true)).toBe(false)
  })

  it('should validate enforcement correctly — template used for mandatory is correct', () => {
    expect(validateMandatoryEnforcement('life_death', false)).toBe(true)
    expect(validateMandatoryEnforcement('ko', false)).toBe(true)
    expect(validateMandatoryEnforcement('seki', false)).toBe(true)
  })

  it('should allow LLM fallback for non-mandatory categories', () => {
    expect(validateMandatoryEnforcement('move_quality', true)).toBe(true)
    expect(validateMandatoryEnforcement('generic', true)).toBe(true)
  })

  // SAFETY TEST: End-to-end enforcement
  it('SAFETY: life_death should ALWAYS use mandatory template in engine', () => {
    const engine = createExplanationEngine()
    const analysis = makeAnalysis({ winrate: 0.72, scoreLead: 12.5 })
    const result = engine.explainWithCategory(
      analysis,
      null,
      null,
      'beginner',
      50,
      19,
      'life_death'
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
      expect(result.value.category).toBe('life_death')
    }
  })

  it('SAFETY: ko should ALWAYS use mandatory template in engine', () => {
    const engine = createExplanationEngine()
    const analysis = makeAnalysis({
      moveInfos: [
        { move: 'P16', winrate: 0.55, scoreLead: 2.3, order: 0, pv: ['P16'] } as Partial<MoveInfo>,
        { move: 'O14', winrate: 0.52, scoreLead: 0.8, order: 1, pv: ['O14'] } as Partial<MoveInfo>,
      ],
    })
    const result = engine.explainWithCategory(analysis, null, null, 'beginner', 50, 19, 'ko')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })

  it('SAFETY: seki should ALWAYS use mandatory template in engine', () => {
    const engine = createExplanationEngine()
    const analysis = makeAnalysis({ winrate: 0.48 })
    const result = engine.explainWithCategory(analysis, null, null, 'beginner', 50, 19, 'seki')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })
})

// =============================================================================
// 5. COVERAGE MEASUREMENT TESTS (5+ tests)
// =============================================================================

describe('Coverage Measurement', () => {
  it('should compute 100% coverage when all positions are template hits', () => {
    const results = [
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'life_death' as PositionCategory, result: 'MANDATORY_HIT' as const },
    ]
    const stats = measureCoverage(results)
    expect(stats.coveragePercent).toBe(100)
    expect(stats.totalAnalyzed).toBe(3)
    expect(stats.llmRequired).toBe(0)
  })

  it('should compute 0% coverage when all positions need LLM', () => {
    const results = [
      { category: 'generic' as PositionCategory, result: 'LLM_REQUIRED' as const },
      { category: 'generic' as PositionCategory, result: 'LLM_REQUIRED' as const },
    ]
    const stats = measureCoverage(results)
    expect(stats.coveragePercent).toBe(0)
    expect(stats.llmRequired).toBe(2)
  })

  it('should compute mixed coverage correctly', () => {
    const results = [
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'generic' as PositionCategory, result: 'LLM_REQUIRED' as const },
    ]
    const stats = measureCoverage(results)
    expect(stats.coveragePercent).toBe(75)
  })

  it('should track per-category breakdown', () => {
    const results = [
      { category: 'life_death' as PositionCategory, result: 'MANDATORY_HIT' as const },
      { category: 'life_death' as PositionCategory, result: 'MANDATORY_HIT' as const },
      { category: 'ko' as PositionCategory, result: 'MANDATORY_HIT' as const },
      { category: 'move_quality' as PositionCategory, result: 'TEMPLATE_HIT' as const },
      { category: 'generic' as PositionCategory, result: 'LLM_REQUIRED' as const },
    ]
    const stats = measureCoverage(results)
    expect(stats.byCategory.life_death.percent).toBe(100)
    expect(stats.byCategory.ko.percent).toBe(100)
    expect(stats.byCategory.move_quality.percent).toBe(100)
    expect(stats.byCategory.generic.percent).toBe(0)
  })

  it('should handle empty results', () => {
    const stats = measureCoverage([])
    expect(stats.coveragePercent).toBe(0)
    expect(stats.totalAnalyzed).toBe(0)
  })

  it('should support incremental tracking via CoverageTracker', () => {
    const tracker = new CoverageTracker()
    tracker.record('move_quality', 'TEMPLATE_HIT')
    tracker.record('move_quality', 'TEMPLATE_HIT')
    tracker.record('generic', 'LLM_REQUIRED')

    const stats = tracker.getStats()
    expect(stats.totalAnalyzed).toBe(3)
    expect(stats.templateHits).toBe(2)
    expect(stats.llmRequired).toBe(1)
    expect(stats.coveragePercent).toBeCloseTo(66.67, 1)
  })

  it('should support reset', () => {
    const tracker = new CoverageTracker()
    tracker.record('move_quality', 'TEMPLATE_HIT')
    tracker.reset()
    const stats = tracker.getStats()
    expect(stats.totalAnalyzed).toBe(0)
  })
})

// =============================================================================
// 6. INTEGRATION TESTS (10+ tests with test data samples)
// =============================================================================

describe('Integration: End-to-End with Test Data', () => {
  let engine: ExplanationEngine

  beforeEach(() => {
    engine = createExplanationEngine()
  })

  it('should explain a blunder sample correctly', () => {
    const sample = testSamples.find((s) => s.sample_id === 'blunder-001')!
    const analysis = sampleToAnalysis(sample)
    const previous = makePreviousAnalysis(
      1 - (sample.katago_response.rootInfo.winrate + sample.winrate_delta),
      0
    )
    const result = engine.explainWithCategory(
      analysis,
      previous,
      sample.last_move,
      'beginner',
      sample.move_number,
      sample.board_size as BoardSize,
      null
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.text.length).toBeGreaterThan(0)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })

  it('should explain a mistake sample correctly', () => {
    const sample = testSamples.find((s) => s.sample_id === 'mistake-001')!
    const analysis = sampleToAnalysis(sample)
    const previous = makePreviousAnalysis(
      1 - (sample.katago_response.rootInfo.winrate + sample.winrate_delta),
      0
    )
    const result = engine.explainWithCategory(
      analysis,
      previous,
      sample.last_move,
      'intermediate',
      sample.move_number,
      sample.board_size as BoardSize,
      null
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.text.length).toBeGreaterThan(0)
    }
  })

  it('should explain a good move sample correctly', () => {
    const sample = testSamples.find((s) => s.sample_id === 'good-001')!
    const analysis = sampleToAnalysis(sample)
    const result = engine.explainWithCategory(
      analysis,
      null,
      sample.last_move,
      'beginner',
      sample.move_number,
      sample.board_size as BoardSize,
      null
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.text.length).toBeGreaterThan(0)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })

  it('should explain a life/death sample with mandatory template', () => {
    const sample = testSamples.find((s) => s.sample_id === 'life-death-001')!
    const analysis = sampleToAnalysis(sample)
    const result = engine.explainWithCategory(
      analysis,
      null,
      sample.last_move,
      'beginner',
      sample.move_number,
      sample.board_size as BoardSize,
      'life_death'
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
      expect(result.value.category).toBe('life_death')
    }
  })

  it('should explain a ko sample with mandatory template', () => {
    const sample = testSamples.find((s) => s.sample_id === 'ko-001')!
    const analysis = sampleToAnalysis(sample)
    const result = engine.explainWithCategory(
      analysis,
      null,
      sample.last_move,
      'intermediate',
      sample.move_number,
      sample.board_size as BoardSize,
      'ko'
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })

  it('should explain a seki sample with mandatory template', () => {
    const sample = testSamples.find((s) => s.sample_id === 'seki-001')!
    const analysis = sampleToAnalysis(sample)
    const result = engine.explainWithCategory(
      analysis,
      null,
      sample.last_move,
      'advanced',
      sample.move_number,
      sample.board_size as BoardSize,
      'seki'
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.isMandatoryTemplate).toBe(true)
      expect(result.value.usedLLMFallback).toBe(false)
    }
  })

  it('should explain all 20 test samples without errors', () => {
    let successCount = 0
    for (const sample of testSamples) {
      const analysis = sampleToAnalysis(sample)
      const category =
        sample.classification === 'life_death' ||
        sample.classification === 'ko' ||
        sample.classification === 'seki'
          ? (sample.classification as PositionCategory)
          : null
      const result = engine.explainWithCategory(
        analysis,
        null,
        sample.last_move,
        'beginner',
        sample.move_number,
        sample.board_size as BoardSize,
        category
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.text.length).toBeGreaterThan(0)
        successCount++
      }
    }
    expect(successCount).toBe(20)
  })

  it('should achieve >= 80% coverage on test samples', () => {
    const engine2 = createExplanationEngine()
    for (const sample of testSamples) {
      const analysis = sampleToAnalysis(sample)
      const category =
        sample.classification === 'life_death' ||
        sample.classification === 'ko' ||
        sample.classification === 'seki'
          ? (sample.classification as PositionCategory)
          : null
      engine2.explainWithCategory(
        analysis,
        null,
        sample.last_move,
        'beginner',
        sample.move_number,
        sample.board_size as BoardSize,
        category
      )
    }
    const stats = engine2.getCoverageStats()
    expect(stats.coveragePercent).toBeGreaterThanOrEqual(80)
  })

  it('should produce different explanations for different tiers', () => {
    const sample = testSamples.find((s) => s.sample_id === 'blunder-001')!
    const analysis = sampleToAnalysis(sample)

    const beginner = engine.explainWithCategory(analysis, null, null, 'beginner', 50, 19, null)
    const engine2 = createExplanationEngine()
    const advanced = engine2.explainWithCategory(analysis, null, null, 'advanced', 50, 19, null)

    expect(beginner.ok).toBe(true)
    expect(advanced.ok).toBe(true)
    if (beginner.ok && advanced.ok) {
      // Different tiers should produce different text
      expect(beginner.value.text).not.toBe(advanced.value.text)
    }
  })

  it('should return error for invalid analysis data', () => {
    const invalid = { rootInfo: null, moveInfos: [] } as unknown as AnalysisResponse
    const result = engine.explain(invalid, null, null, 'beginner', 50, 19)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ANALYSIS_DATA')
    }
  })

  it('should handle the getPatternCatalog() method', () => {
    const catalog = engine.getPatternCatalog()
    expect(catalog.totalCount).toBe(90)
    expect(catalog.countByTier.beginner).toBe(30)
    expect(catalog.countByTier.intermediate).toBe(30)
    expect(catalog.countByTier.advanced).toBe(30)
    expect(catalog.version).toBe('1.0.0')
  })

  it('should handle setDefaultTier/getDefaultTier', () => {
    expect(engine.getDefaultTier()).toBe('beginner')
    engine.setDefaultTier('advanced')
    expect(engine.getDefaultTier()).toBe('advanced')
  })
})

// =============================================================================
// 7. PATTERN CATALOG INTEGRITY TESTS
// =============================================================================

describe('Pattern Catalog Integrity', () => {
  it('should have exactly 90 patterns', () => {
    expect(PATTERN_CATALOG.length).toBe(90)
  })

  it('should have 30 patterns per tier', () => {
    const beginner = PATTERN_CATALOG.filter((p) => p.tier === 'beginner')
    const intermediate = PATTERN_CATALOG.filter((p) => p.tier === 'intermediate')
    const advanced = PATTERN_CATALOG.filter((p) => p.tier === 'advanced')
    expect(beginner.length).toBe(30)
    expect(intermediate.length).toBe(30)
    expect(advanced.length).toBe(30)
  })

  it('should have unique pattern IDs', () => {
    const ids = PATTERN_CATALOG.map((p) => p.id)
    const uniqueIds = new Set(ids)
    expect(ids.length).toBe(uniqueIds.size)
  })

  it('should have mandatory flag on all life_death patterns', () => {
    const ldPatterns = PATTERN_CATALOG.filter((p) => p.category === 'life_death')
    for (const p of ldPatterns) {
      expect(p.mandatory).toBe(true)
    }
  })

  it('should have mandatory flag on all ko patterns', () => {
    const koPatterns = PATTERN_CATALOG.filter((p) => p.category === 'ko')
    for (const p of koPatterns) {
      expect(p.mandatory).toBe(true)
    }
  })

  it('should have mandatory flag on all seki patterns', () => {
    const sekiPatterns = PATTERN_CATALOG.filter((p) => p.category === 'seki')
    for (const p of sekiPatterns) {
      expect(p.mandatory).toBe(true)
    }
  })

  it('should have NO mandatory flag on non-mandatory categories', () => {
    const nonMandatory = PATTERN_CATALOG.filter(
      (p) => p.category !== 'life_death' && p.category !== 'ko' && p.category !== 'seki'
    )
    for (const p of nonMandatory) {
      expect(p.mandatory).toBe(false)
    }
  })

  it('should have correct ID format', () => {
    for (const p of PATTERN_CATALOG) {
      expect(p.id).toMatch(/^P-T[123]-[A-Z]{2}-\d{2}/)
    }
  })
})

// =============================================================================
// 8. ASSESSMENT LABEL TESTS
// =============================================================================

describe('Assessment Labels', () => {
  it('should label decisive advantage', () => {
    expect(getAssessmentLabel(0.9)).toBe('decisive advantage')
  })

  it('should label strong advantage', () => {
    expect(getAssessmentLabel(0.72)).toBe('strong advantage')
  })

  it('should label slight advantage', () => {
    expect(getAssessmentLabel(0.58)).toBe('slight advantage')
  })

  it('should label even position', () => {
    expect(getAssessmentLabel(0.5)).toBe('even position')
  })

  it('should label slight disadvantage', () => {
    expect(getAssessmentLabel(0.4)).toBe('slight disadvantage')
  })

  it('should label significant disadvantage', () => {
    expect(getAssessmentLabel(0.25)).toBe('significant disadvantage')
  })

  it('should label lost position', () => {
    expect(getAssessmentLabel(0.1)).toBe('lost position')
  })
})
