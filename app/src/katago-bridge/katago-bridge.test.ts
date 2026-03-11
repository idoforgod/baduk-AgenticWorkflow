// =============================================================================
// katago-bridge/katago-bridge.test.ts — Comprehensive test suite
// =============================================================================
// Tests: query builder, response parser, difficulty system, visits management,
//        GPU detection, and the main KataGoService.
//
// All Tauri invoke calls are mocked — these are unit tests that run without
// a real KataGo binary.
// =============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalysisQuery, AnalysisResponse, MoveInfo, RootInfo } from '../core/interfaces'

// --- Test Fixtures ---

function createMockMoveInfo(overrides: Partial<MoveInfo> = {}): MoveInfo {
  return {
    move: 'D4',
    visits: 100,
    edgeVisits: 101,
    winrate: 0.55,
    scoreMean: 1.2,
    scoreLead: 1.2,
    scoreStdev: 12.5,
    scoreSelfplay: 1.1,
    prior: 0.08,
    utility: 0.04,
    utilityLcb: 0.02,
    lcb: 0.49,
    weight: 99.5,
    edgeWeight: 100.5,
    order: 0,
    playSelectionValue: 100.0,
    pv: ['D4', 'Q16', 'D16'],
    ...overrides,
  }
}

function createMockRootInfo(overrides: Partial<RootInfo> = {}): RootInfo {
  return {
    winrate: 0.55,
    scoreLead: 1.2,
    scoreSelfplay: 1.1,
    scoreStdev: 12.5,
    utility: 0.04,
    visits: 500,
    currentPlayer: 'B',
    thisHash: 'abc123',
    symHash: 'xyz789',
    lcb: 0.49,
    utilityLcb: 0.02,
    rawWinrate: 0.54,
    rawLead: 1.1,
    rawScoreSelfplay: 1.0,
    rawScoreSelfplayStdev: 13.0,
    rawNoResultProb: 0.0001,
    rawStWrError: 0.04,
    rawStScoreError: 2.0,
    rawVarTimeLeft: 85.0,
    ...overrides,
  }
}

function createMockAnalysisResponse(): Record<string, unknown> {
  return {
    id: 'test-1',
    isDuringSearch: false,
    turnNumber: 2,
    moveInfos: [
      {
        move: 'R16',
        visits: 248,
        edgeVisits: 249,
        winrate: 0.5124,
        scoreMean: 0.35,
        scoreLead: 0.35,
        scoreStdev: 12.5,
        scoreSelfplay: 0.42,
        prior: 0.0823,
        utility: 0.042,
        utilityLcb: 0.028,
        lcb: 0.498,
        weight: 246.3,
        edgeWeight: 247.5,
        order: 0,
        playSelectionValue: 248.5,
        pv: ['R16', 'C16', 'Q3'],
      },
      {
        move: 'C16',
        visits: 145,
        edgeVisits: 146,
        winrate: 0.5098,
        scoreMean: 0.29,
        scoreLead: 0.29,
        scoreStdev: 12.8,
        scoreSelfplay: 0.35,
        prior: 0.0671,
        utility: 0.038,
        utilityLcb: 0.021,
        lcb: 0.491,
        weight: 143.8,
        edgeWeight: 145.1,
        order: 1,
        playSelectionValue: 145.2,
        pv: ['C16', 'R16', 'D3'],
      },
    ],
    rootInfo: {
      winrate: 0.5124,
      scoreLead: 0.35,
      scoreSelfplay: 0.42,
      scoreStdev: 12.5,
      utility: 0.042,
      visits: 500,
      currentPlayer: 'W',
      thisHash: 'A1B2C3',
      symHash: 'X9Y8Z7',
      lcb: 0.498,
      utilityLcb: 0.028,
      rawWinrate: 0.5089,
      rawLead: 0.32,
      rawScoreSelfplay: 0.38,
      rawScoreSelfplayStdev: 13.1,
      rawNoResultProb: 0.0001,
      rawStWrError: 0.045,
      rawStScoreError: 2.1,
      rawVarTimeLeft: 85.3,
    },
  }
}

function createMockQuery(overrides: Partial<AnalysisQuery> = {}): AnalysisQuery {
  return {
    id: 'test-query-1',
    moves: [
      ['B', 'Q4'],
      ['W', 'D4'],
    ],
    rules: 'chinese',
    boardXSize: 19,
    boardYSize: 19,
    komi: 7.5,
    maxVisits: 50,
    ...overrides,
  }
}

// =============================================================================
// QUERY BUILDER TESTS
// =============================================================================

describe('query-builder', () => {
  // Import dynamically to avoid module-level side effects
  let queryBuilder: typeof import('./query-builder')

  beforeEach(async () => {
    queryBuilder = await import('./query-builder')
    queryBuilder.resetQueryCounter()
  })

  describe('generateQueryId', () => {
    it('generates unique IDs with default prefix', () => {
      const id1 = queryBuilder.generateQueryId()
      const id2 = queryBuilder.generateQueryId()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^q-\d+-\d+$/)
    })

    it('generates IDs with custom prefix', () => {
      const id = queryBuilder.generateQueryId('analysis')
      expect(id).toMatch(/^analysis-\d+-\d+$/)
    })

    it('increments counter across calls', () => {
      const id1 = queryBuilder.generateQueryId()
      const id2 = queryBuilder.generateQueryId()
      // Extract counter from id format "prefix-counter-timestamp"
      const counter1 = Number.parseInt(id1.split('-')[1]!, 10)
      const counter2 = Number.parseInt(id2.split('-')[1]!, 10)
      expect(counter2).toBe(counter1 + 1)
    })
  })

  describe('buildTauriAnalysisQuery', () => {
    it('converts AnalysisQuery to Tauri payload with required fields', () => {
      const query = createMockQuery()
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      expect(result.id).toBe('test-query-1')
      expect(result.moves).toEqual([
        ['B', 'Q4'],
        ['W', 'D4'],
      ])
      expect(result.rules).toBe('chinese')
      expect(result.boardXSize).toBe(19)
      expect(result.boardYSize).toBe(19)
    })

    it('includes optional fields when present', () => {
      const query = createMockQuery({
        komi: 6.5,
        maxVisits: 100,
        includeOwnership: true,
        priority: 10,
      })
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      expect(result.komi).toBe(6.5)
      expect(result.maxVisits).toBe(100)
      expect(result.includeOwnership).toBe(true)
      expect(result.priority).toBe(10)
    })

    it('omits undefined optional fields', () => {
      const query = createMockQuery()
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      // komi is set to 7.5 in mock, so it should be present
      expect(result.komi).toBe(7.5)
      // includeOwnership is not set, so should be absent
      expect(result.includeOwnership).toBeUndefined()
    })

    it('applies difficulty config when provided', () => {
      const query = createMockQuery({ maxVisits: undefined, rootPolicyTemperature: undefined })
      const diffConfig = {
        level: 5,
        maxVisits: 3,
        playoutDoublingAdvantage: -2.0,
        rootPolicyTemperature: 2.0,
        humanSLProfile: null,
        overrideSettings: { wideRootNoise: 0.06 },
      }
      const result = queryBuilder.buildTauriAnalysisQuery(query, diffConfig)

      expect(result.maxVisits).toBe(3)
      expect(result.rootPolicyTemperature).toBe(2.0)
    })

    it('query-level values override difficulty config', () => {
      const query = createMockQuery({ maxVisits: 200 })
      const diffConfig = {
        level: 5,
        maxVisits: 3,
        playoutDoublingAdvantage: -2.0,
        rootPolicyTemperature: 2.0,
        humanSLProfile: null,
        overrideSettings: {},
      }
      const result = queryBuilder.buildTauriAnalysisQuery(query, diffConfig)

      // Query-level maxVisits takes precedence
      expect(result.maxVisits).toBe(200)
    })

    it('serializes rules object to string', () => {
      const query = createMockQuery({
        rules: {
          ko: 'SIMPLE',
          scoring: 'AREA',
          suicide: false,
          tax: 'NONE',
          whiteHandicapBonus: 'N',
        },
      })
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      // Rules object should be serialized as JSON string
      expect(typeof result.rules).toBe('string')
      const parsed = JSON.parse(result.rules)
      expect(parsed.ko).toBe('SIMPLE')
    })

    it('handles initialStones', () => {
      const query = createMockQuery({
        initialStones: [
          ['B', 'D4'],
          ['B', 'Q16'],
        ],
      })
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      expect(result.initialStones).toEqual([
        ['B', 'D4'],
        ['B', 'Q16'],
      ])
    })

    it('handles analyzeTurns', () => {
      const query = createMockQuery({
        analyzeTurns: [0, 1, 2],
      })
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      expect(result.analyzeTurns).toEqual([0, 1, 2])
    })

    it('handles empty moves array', () => {
      const query = createMockQuery({ moves: [] })
      const result = queryBuilder.buildTauriAnalysisQuery(query)

      expect(result.moves).toEqual([])
    })
  })

  describe('serializeAnalysisQuery', () => {
    it('produces valid single-line JSON', () => {
      const query = createMockQuery()
      const json = queryBuilder.serializeAnalysisQuery(query)

      expect(json).not.toContain('\n')
      const parsed = JSON.parse(json)
      expect(parsed.id).toBe('test-query-1')
      expect(parsed.boardXSize).toBe(19)
    })

    it('includes all required fields', () => {
      const query = createMockQuery()
      const parsed = JSON.parse(queryBuilder.serializeAnalysisQuery(query))

      expect(parsed.id).toBeDefined()
      expect(parsed.moves).toBeDefined()
      expect(parsed.rules).toBeDefined()
      expect(parsed.boardXSize).toBeDefined()
      expect(parsed.boardYSize).toBeDefined()
    })
  })

  describe('validateAnalysisQuery', () => {
    it('returns null for a valid query', () => {
      const query = createMockQuery()
      expect(queryBuilder.validateAnalysisQuery(query)).toBeNull()
    })

    it('rejects empty id', () => {
      const query = createMockQuery({ id: '' })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('id')
    })

    it('rejects boardXSize out of range', () => {
      const query = createMockQuery({ boardXSize: 0 })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('boardXSize')
    })

    it('rejects boardXSize > 19', () => {
      const query = createMockQuery({ boardXSize: 25 })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('boardXSize')
    })

    it('rejects invalid komi', () => {
      const query = createMockQuery({ komi: 200 })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('komi')
    })

    it('rejects maxVisits < 1', () => {
      const query = createMockQuery({ maxVisits: 0 })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('maxVisits')
    })

    it('rejects invalid player in moves', () => {
      const query = createMockQuery({ moves: [['X' as 'B', 'D4']] })
      expect(queryBuilder.validateAnalysisQuery(query)).toContain('player')
    })
  })

  describe('action query builders', () => {
    it('buildQueryVersion produces correct format', () => {
      const query = queryBuilder.buildQueryVersion('test-ver')
      expect(query.id).toBe('test-ver')
      expect(query.action).toBe('query_version')
    })

    it('buildQueryModels produces correct format', () => {
      const query = queryBuilder.buildQueryModels('test-mod')
      expect(query.id).toBe('test-mod')
      expect(query.action).toBe('query_models')
    })

    it('buildClearCache produces correct format', () => {
      const query = queryBuilder.buildClearCache('test-clr')
      expect(query.id).toBe('test-clr')
      expect(query.action).toBe('clear_cache')
    })

    it('buildTerminate produces correct format', () => {
      const query = queryBuilder.buildTerminate('target-id', 'test-term')
      expect(query.id).toBe('test-term')
      expect(query.action).toBe('terminate')
      expect(query.terminateId).toBe('target-id')
    })

    it('buildTerminateAll produces correct format', () => {
      const query = queryBuilder.buildTerminateAll('test-term-all')
      expect(query.id).toBe('test-term-all')
      expect(query.action).toBe('terminate_all')
    })
  })
})

// =============================================================================
// RESPONSE PARSER TESTS
// =============================================================================

describe('response-parser', () => {
  let parser: typeof import('./response-parser')

  beforeEach(async () => {
    parser = await import('./response-parser')
  })

  describe('detectResponseType', () => {
    it('detects error response', () => {
      expect(parser.detectResponseType({ error: 'something failed' })).toBe('error')
    })

    it('detects warning response', () => {
      expect(parser.detectResponseType({ warning: 'unknown field', id: 'q1', field: 'foo' })).toBe(
        'warning'
      )
    })

    it('detects version response', () => {
      expect(
        parser.detectResponseType({ action: 'query_version', id: 'v1', version: '1.16.4' })
      ).toBe('version')
    })

    it('detects models response', () => {
      expect(parser.detectResponseType({ action: 'query_models', id: 'm1', models: [] })).toBe(
        'models'
      )
    })

    it('detects no-result response', () => {
      expect(
        parser.detectResponseType({
          noResults: true,
          id: 'q1',
          turnNumber: 0,
          isDuringSearch: false,
        })
      ).toBe('no-result')
    })

    it('detects analysis response', () => {
      expect(parser.detectResponseType(createMockAnalysisResponse())).toBe('analysis')
    })

    it('returns unknown for unrecognized response', () => {
      expect(parser.detectResponseType({ foo: 'bar' })).toBe('unknown')
    })

    it('detects clear-cache response', () => {
      expect(parser.detectResponseType({ action: 'clear_cache', id: 'c1' })).toBe('clear-cache')
    })

    it('detects terminate response', () => {
      expect(parser.detectResponseType({ action: 'terminate', id: 't1', terminateId: 'q1' })).toBe(
        'terminate'
      )
    })
  })

  describe('parseResponseLine', () => {
    it('parses valid analysis response JSON', () => {
      const json = JSON.stringify(createMockAnalysisResponse())
      const result = parser.parseResponseLine(json)

      expect(result.ok).toBe(true)
      if (result.ok && 'moveInfos' in result.value) {
        expect(result.value.moveInfos).toHaveLength(2)
        expect(result.value.moveInfos[0]!.move).toBe('R16')
      }
    })

    it('returns error for empty line', () => {
      const result = parser.parseResponseLine('')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RESPONSE')
      }
    })

    it('returns error for invalid JSON', () => {
      const result = parser.parseResponseLine('not json {{{')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_RESPONSE')
      }
    })

    it('handles whitespace-only line', () => {
      const result = parser.parseResponseLine('   \n  ')
      expect(result.ok).toBe(false)
    })

    it('parses error response', () => {
      const json = JSON.stringify({ error: 'Failed to parse', id: 'q1', field: 'moves' })
      const result = parser.parseResponseLine(json)

      expect(result.ok).toBe(true)
      if (result.ok && 'error' in result.value) {
        expect(result.value.error).toBe('Failed to parse')
      }
    })

    it('parses version response', () => {
      const json = JSON.stringify({
        id: 'v1',
        action: 'query_version',
        version: '1.16.4',
        git_hash: 'abc123',
      })
      const result = parser.parseResponseLine(json)

      expect(result.ok).toBe(true)
      if (result.ok && 'version' in result.value) {
        expect(result.value.version).toBe('1.16.4')
      }
    })

    it('parses no-result response', () => {
      const json = JSON.stringify({
        id: 'q1',
        isDuringSearch: false,
        turnNumber: 3,
        noResults: true,
      })
      const result = parser.parseResponseLine(json)

      expect(result.ok).toBe(true)
      if (result.ok && 'noResults' in result.value) {
        expect(result.value.noResults).toBe(true)
      }
    })

    it('parses warning response', () => {
      const json = JSON.stringify({ id: 'q1', warning: 'Unknown field', field: 'unknownField' })
      const result = parser.parseResponseLine(json)

      expect(result.ok).toBe(true)
      if (result.ok && 'warning' in result.value) {
        expect(result.value.warning).toBe('Unknown field')
      }
    })

    it('tolerates trailing newline', () => {
      const json = JSON.stringify(createMockAnalysisResponse()) + '\n'
      const result = parser.parseResponseLine(json)
      expect(result.ok).toBe(true)
    })
  })

  describe('parseAnalysisResponse', () => {
    it('extracts all required fields', () => {
      const raw = createMockAnalysisResponse()
      const result = parser.parseAnalysisResponse(raw)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe('test-1')
        expect(result.value.isDuringSearch).toBe(false)
        expect(result.value.turnNumber).toBe(2)
        expect(result.value.moveInfos).toHaveLength(2)
        expect(result.value.rootInfo.currentPlayer).toBe('W')
      }
    })

    it('extracts MoveInfo fields correctly', () => {
      const raw = createMockAnalysisResponse()
      const result = parser.parseAnalysisResponse(raw)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const bestMove = result.value.moveInfos[0]!
        expect(bestMove.move).toBe('R16')
        expect(bestMove.visits).toBe(248)
        expect(bestMove.winrate).toBe(0.5124)
        expect(bestMove.scoreLead).toBe(0.35)
        expect(bestMove.prior).toBe(0.0823)
        expect(bestMove.order).toBe(0)
        expect(bestMove.pv).toEqual(['R16', 'C16', 'Q3'])
      }
    })

    it('extracts RootInfo fields correctly', () => {
      const raw = createMockAnalysisResponse()
      const result = parser.parseAnalysisResponse(raw)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rootInfo.winrate).toBe(0.5124)
        expect(result.value.rootInfo.visits).toBe(500)
        expect(result.value.rootInfo.currentPlayer).toBe('W')
        expect(result.value.rootInfo.rawWinrate).toBe(0.5089)
      }
    })

    it('handles optional ownership field', () => {
      const raw = {
        ...createMockAnalysisResponse(),
        ownership: Array(361).fill(0.5),
      }
      const result = parser.parseAnalysisResponse(raw)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.ownership).toHaveLength(361)
      }
    })

    it('returns error for missing moveInfos', () => {
      const raw = { id: 'test', rootInfo: {}, isDuringSearch: false, turnNumber: 0 }
      const result = parser.parseAnalysisResponse(raw)
      expect(result.ok).toBe(false)
    })

    it('returns error for missing rootInfo', () => {
      const raw = { id: 'test', moveInfos: [], isDuringSearch: false, turnNumber: 0 }
      const result = parser.parseAnalysisResponse(raw)
      expect(result.ok).toBe(false)
    })

    it('handles human model conditional fields', () => {
      const raw = createMockAnalysisResponse()
      ;(raw.rootInfo as Record<string, unknown>).humanWinrate = 0.48
      ;(raw.rootInfo as Record<string, unknown>).humanScoreMean = -0.5

      const result = parser.parseAnalysisResponse(raw)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.rootInfo.humanWinrate).toBe(0.48)
        expect(result.value.rootInfo.humanScoreMean).toBe(-0.5)
      }
    })

    it('tolerates unknown extra fields (Step 2 guarantee 4)', () => {
      const raw = {
        ...createMockAnalysisResponse(),
        unknownFutureField: 'hello',
        anotherField: 42,
      }
      const result = parser.parseAnalysisResponse(raw)
      expect(result.ok).toBe(true)
    })
  })

  describe('extractBestMove', () => {
    it('returns the move with order 0', () => {
      const response: AnalysisResponse = {
        id: 'test',
        isDuringSearch: false,
        turnNumber: 0,
        moveInfos: [
          createMockMoveInfo({ move: 'C16', order: 1 }),
          createMockMoveInfo({ move: 'R16', order: 0 }),
        ],
        rootInfo: createMockRootInfo(),
      }
      const best = parser.extractBestMove(response)
      expect(best).not.toBeNull()
      expect(best!.move).toBe('R16')
    })

    it('returns null for empty moveInfos', () => {
      const response: AnalysisResponse = {
        id: 'test',
        isDuringSearch: false,
        turnNumber: 0,
        moveInfos: [],
        rootInfo: createMockRootInfo(),
      }
      expect(parser.extractBestMove(response)).toBeNull()
    })

    it('falls back to first move if none has order 0', () => {
      const response: AnalysisResponse = {
        id: 'test',
        isDuringSearch: false,
        turnNumber: 0,
        moveInfos: [
          createMockMoveInfo({ move: 'D4', order: 2 }),
          createMockMoveInfo({ move: 'Q4', order: 1 }),
        ],
        rootInfo: createMockRootInfo(),
      }
      const best = parser.extractBestMove(response)
      expect(best).not.toBeNull()
      expect(best!.move).toBe('D4')
    })
  })

  describe('extractTopMoves', () => {
    it('returns top N moves sorted by order', () => {
      const response: AnalysisResponse = {
        id: 'test',
        isDuringSearch: false,
        turnNumber: 0,
        moveInfos: [
          createMockMoveInfo({ move: 'C16', order: 1 }),
          createMockMoveInfo({ move: 'R16', order: 0 }),
          createMockMoveInfo({ move: 'D3', order: 2 }),
        ],
        rootInfo: createMockRootInfo(),
      }
      const top2 = parser.extractTopMoves(response, 2)
      expect(top2).toHaveLength(2)
      expect(top2[0]!.move).toBe('R16')
      expect(top2[1]!.move).toBe('C16')
    })
  })

  describe('type guards', () => {
    it('isAnalysisResponse identifies analysis responses', () => {
      const response: AnalysisResponse = {
        id: 'test',
        isDuringSearch: false,
        turnNumber: 0,
        moveInfos: [],
        rootInfo: createMockRootInfo(),
      }
      expect(parser.isAnalysisResponse(response)).toBe(true)
    })

    it('isErrorResponse identifies error responses', () => {
      const response = { error: 'failed' }
      expect(parser.isErrorResponse(response)).toBe(true)
    })

    it('isNoResultResponse identifies no-result responses', () => {
      const response = {
        id: 'q1',
        isDuringSearch: false as const,
        turnNumber: 0,
        noResults: true as const,
      }
      expect(parser.isNoResultResponse(response)).toBe(true)
    })
  })

  describe('makeKataGoError', () => {
    it('creates error with all fields', () => {
      const err = parser.makeKataGoError('ANALYSIS_TIMEOUT', 'timed out', { queryId: 'q1' })
      expect(err.module).toBe('katago')
      expect(err.code).toBe('ANALYSIS_TIMEOUT')
      expect(err.message).toBe('timed out')
      expect(err.details).toEqual({ queryId: 'q1' })
    })

    it('creates error without details', () => {
      const err = parser.makeKataGoError('PROCESS_CRASHED', 'crash')
      expect(err.details).toBeUndefined()
    })
  })
})

// =============================================================================
// DIFFICULTY SYSTEM TESTS
// =============================================================================

describe('difficulty', () => {
  let difficulty: typeof import('./difficulty')

  beforeEach(async () => {
    difficulty = await import('./difficulty')
  })

  describe('getDifficultyConfig', () => {
    it('returns config for every level 1-30', () => {
      for (let level = 1; level <= 30; level++) {
        const config = difficulty.getDifficultyConfig(level)
        expect(config.level).toBe(level)
        expect(config.maxVisits).toBeGreaterThan(0)
        expect(config.rootPolicyTemperature).toBeGreaterThan(0)
      }
    })

    it('level 1 has minimum visits and maximum randomness', () => {
      const config = difficulty.getDifficultyConfig(1)
      expect(config.maxVisits).toBe(1)
      expect(config.rootPolicyTemperature).toBe(3.0)
      expect(config.playoutDoublingAdvantage).toBe(-3.0)
    })

    it('level 30 has maximum visits and no randomness', () => {
      const config = difficulty.getDifficultyConfig(30)
      expect(config.maxVisits).toBe(1000)
      expect(config.rootPolicyTemperature).toBe(1.0)
      expect(config.playoutDoublingAdvantage).toBe(0)
    })

    it('maxVisits is monotonically non-decreasing', () => {
      for (let level = 1; level < 30; level++) {
        const curr = difficulty.getDifficultyConfig(level)
        const next = difficulty.getDifficultyConfig(level + 1)
        expect(next.maxVisits).toBeGreaterThanOrEqual(curr.maxVisits)
      }
    })

    it('playoutDoublingAdvantage is monotonically non-decreasing', () => {
      for (let level = 1; level < 30; level++) {
        const curr = difficulty.getDifficultyConfig(level)
        const next = difficulty.getDifficultyConfig(level + 1)
        expect(next.playoutDoublingAdvantage).toBeGreaterThanOrEqual(curr.playoutDoublingAdvantage)
      }
    })

    it('rootPolicyTemperature is monotonically non-increasing', () => {
      for (let level = 1; level < 30; level++) {
        const curr = difficulty.getDifficultyConfig(level)
        const next = difficulty.getDifficultyConfig(level + 1)
        expect(next.rootPolicyTemperature).toBeLessThanOrEqual(curr.rootPolicyTemperature)
      }
    })

    it('clamps out-of-range levels', () => {
      const low = difficulty.getDifficultyConfig(0)
      expect(low.level).toBe(1)

      const high = difficulty.getDifficultyConfig(50)
      expect(high.level).toBe(30)
    })

    it('rounds fractional levels', () => {
      const config = difficulty.getDifficultyConfig(5.7)
      expect(config.level).toBe(6)
    })
  })

  describe('getAllDifficultyConfigs', () => {
    it('returns exactly 30 configs', () => {
      const all = difficulty.getAllDifficultyConfigs()
      expect(all).toHaveLength(30)
    })

    it('configs are in order by level', () => {
      const all = difficulty.getAllDifficultyConfigs()
      for (let i = 0; i < 30; i++) {
        expect(all[i]!.level).toBe(i + 1)
      }
    })
  })

  describe('getDifficultyDescription', () => {
    it('returns beginner for levels 1-5', () => {
      expect(difficulty.getDifficultyDescription(1)).toContain('Beginner')
    })

    it('returns professional for levels 26-30', () => {
      expect(difficulty.getDifficultyDescription(30)).toContain('Professional')
    })

    it('includes the rank', () => {
      expect(difficulty.getDifficultyDescription(1)).toContain('20k')
      expect(difficulty.getDifficultyDescription(30)).toContain('Top Pro')
    })
  })

  describe('isValidDifficultyLevel', () => {
    it('accepts integers 1-30', () => {
      expect(difficulty.isValidDifficultyLevel(1)).toBe(true)
      expect(difficulty.isValidDifficultyLevel(15)).toBe(true)
      expect(difficulty.isValidDifficultyLevel(30)).toBe(true)
    })

    it('rejects 0 and negative numbers', () => {
      expect(difficulty.isValidDifficultyLevel(0)).toBe(false)
      expect(difficulty.isValidDifficultyLevel(-1)).toBe(false)
    })

    it('rejects numbers > 30', () => {
      expect(difficulty.isValidDifficultyLevel(31)).toBe(false)
    })

    it('rejects non-integers', () => {
      expect(difficulty.isValidDifficultyLevel(5.5)).toBe(false)
    })
  })
})

// =============================================================================
// VISITS MANAGEMENT TESTS
// =============================================================================

describe('visits', () => {
  let visits: typeof import('./visits')

  beforeEach(async () => {
    visits = await import('./visits')
    visits.resetVisitsTiers()
  })

  describe('getVisitsTiers / setVisitsTiers', () => {
    it('returns default tiers initially', () => {
      const tiers = visits.getVisitsTiers()
      expect(tiers.fast).toBe(5)
      expect(tiers.standard).toBe(50)
      expect(tiers.deep).toBe(500)
    })

    it('allows manual tier setting', () => {
      visits.setVisitsTiers({ fast: 3, standard: 30, deep: 150 })
      const tiers = visits.getVisitsTiers()
      expect(tiers.fast).toBe(3)
      expect(tiers.standard).toBe(30)
      expect(tiers.deep).toBe(150)
    })

    it('resetVisitsTiers restores defaults', () => {
      visits.setVisitsTiers({ fast: 1, standard: 5, deep: 25 })
      visits.resetVisitsTiers()
      const tiers = visits.getVisitsTiers()
      expect(tiers.fast).toBe(5)
    })
  })

  describe('calibrateTiersFromVPS', () => {
    it('returns default tiers for high-perf hardware (>=500 v/s)', () => {
      const tiers = visits.calibrateTiersFromVPS(600)
      expect(tiers).toEqual({ fast: 5, standard: 50, deep: 500 })
    })

    it('reduces deep for medium hardware (100-499 v/s)', () => {
      const tiers = visits.calibrateTiersFromVPS(200)
      expect(tiers).toEqual({ fast: 5, standard: 50, deep: 300 })
    })

    it('reduces all tiers for low hardware (30-99 v/s)', () => {
      const tiers = visits.calibrateTiersFromVPS(50)
      expect(tiers).toEqual({ fast: 3, standard: 30, deep: 150 })
    })

    it('minimal tiers for CPU-only (10-29 v/s)', () => {
      const tiers = visits.calibrateTiersFromVPS(15)
      expect(tiers).toEqual({ fast: 1, standard: 10, deep: 50 })
    })

    it('ultra-low tiers for very slow hardware (<10 v/s)', () => {
      const tiers = visits.calibrateTiersFromVPS(5)
      expect(tiers).toEqual({ fast: 1, standard: 5, deep: 25 })
    })

    it('caches visits-per-second', () => {
      visits.calibrateTiersFromVPS(200)
      expect(visits.getCachedVisitsPerSecond()).toBe(200)
    })
  })

  describe('getHardwareClass', () => {
    it('classifies hardware correctly', () => {
      expect(visits.getHardwareClass(600)).toBe('high')
      expect(visits.getHardwareClass(200)).toBe('medium')
      expect(visits.getHardwareClass(50)).toBe('low')
      expect(visits.getHardwareClass(15)).toBe('minimal')
      expect(visits.getHardwareClass(5)).toBe('ultra-low')
    })
  })

  describe('estimateResponseTime', () => {
    it('estimates correctly with given VPS', () => {
      const time = visits.estimateResponseTime(100, 500)
      expect(time).toBe(200) // 100/500 * 1000 = 200ms
    })

    it('returns null when no benchmark data', () => {
      visits.resetVisitsTiers()
      expect(visits.estimateResponseTime(100)).toBeNull()
    })

    it('uses cached VPS when not provided', () => {
      visits.calibrateTiersFromVPS(200)
      const time = visits.estimateResponseTime(100)
      expect(time).toBe(500) // 100/200 * 1000 = 500ms
    })
  })

  describe('getHangTimeout', () => {
    it('returns minimum 5000ms', () => {
      const timeout = visits.getHangTimeout(5, 1000)
      expect(timeout).toBe(5000) // 3x estimated = 15ms, but min is 5000
    })

    it('returns default timeouts without benchmark data', () => {
      visits.resetVisitsTiers()
      expect(visits.getHangTimeout(5)).toBe(5000)
      expect(visits.getHangTimeout(50)).toBe(15000)
      expect(visits.getHangTimeout(500)).toBe(90000)
      expect(visits.getHangTimeout(1000)).toBe(180000)
    })
  })
})

// =============================================================================
// GPU DETECTION TESTS
// =============================================================================

describe('gpu-detection', () => {
  let gpu: typeof import('./gpu-detection')

  beforeEach(async () => {
    gpu = await import('./gpu-detection')
    gpu.clearBackendCache()
  })

  describe('mapTauriBackendInfo', () => {
    it('maps Metal backend correctly', () => {
      const info = gpu.mapTauriBackendInfo({
        backendType: 'metal',
        deviceName: 'Apple M1',
        binaryName: 'katago-metal',
      })
      expect(info.backend).toBe('metal')
      expect(info.gpuName).toBe('Apple M1')
      expect(info.binaryPath).toBe('katago-metal')
      expect(info.needsTuning).toBe(false)
    })

    it('maps OpenCL backend with needsTuning=true', () => {
      const info = gpu.mapTauriBackendInfo({
        backendType: 'opencl',
        deviceName: 'NVIDIA RTX 3060',
        binaryName: 'katago-opencl',
      })
      expect(info.backend).toBe('opencl')
      expect(info.needsTuning).toBe(true)
    })

    it('maps CUDA backend correctly', () => {
      const info = gpu.mapTauriBackendInfo({
        backendType: 'cuda',
        deviceName: 'NVIDIA RTX 4070',
        binaryName: 'katago-cuda',
      })
      expect(info.backend).toBe('cuda')
      expect(info.needsTuning).toBe(false)
    })

    it('normalizes unknown backend to eigen', () => {
      const info = gpu.mapTauriBackendInfo({
        backendType: 'unknown',
        deviceName: 'CPU',
        binaryName: 'katago',
      })
      expect(info.backend).toBe('eigen')
    })
  })

  describe('detectBackend', () => {
    it('calls invoker and returns result', async () => {
      const mockInvoker = vi.fn().mockResolvedValue({
        backendType: 'metal',
        deviceName: 'Apple M2',
        binaryName: 'katago-metal',
      })

      const result = await gpu.detectBackend(mockInvoker)
      expect(result.backend).toBe('metal')
      expect(mockInvoker).toHaveBeenCalledWith('katago_detect_backend')
    })

    it('caches result on second call', async () => {
      const mockInvoker = vi.fn().mockResolvedValue({
        backendType: 'cuda',
        deviceName: 'RTX 3060',
        binaryName: 'katago-cuda',
      })

      await gpu.detectBackend(mockInvoker)
      await gpu.detectBackend(mockInvoker)

      expect(mockInvoker).toHaveBeenCalledTimes(1)
    })

    it('re-detects after cache clear', async () => {
      const mockInvoker = vi.fn().mockResolvedValue({
        backendType: 'eigen',
        deviceName: 'CPU',
        binaryName: 'katago',
      })

      await gpu.detectBackend(mockInvoker)
      gpu.clearBackendCache()
      await gpu.detectBackend(mockInvoker)

      expect(mockInvoker).toHaveBeenCalledTimes(2)
    })
  })

  describe('isGPUBackend', () => {
    it('returns true for GPU backends', () => {
      expect(gpu.isGPUBackend('metal')).toBe(true)
      expect(gpu.isGPUBackend('cuda')).toBe(true)
      expect(gpu.isGPUBackend('tensorrt')).toBe(true)
      expect(gpu.isGPUBackend('opencl')).toBe(true)
    })

    it('returns false for CPU backends', () => {
      expect(gpu.isGPUBackend('eigen')).toBe(false)
      expect(gpu.isGPUBackend('eigenavx2')).toBe(false)
    })
  })

  describe('getBackendSpeedMultiplier', () => {
    it('TensorRT is fastest', () => {
      expect(gpu.getBackendSpeedMultiplier('tensorrt')).toBeGreaterThan(
        gpu.getBackendSpeedMultiplier('cuda')
      )
    })

    it('Eigen is baseline (1.0)', () => {
      expect(gpu.getBackendSpeedMultiplier('eigen')).toBe(1.0)
    })

    it('EigenAVX2 is faster than Eigen', () => {
      expect(gpu.getBackendSpeedMultiplier('eigenavx2')).toBeGreaterThan(
        gpu.getBackendSpeedMultiplier('eigen')
      )
    })
  })
})

// =============================================================================
// KATAGO SERVICE TESTS
// =============================================================================

describe('KataGoService', () => {
  let createKatagoBridge: typeof import('./katago-service').createKatagoBridge
  let mockInvoke: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const mod = await import('./katago-service')
    createKatagoBridge = mod.createKatagoBridge

    mockInvoke = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('creates service in idle state', () => {
      const service = createKatagoBridge(mockInvoke)
      const status = service.getStatus()
      expect(status.state).toBe('idle')
      expect(status.pendingQueries).toBe(0)
    })

    it('initializes successfully with valid config', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4', gitHash: 'abc123' })

      const service = createKatagoBridge(mockInvoke)
      const result = await service.initialize({
        binaryPath: '/path/to/katago',
        modelPath: '/path/to/model.bin.gz',
        configPath: '/path/to/config.cfg',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.version).toBe('1.16.4')
      }
      expect(service.getStatus().state).toBe('ready')
    })

    it('returns error on startup failure', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('sidecar not found'))

      const service = createKatagoBridge(mockInvoke)
      const result = await service.initialize({
        binaryPath: '/bad/path',
        modelPath: '/path/to/model',
        configPath: '/path/to/config',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('BINARY_NOT_FOUND')
      }
      expect(service.getStatus().state).toBe('failed')
    })

    it('rejects double initialization', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' })

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path/to/katago',
        modelPath: '/path/to/model',
        configPath: '/path/to/config',
      })

      const result = await service.initialize({
        binaryPath: '/path/to/katago',
        modelPath: '/path/to/model',
        configPath: '/path/to/config',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('STARTUP_FAILED')
      }
    })
  })

  describe('shutdown', () => {
    it('shuts down from ready state', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' }) // initialize
      mockInvoke.mockResolvedValueOnce(undefined) // shutdown

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      const result = await service.shutdown()
      expect(result.ok).toBe(true)
      expect(service.getStatus().state).toBe('idle')
    })

    it('shutdown from idle state succeeds', async () => {
      const service = createKatagoBridge(mockInvoke)
      const result = await service.shutdown()
      expect(result.ok).toBe(true)
    })
  })

  describe('analyze', () => {
    it('returns error when not initialized', async () => {
      const service = createKatagoBridge(mockInvoke)
      const result = await service.analyze(createMockQuery())

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('ANALYSIS_ERROR')
      }
    })

    it('validates query before sending', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' })

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      const result = await service.analyze(createMockQuery({ id: '' }))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_QUERY')
      }
    })

    it('sends query via invoke and returns parsed response', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' }) // initialize
      mockInvoke.mockResolvedValueOnce(createMockAnalysisResponse()) // analyze

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      const result = await service.analyze(createMockQuery())
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.id).toBe('test-1')
        expect(result.value.moveInfos).toHaveLength(2)
      }
    })

    it('handles analysis error from invoke', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' }) // initialize
      mockInvoke.mockRejectedValueOnce(new Error('stdin write failed')) // analyze

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      const result = await service.analyze(createMockQuery())
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('ANALYSIS_ERROR')
      }
    })
  })

  describe('isHealthy', () => {
    it('returns false when idle', () => {
      const service = createKatagoBridge(mockInvoke)
      expect(service.isHealthy()).toBe(false)
    })

    it('returns true when ready', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' })
      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })
      expect(service.isHealthy()).toBe(true)
    })
  })

  describe('circuit breaker', () => {
    it('starts in closed state', () => {
      const service = createKatagoBridge(mockInvoke)
      const cb = service.getCircuitBreakerState()
      expect(cb.state).toBe('closed')
      expect(cb.failureCount).toBe(0)
    })

    it('transitions to half-open after failures', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' }) // initialize

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      // Simulate failures
      mockInvoke.mockRejectedValueOnce(new Error('fail 1'))
      await service.analyze(createMockQuery())

      const cb = service.getCircuitBreakerState()
      expect(cb.state).toBe('half-open')
      expect(cb.failureCount).toBe(1)
    })
  })

  describe('difficulty management', () => {
    it('defaults to null difficulty', () => {
      const service = createKatagoBridge(mockInvoke)
      expect(service.getDifficulty()).toBeNull()
    })

    it('setDifficulty stores config', () => {
      const service = createKatagoBridge(mockInvoke)
      service.setDifficulty(5)
      const config = service.getDifficulty()
      expect(config).not.toBeNull()
      expect(config!.level).toBe(5)
      expect(config!.maxVisits).toBe(3)
    })

    it('clearDifficulty resets to null', () => {
      const service = createKatagoBridge(mockInvoke)
      service.setDifficulty(10)
      service.clearDifficulty()
      expect(service.getDifficulty()).toBeNull()
    })
  })

  describe('cancel operations', () => {
    it('cancelAnalysis calls invoke', async () => {
      mockInvoke.mockResolvedValue(undefined)
      const service = createKatagoBridge(mockInvoke)
      const result = await service.cancelAnalysis('q1')
      expect(result.ok).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('katago_cancel', { queryId: 'q1' })
    })

    it('cancelAll calls invoke', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' })
      mockInvoke.mockResolvedValue(undefined)

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })

      const result = await service.cancelAll()
      expect(result.ok).toBe(true)
    })
  })

  describe('reset', () => {
    it('resets all internal state', async () => {
      mockInvoke.mockResolvedValueOnce({ version: '1.16.4' })

      const service = createKatagoBridge(mockInvoke)
      await service.initialize({
        binaryPath: '/path',
        modelPath: '/model',
        configPath: '/config',
      })
      service.setDifficulty(15)

      service.reset()

      expect(service.getStatus().state).toBe('idle')
      expect(service.getDifficulty()).toBeNull()
      expect(service.isHealthy()).toBe(false)
      expect(service.getCircuitBreakerState().state).toBe('closed')
    })
  })

  describe('getBackendInfo', () => {
    it('returns backend info via invoke', async () => {
      mockInvoke.mockResolvedValueOnce({
        backendType: 'metal',
        deviceName: 'Apple M2',
        binaryName: 'katago-metal',
      })

      const service = createKatagoBridge(mockInvoke)
      // Clear cache to force re-detect
      const { clearBackendCache } = await import('./gpu-detection')
      clearBackendCache()

      const result = await service.getBackendInfo()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.backend).toBe('metal')
      }
    })
  })

  describe('visits tiers', () => {
    it('returns default tiers', () => {
      const service = createKatagoBridge(mockInvoke)
      const tiers = service.getVisitsTiers()
      expect(tiers.fast).toBe(5)
      expect(tiers.standard).toBe(50)
      expect(tiers.deep).toBe(500)
    })
  })
})
