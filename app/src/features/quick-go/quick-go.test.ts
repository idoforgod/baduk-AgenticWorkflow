// =============================================================================
// features/quick-go/quick-go.test.ts — Quick Go Game Mode Tests
// =============================================================================
// Comprehensive tests covering:
// 1. Game flow: start -> play moves -> end -> score
// 2. Timer: countdown, byoyomi, time-out
// 3. AI response handling (mock KataGo)
// 4. Difficulty mapping to 30-level system
// 5. Post-game analysis: blunder detection, move ranking
// 6. Integration: rules-engine + game store + explanation engine
// =============================================================================

import type {
  AnalysisQuery,
  AnalysisResponse,
  BackendInfo,
  CircuitBreakerState,
  GTPLocation,
  IExplanationEngine,
  IKatagoBridge,
  IRulesEngine,
  KataGoConfig,
  KataGoError,
  KataGoStatus,
  MoveInfo,
  Player,
  Result,
  RootInfo,
  VersionInfo,
  VisitsTierConfig,
} from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'
import { configureGameStore, useGameStore } from '@game-engine/store'
import { createRulesEngine } from '@rules-engine/rules'
import { beforeEach, describe, expect, it } from 'vitest'
import { analyzeGame, BLUNDER_THRESHOLD, findBlunders, TOP_MOVES_COUNT } from './QuickGoAnalyzer'
import type { QuickGoDependencies } from './QuickGoController'
import { createQuickGoController } from './QuickGoController'
import {
  adjustDifficulty,
  getDefaultLevel,
  getDifficultyForLevel,
  getDifficultyForPreset,
  getDifficultyLabel,
  getPresetForLevel,
  getPresetRange,
} from './QuickGoDifficulty'
import {
  createTimerState,
  formatTime,
  getTimerDisplay,
  getTimerUrgency,
  getTotalRemainingMs,
  pauseTimer,
  startTimer,
  switchTimer,
  tickTimer,
} from './QuickGoTimer'
import type { AnalyzedMove, QuickGoPlayerTimer } from './types'
import { DEFAULT_QUICK_GO_CONFIG } from './types'

// =============================================================================
// Mock Helpers
// =============================================================================

/**
 * Create a mock MoveInfo for KataGo responses.
 */
function createMockMoveInfo(move: GTPLocation, winrate: number, order: number): MoveInfo {
  return {
    move,
    visits: 100,
    edgeVisits: 100,
    winrate,
    scoreMean: (winrate - 0.5) * 20,
    scoreLead: (winrate - 0.5) * 20,
    scoreStdev: 5,
    scoreSelfplay: (winrate - 0.5) * 20,
    prior: 0.3,
    utility: (winrate - 0.5) * 2,
    utilityLcb: (winrate - 0.5) * 1.8,
    lcb: winrate - 0.05,
    weight: 100,
    edgeWeight: 100,
    order,
    playSelectionValue: winrate,
    pv: [move],
  }
}

/**
 * Create a mock RootInfo.
 */
function createMockRootInfo(winrate: number, currentPlayer: Player): RootInfo {
  return {
    winrate,
    scoreLead: (winrate - 0.5) * 20,
    scoreSelfplay: (winrate - 0.5) * 20,
    scoreStdev: 5,
    utility: (winrate - 0.5) * 2,
    visits: 200,
    currentPlayer,
    thisHash: 'abc123',
    symHash: 'abc123',
    lcb: winrate - 0.05,
    utilityLcb: (winrate - 0.5) * 1.8,
    rawWinrate: winrate,
    rawLead: (winrate - 0.5) * 20,
    rawScoreSelfplay: (winrate - 0.5) * 20,
    rawScoreSelfplayStdev: 5,
    rawNoResultProb: 0,
    rawStWrError: 0.02,
    rawStScoreError: 1,
    rawVarTimeLeft: 30,
  }
}

/**
 * Create a mock AnalysisResponse.
 */
function createMockAnalysis(
  bestMove: GTPLocation,
  winrate: number,
  currentPlayer: Player,
  id?: string
): AnalysisResponse {
  return {
    id: id ?? `mock_${String(Date.now())}`,
    isDuringSearch: false,
    turnNumber: 0,
    moveInfos: [
      createMockMoveInfo(bestMove, winrate, 0),
      createMockMoveInfo('D5', winrate - 0.05, 1),
    ],
    rootInfo: createMockRootInfo(winrate, currentPlayer),
  }
}

/**
 * Create a mock IKatagoBridge.
 */
function createMockKatagoBridge(
  aiMove: GTPLocation = 'E5',
  aiWinrate: number = 0.55
): IKatagoBridge & { setDifficulty: (level: number) => void; difficultyLevel: number | null } {
  let _diffLevel: number | null = null
  let _callCount = 0

  return {
    difficultyLevel: null,
    setDifficulty(level: number) {
      _diffLevel = level
      this.difficultyLevel = level
    },
    async initialize(_config: KataGoConfig): Promise<Result<VersionInfo, KataGoError>> {
      return Ok({ version: '1.0.0', gitHash: 'test' })
    },
    async shutdown(): Promise<Result<void, KataGoError>> {
      return Ok(undefined)
    },
    getStatus(): KataGoStatus {
      return { state: 'ready', message: 'Mock ready', pendingQueries: 0, uptimeSeconds: 100 }
    },
    async analyze(query: AnalysisQuery): Promise<Result<AnalysisResponse, KataGoError>> {
      _callCount++
      // Alternate the current player based on the number of moves in the query
      const cp: Player = query.moves.length % 2 === 0 ? 'B' : 'W'
      return Ok(createMockAnalysis(aiMove, aiWinrate, cp, query.id))
    },
    async analyzeMultiple(
      queries: readonly AnalysisQuery[]
    ): Promise<Result<readonly AnalysisResponse[], KataGoError>> {
      const results: AnalysisResponse[] = []
      for (const q of queries) {
        const r = await this.analyze(q)
        if (r.ok) results.push(r.value)
      }
      return Ok(results)
    },
    async cancelAnalysis(_queryId: string): Promise<Result<void, KataGoError>> {
      return Ok(undefined)
    },
    async cancelAll(): Promise<Result<void, KataGoError>> {
      return Ok(undefined)
    },
    getVisitsTiers(): VisitsTierConfig {
      return { fast: 5, standard: 50, deep: 500 }
    },
    async calibrateVisitsTiers(): Promise<Result<VisitsTierConfig, KataGoError>> {
      return Ok({ fast: 5, standard: 50, deep: 500 })
    },
    async getBackendInfo(): Promise<Result<BackendInfo, KataGoError>> {
      return Ok({
        backend: 'metal',
        gpuName: 'Mock GPU',
        binaryPath: '/usr/local/bin/katago',
        needsTuning: false,
      })
    },
    isHealthy(): boolean {
      return true
    },
    getCircuitBreakerState(): CircuitBreakerState {
      return { state: 'closed', failureCount: 0, lastFailure: null, nextRetry: null }
    },
  }
}

/**
 * Create a mock IExplanationEngine.
 */
function createMockExplanationEngine(): IExplanationEngine {
  return {
    explain(_current, _previous, _actualMove, tier, _turnNumber, _boardSize) {
      return Ok({
        text: 'This is a test explanation.',
        matchedPatterns: ['P-T1-MQ-001'],
        category: 'move_quality',
        moveQuality: 'good',
        tier,
        computed: {
          winrateDelta: -3.0,
          scoreLeadDelta: -1.5,
          bestMovePlayed: false,
          moveRank: 2,
          topMoveGap: 5.0,
          movePhase: 'middle_game',
          confidenceLevel: 'high',
        },
        isMandatoryTemplate: false,
        usedLLMFallback: false,
      })
    },
    getPatternCatalog() {
      return {
        patterns: [],
        version: '1.0.0',
        totalCount: 0,
        countByTier: { beginner: 0, intermediate: 0, advanced: 0 },
        countByCategory: {
          life_death: 0,
          ko: 0,
          seki: 0,
          move_quality: 0,
          position: 0,
          opening: 0,
          middle_game: 0,
          endgame: 0,
          alternative: 0,
          generic: 0,
        },
      }
    },
    getCoverageStats() {
      return {
        totalAnalyzed: 0,
        templateHits: 0,
        templatePartials: 0,
        mandatoryHits: 0,
        llmRequired: 0,
        coveragePercent: 0,
        byCategory: {} as ReturnType<IExplanationEngine['getCoverageStats']>['byCategory'],
      }
    },
    setDefaultTier(_tier) {},
    getDefaultTier() {
      return 'beginner'
    },
  }
}

/** Create standard test dependencies */
function createTestDeps(
  aiMove: GTPLocation = 'E5',
  aiWinrate: number = 0.55
): QuickGoDependencies & { bridge: ReturnType<typeof createMockKatagoBridge> } {
  const rulesEngine = createRulesEngine()
  const bridge = createMockKatagoBridge(aiMove, aiWinrate)
  const explanationEngine = createMockExplanationEngine()
  return {
    rulesEngine,
    katagoBridge: bridge,
    explanationEngine,
    bridge,
  }
}

// =============================================================================
// Test Setup
// =============================================================================

let rulesEngine: IRulesEngine

beforeEach(() => {
  rulesEngine = createRulesEngine()
  configureGameStore(rulesEngine)
  useGameStore.getState().reset()
})

// =============================================================================
// 1. TIMER TESTS
// =============================================================================

describe('QuickGoTimer', () => {
  describe('createTimerState', () => {
    it('creates timer with correct initial values', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      const timer = createTimerState(tc)

      expect(timer.black.mainTimeMs).toBe(180_000)
      expect(timer.white.mainTimeMs).toBe(180_000)
      expect(timer.black.byoyomiPeriodsRemaining).toBe(3)
      expect(timer.black.byoyomiTimeMs).toBe(10_000)
      expect(timer.black.inByoyomi).toBe(false)
      expect(timer.black.timedOut).toBe(false)
      expect(timer.activePlayer).toBeNull()
      expect(timer.isPaused).toBe(true)
    })
  })

  describe('startTimer', () => {
    it('starts the timer for a player', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      const timer = createTimerState(tc)
      const started = startTimer(timer, 'B', 1000)

      expect(started.activePlayer).toBe('B')
      expect(started.isPaused).toBe(false)
      expect(started.lastTickTime).toBe(1000)
    })
  })

  describe('pauseTimer', () => {
    it('pauses a running timer', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = startTimer(timer, 'B', 1000)
      timer = pauseTimer(timer)

      expect(timer.isPaused).toBe(true)
      expect(timer.lastTickTime).toBeNull()
    })
  })

  describe('switchTimer', () => {
    it('switches to the other player', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = startTimer(timer, 'B', 1000)
      timer = switchTimer(timer, tc, 2000)

      expect(timer.activePlayer).toBe('W')
      expect(timer.isPaused).toBe(false)
    })

    it('resets byoyomi period on switch when in byoyomi', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = startTimer(timer, 'B', 1000)

      // Force Black into byoyomi with low time
      timer = {
        ...timer,
        black: {
          ...timer.black,
          mainTimeMs: 0,
          inByoyomi: true,
          byoyomiTimeMs: 3000, // 3 seconds left
        },
      }

      timer = switchTimer(timer, tc, 2000)
      // Black's byoyomi time should be reset to the full period
      expect(timer.black.byoyomiTimeMs).toBe(10_000)
    })
  })

  describe('tickTimer', () => {
    it('decrements main time', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = startTimer(timer, 'B', 1000)

      const result = tickTimer(timer, 2000) // 1 second elapsed
      expect(result.state.black.mainTimeMs).toBe(179_000)
      expect(result.timedOut).toBeNull()
    })

    it('transitions to byoyomi when main time expires', () => {
      const tc = { mainTime: 1, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = startTimer(timer, 'B', 1000)

      // Tick 1.5 seconds — main time is 1s, so 0.5s goes into byoyomi
      const result = tickTimer(timer, 2500)
      expect(result.state.black.mainTimeMs).toBe(0)
      expect(result.state.black.inByoyomi).toBe(true)
      expect(result.state.black.byoyomiTimeMs).toBe(9500) // 10000 - 500
      expect(result.timedOut).toBeNull()
    })

    it('triggers timeout when all byoyomi periods consumed', () => {
      const tc = { mainTime: 0, byoyomiPeriods: 1, byoyomiTime: 5 }
      let timer = createTimerState(tc)
      // Start with main time 0, already in byoyomi
      timer = {
        ...timer,
        black: {
          mainTimeMs: 0,
          byoyomiPeriodsRemaining: 1,
          byoyomiTimeMs: 5000,
          inByoyomi: true,
          timedOut: false,
        },
      }
      timer = startTimer(timer, 'B', 1000)

      // Tick 6 seconds — should timeout
      const result = tickTimer(timer, 7000)
      expect(result.timedOut).toBe('B')
      expect(result.state.black.timedOut).toBe(true)
    })

    it('does nothing when paused', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      const timer = createTimerState(tc) // Starts paused

      const result = tickTimer(timer, 5000)
      expect(result.state.black.mainTimeMs).toBe(180_000)
      expect(result.timedOut).toBeNull()
    })

    it('does nothing when no active player', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      let timer = createTimerState(tc)
      timer = { ...timer, isPaused: false, lastTickTime: 1000 }

      const result = tickTimer(timer, 2000)
      expect(result.state.black.mainTimeMs).toBe(180_000)
    })
  })

  describe('formatTime', () => {
    it('formats minutes and seconds', () => {
      expect(formatTime(180_000)).toBe('3:00')
      expect(formatTime(61_000)).toBe('1:01')
      expect(formatTime(9_500)).toBe('0:10') // Ceil rounds up
    })

    it('handles zero', () => {
      expect(formatTime(0)).toBe('0:00')
    })

    it('handles negative (clamped to 0)', () => {
      expect(formatTime(-5000)).toBe('0:00')
    })
  })

  describe('getTimerDisplay', () => {
    it('shows main time', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 120_000,
        byoyomiPeriodsRemaining: 3,
        byoyomiTimeMs: 10_000,
        inByoyomi: false,
        timedOut: false,
      }
      expect(getTimerDisplay(timer)).toBe('2:00')
    })

    it('shows byoyomi with period count', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 0,
        byoyomiPeriodsRemaining: 2,
        byoyomiTimeMs: 7000,
        inByoyomi: true,
        timedOut: false,
      }
      expect(getTimerDisplay(timer)).toBe('0:07 (2)')
    })

    it('shows 0:00 when timed out', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 0,
        byoyomiPeriodsRemaining: 0,
        byoyomiTimeMs: 0,
        inByoyomi: true,
        timedOut: true,
      }
      expect(getTimerDisplay(timer)).toBe('0:00')
    })
  })

  describe('getTimerUrgency', () => {
    it('returns normal for plenty of time', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 120_000,
        byoyomiPeriodsRemaining: 3,
        byoyomiTimeMs: 10_000,
        inByoyomi: false,
        timedOut: false,
      }
      expect(getTimerUrgency(timer)).toBe('normal')
    })

    it('returns warning under 1 minute', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 45_000,
        byoyomiPeriodsRemaining: 3,
        byoyomiTimeMs: 10_000,
        inByoyomi: false,
        timedOut: false,
      }
      expect(getTimerUrgency(timer)).toBe('warning')
    })

    it('returns critical under 30 seconds', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 20_000,
        byoyomiPeriodsRemaining: 3,
        byoyomiTimeMs: 10_000,
        inByoyomi: false,
        timedOut: false,
      }
      expect(getTimerUrgency(timer)).toBe('critical')
    })

    it('returns warning in byoyomi with multiple periods', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 0,
        byoyomiPeriodsRemaining: 2,
        byoyomiTimeMs: 8000,
        inByoyomi: true,
        timedOut: false,
      }
      expect(getTimerUrgency(timer)).toBe('warning')
    })

    it('returns critical in last byoyomi period', () => {
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 0,
        byoyomiPeriodsRemaining: 1,
        byoyomiTimeMs: 5000,
        inByoyomi: true,
        timedOut: false,
      }
      expect(getTimerUrgency(timer)).toBe('critical')
    })
  })

  describe('getTotalRemainingMs', () => {
    it('includes main time plus all byoyomi periods', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 100_000,
        byoyomiPeriodsRemaining: 3,
        byoyomiTimeMs: 10_000,
        inByoyomi: false,
        timedOut: false,
      }
      // 100s main + 3 * 10s = 130s = 130000ms
      expect(getTotalRemainingMs(timer, tc)).toBe(130_000)
    })

    it('returns 0 when timed out', () => {
      const tc = { mainTime: 180, byoyomiPeriods: 3, byoyomiTime: 10 }
      const timer: QuickGoPlayerTimer = {
        mainTimeMs: 0,
        byoyomiPeriodsRemaining: 0,
        byoyomiTimeMs: 0,
        inByoyomi: true,
        timedOut: true,
      }
      expect(getTotalRemainingMs(timer, tc)).toBe(0)
    })
  })
})

// =============================================================================
// 2. DIFFICULTY TESTS
// =============================================================================

describe('QuickGoDifficulty', () => {
  describe('getPresetRange', () => {
    it('returns beginner range 1-10', () => {
      const range = getPresetRange('beginner')
      expect(range.min).toBe(1)
      expect(range.max).toBe(10)
      expect(range.default).toBe(5)
    })

    it('returns intermediate range 11-20', () => {
      const range = getPresetRange('intermediate')
      expect(range.min).toBe(11)
      expect(range.max).toBe(20)
    })

    it('returns advanced range 21-30', () => {
      const range = getPresetRange('advanced')
      expect(range.min).toBe(21)
      expect(range.max).toBe(30)
    })
  })

  describe('getDefaultLevel', () => {
    it('returns 5 for beginner', () => {
      expect(getDefaultLevel('beginner')).toBe(5)
    })

    it('returns 15 for intermediate', () => {
      expect(getDefaultLevel('intermediate')).toBe(15)
    })

    it('returns 25 for advanced', () => {
      expect(getDefaultLevel('advanced')).toBe(25)
    })
  })

  describe('getDifficultyForPreset', () => {
    it('returns valid config for each preset', () => {
      const begConfig = getDifficultyForPreset('beginner')
      expect(begConfig.level).toBe(5)
      expect(begConfig.maxVisits).toBeGreaterThan(0)

      const intConfig = getDifficultyForPreset('intermediate')
      expect(intConfig.level).toBe(15)

      const advConfig = getDifficultyForPreset('advanced')
      expect(advConfig.level).toBe(25)
    })

    it('beginner has fewer visits than advanced', () => {
      const begConfig = getDifficultyForPreset('beginner')
      const advConfig = getDifficultyForPreset('advanced')
      expect(begConfig.maxVisits).toBeLessThan(advConfig.maxVisits)
    })
  })

  describe('getDifficultyForLevel', () => {
    it('returns exact level config from 30-level system', () => {
      const config = getDifficultyForLevel(15)
      expect(config.level).toBe(15)
      expect(config.maxVisits).toBe(90)
    })
  })

  describe('getDifficultyLabel', () => {
    it('returns formatted label', () => {
      const label = getDifficultyLabel(5)
      expect(label).toContain('Level 5')
      expect(label).toContain('13k')
    })
  })

  describe('getPresetForLevel', () => {
    it('maps levels to correct presets', () => {
      expect(getPresetForLevel(1)).toBe('beginner')
      expect(getPresetForLevel(10)).toBe('beginner')
      expect(getPresetForLevel(11)).toBe('intermediate')
      expect(getPresetForLevel(20)).toBe('intermediate')
      expect(getPresetForLevel(21)).toBe('advanced')
      expect(getPresetForLevel(30)).toBe('advanced')
    })
  })

  describe('adjustDifficulty', () => {
    it('increases on win', () => {
      const newLevel = adjustDifficulty(5, 'beginner', true, 8, 50)
      expect(newLevel).toBe(6)
    })

    it('increases by 2 on dominant win', () => {
      const newLevel = adjustDifficulty(5, 'beginner', true, 15, 30) // Under 40 moves
      expect(newLevel).toBe(7)
    })

    it('decreases on loss', () => {
      const newLevel = adjustDifficulty(5, 'beginner', false, -15, 50)
      expect(newLevel).toBe(3) // -2 for heavy loss
    })

    it('stays same on close game', () => {
      const newLevelWin = adjustDifficulty(5, 'beginner', true, 3, 50)
      expect(newLevelWin).toBe(5)

      const newLevelLoss = adjustDifficulty(5, 'beginner', false, -3, 50)
      expect(newLevelLoss).toBe(5)
    })

    it('clamps to range min', () => {
      const newLevel = adjustDifficulty(1, 'beginner', false, -20, 50)
      expect(newLevel).toBe(1)
    })

    it('clamps to range max', () => {
      const newLevel = adjustDifficulty(10, 'beginner', true, 20, 30)
      expect(newLevel).toBe(10)
    })
  })
})

// =============================================================================
// 3. DEFAULT CONFIG TESTS
// =============================================================================

describe('Quick Go Default Config', () => {
  it('has 9x9 board', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.boardSize).toBe(9)
  })

  it('has 6.5 komi', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.komi).toBe(6.5)
  })

  it('has 3 minute main time', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.timeControl.mainTime).toBe(180)
  })

  it('has 3 byoyomi periods of 10 seconds', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.timeControl.byoyomiPeriods).toBe(3)
    expect(DEFAULT_QUICK_GO_CONFIG.timeControl.byoyomiTime).toBe(10)
  })

  it('defaults to Black', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.playerColor).toBe('B')
  })

  it('defaults to beginner', () => {
    expect(DEFAULT_QUICK_GO_CONFIG.difficultyPreset).toBe('beginner')
    expect(DEFAULT_QUICK_GO_CONFIG.explanationTier).toBe('beginner')
  })
})

// =============================================================================
// 4. CONTROLLER TESTS
// =============================================================================

describe('QuickGoController', () => {
  describe('startGame', () => {
    it('initializes game state and transitions to playing', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame()

      expect(controller.getPhase()).toBe('playing')
      expect(controller.getConfig().boardSize).toBe(9)

      const gameStore = useGameStore.getState()
      expect(gameStore.status).toBe('playing')
      expect(gameStore.boardSize).toBe(9)
    })

    it('accepts config overrides', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame({ komi: 7.5, difficultyPreset: 'advanced' })

      expect(controller.getConfig().komi).toBe(7.5)
      expect(controller.getConfig().difficultyPreset).toBe('advanced')
    })

    it('sets difficulty on KataGo bridge', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame({ difficultyLevel: 15 })

      expect(deps.bridge.difficultyLevel).toBe(15)
    })

    it('starts timer for Black', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame()

      const timer = controller.getTimer()
      expect(timer.activePlayer).toBe('B')
      expect(timer.isPaused).toBe(false)
    })
  })

  describe('handlePlayerMove', () => {
    it('plays a valid move', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play at E5 (center of 9x9: row 4, col 4 = index 40)
      const result = controller.handlePlayerMove(40)

      expect(result.success).toBe(true)
      expect(result.gameEnded).toBe(false)
      expect(result.coordinate).toBe('E5')
    })

    it('rejects move when not in playing phase', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      // Don't start game — still in setup

      const result = controller.handlePlayerMove(40)

      expect(result.success).toBe(false)
      expect(result.error).toContain('not in playing phase')
    })

    it('rejects illegal moves', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play at index 40
      controller.handlePlayerMove(40)
      // AI turn — manually advance to player's turn
      const gameStore = useGameStore.getState()

      // Try to play at the same spot (should be White's turn now anyway)
      // First let's simulate AI response to get back to Black's turn
      // Instead, test that an occupied space is rejected
      // We need to get back to Black's turn, so let's pass for White
      gameStore.pass() // White passes

      // Now Black tries to play on occupied E5
      const result = controller.handlePlayerMove(40)
      expect(result.success).toBe(false)
    })

    it('switches timer after move', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      controller.handlePlayerMove(40) // Black plays

      const timer = controller.getTimer()
      // After Black plays, timer switches to White
      expect(timer.activePlayer).toBe('W')
    })
  })

  describe('handlePass', () => {
    it('passes the turn', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      const result = controller.handlePass()
      expect(result.success).toBe(true)
    })

    it('ends game on double pass', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      controller.handlePass() // Black passes
      // Simulate White passing (normally AI would do this)
      const gameStore = useGameStore.getState()
      gameStore.pass() // White passes — game should end

      // The game ended during the White pass within the store
      expect(useGameStore.getState().status).toBe('finished')
    })
  })

  describe('handleResign', () => {
    it('ends the game with resignation', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      controller.handleResign()

      expect(controller.getPhase()).toBe('analyzing')
      const result = controller.getGameResult()
      expect(result).not.toBeNull()
      expect(result?.endReason).toBe('resignation')
    })

    it('does nothing when not playing', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      // Still in setup
      controller.handleResign()
      expect(controller.getPhase()).toBe('setup')
    })
  })

  describe('handleAIResponse', () => {
    it('gets and applies an AI move', async () => {
      const deps = createTestDeps('D5')
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Player plays at E5
      controller.handlePlayerMove(40)

      // AI responds
      const result = await controller.handleAIResponse()

      expect(result.success).toBe(true)
      expect(result.gameEnded).toBe(false)
    })

    it('handles AI error gracefully', async () => {
      const deps = createTestDeps()
      // Override analyze to return error
      deps.katagoBridge.analyze = async () => {
        return Err({
          module: 'katago' as const,
          code: 'ANALYSIS_TIMEOUT' as const,
          message: 'Timeout',
        })
      }

      const controller = createQuickGoController(deps)
      controller.startGame()
      controller.handlePlayerMove(40)

      const result = await controller.handleAIResponse()

      expect(result.success).toBe(false)
      expect(result.error).toContain('AI error')
    })

    it('AI passes when no moves available', async () => {
      const deps = createTestDeps()
      // Override to return pass
      deps.katagoBridge.analyze = async (query) => {
        return Ok({
          id: query.id,
          isDuringSearch: false,
          turnNumber: 0,
          moveInfos: [createMockMoveInfo('pass', 0.5, 0)],
          rootInfo: createMockRootInfo(0.5, 'W'),
        })
      }

      const controller = createQuickGoController(deps)
      controller.startGame()
      controller.handlePlayerMove(40)

      const result = await controller.handleAIResponse()
      expect(result.success).toBe(true)
    })
  })

  describe('tickTimer', () => {
    it('updates timer state', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      const initialTime = controller.getTimer().black.mainTimeMs

      // Tick forward 1 second
      controller.tickTimer(Date.now() + 1000)

      const newTime = controller.getTimer().black.mainTimeMs
      // Time should have decreased (approximately 1000ms, maybe less due to timing)
      expect(newTime).toBeLessThan(initialTime)
    })

    it('triggers timeout and ends game', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame({
        timeControl: { mainTime: 1, byoyomiPeriods: 0, byoyomiTime: 0 },
      })

      // Start timer manually to control timestamps
      const now = Date.now()

      // Tick forward 2 seconds — should timeout with 1s main time and 0 byoyomi
      const timedOut = controller.tickTimer(now + 2000)

      expect(timedOut).toBe('B')
      expect(controller.getPhase()).toBe('analyzing')
    })
  })

  describe('endGame', () => {
    it('computes score and creates result', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play a few moves then end
      controller.handlePlayerMove(0) // A9
      useGameStore.getState().pass() // White passes
      controller.handlePass() // Black passes — game ends via double pass

      // Game already ended via pass-pass, manually call endGame for scoring
      // Reset phase for testing
      // Actually, the double pass already calls endGame. Let's test via direct call.
      const deps2 = createTestDeps()
      const ctrl2 = createQuickGoController(deps2)
      ctrl2.startGame()
      ctrl2.handlePlayerMove(0)
      // Force end
      const result = ctrl2.endGame('scoring')

      expect(result).toBeDefined()
      expect(result.endReason).toBe('scoring')
      expect(result.score).not.toBeNull()
    })

    it('updates session stats', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()
      controller.handlePlayerMove(0)
      controller.endGame('scoring')

      const session = controller.getSession()
      expect(session.gamesPlayed).toBe(1)
    })
  })

  describe('analyzeGame', () => {
    it('returns analysis results', async () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play a few moves
      controller.handlePlayerMove(0) // Black at A9
      useGameStore.getState().playMove(10) // White at B8
      controller.handlePlayerMove(1) // Black at B9
      useGameStore.getState().playMove(11) // White at C8

      // End game
      controller.endGame('scoring')

      // Analyze
      const analysis = await controller.analyzeGame()

      expect(analysis).not.toBeNull()
      expect(analysis.analyzedMoves.length).toBeGreaterThan(0)
      expect(analysis.accuracy).toBeGreaterThanOrEqual(0)
      expect(analysis.accuracy).toBeLessThanOrEqual(100)
    })

    it('returns empty analysis when not in analyzing phase', async () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      // Don't start game
      const analysis = await controller.analyzeGame()
      expect(analysis.analyzedMoves.length).toBe(0)
    })
  })

  describe('rematch', () => {
    it('starts a new game with preserved session', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame()
      controller.handlePlayerMove(0)
      controller.endGame('scoring')

      expect(controller.getSession().gamesPlayed).toBe(1)

      controller.rematch()

      expect(controller.getPhase()).toBe('playing')
      // Session should carry over
      expect(controller.getSession().gamesPlayed).toBe(1)
    })
  })

  describe('reset', () => {
    it('clears everything', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)

      controller.startGame()
      controller.handlePlayerMove(0)
      controller.endGame('scoring')
      controller.reset()

      expect(controller.getPhase()).toBe('setup')
      expect(controller.getSession().gamesPlayed).toBe(0)
      expect(controller.getGameResult()).toBeNull()
    })
  })

  describe('getState', () => {
    it('returns full state snapshot', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      const state = controller.getState()

      expect(state.phase).toBe('playing')
      expect(state.config.boardSize).toBe(9)
      expect(state.timer).toBeDefined()
      expect(state.ai.isThinking).toBe(false)
      expect(state.moveCount).toBe(0)
      expect(state.progressPercent).toBe(0)
    })
  })

  describe('estimateProgress', () => {
    it('increases with moves', () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play several moves
      controller.handlePlayerMove(0)
      useGameStore.getState().playMove(10)
      controller.handlePlayerMove(1)
      useGameStore.getState().playMove(11)

      const state = controller.getState()
      expect(state.progressPercent).toBeGreaterThan(0)
      expect(state.moveCount).toBe(4)
    })
  })
})

// =============================================================================
// 5. ANALYZER TESTS
// =============================================================================

describe('QuickGoAnalyzer', () => {
  describe('analyzeGame', () => {
    it('analyzes moves and returns results', async () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play some moves
      controller.handlePlayerMove(0)
      useGameStore.getState().playMove(10)

      const moves = useGameStore.getState().moveHistory
      const analysis = await analyzeGame(
        moves,
        9,
        6.5,
        'B',
        deps.katagoBridge,
        deps.explanationEngine,
        'beginner'
      )

      expect(analysis.analyzedMoves.length).toBe(2)
      expect(analysis.totalMoves).toBe(2)
      expect(analysis.isAnalyzing).toBe(false)
    })

    it('reports progress during analysis', async () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      controller.handlePlayerMove(0)
      useGameStore.getState().playMove(10)

      const progressCalls: number[] = []
      const moves = useGameStore.getState().moveHistory

      await analyzeGame(
        moves,
        9,
        6.5,
        'B',
        deps.katagoBridge,
        deps.explanationEngine,
        'beginner',
        (partial) => {
          progressCalls.push(partial.analyzedCount)
        }
      )

      expect(progressCalls.length).toBeGreaterThan(0)
    })

    it('generates explanations for top moves', async () => {
      const deps = createTestDeps()
      const controller = createQuickGoController(deps)
      controller.startGame()

      // Play several moves for analysis
      controller.handlePlayerMove(0)
      useGameStore.getState().playMove(10)
      controller.handlePlayerMove(1)
      useGameStore.getState().playMove(11)

      const moves = useGameStore.getState().moveHistory

      const analysis = await analyzeGame(
        moves,
        9,
        6.5,
        'B',
        deps.katagoBridge,
        deps.explanationEngine,
        'beginner'
      )

      // At least some top moves should have explanations
      const movesWithExplanations = analysis.topMoves.filter((m) => m.explanation !== null)
      expect(movesWithExplanations.length).toBeGreaterThan(0)
    })
  })

  describe('findBlunders', () => {
    it('finds moves with large negative winrate delta', () => {
      const moves: AnalyzedMove[] = [
        {
          moveNumber: 0,
          player: 'B',
          coordinate: 'E5',
          winrateBefore: 50,
          winrateAfter: 55,
          winrateDelta: 5,
          bestMove: 'E5',
          wasBestMove: true,
          explanation: null,
          analysisResponse: null,
        },
        {
          moveNumber: 2,
          player: 'B',
          coordinate: 'D3',
          winrateBefore: 55,
          winrateAfter: 40,
          winrateDelta: -15,
          bestMove: 'C4',
          wasBestMove: false,
          explanation: null,
          analysisResponse: null,
        },
        {
          moveNumber: 4,
          player: 'B',
          coordinate: 'F7',
          winrateBefore: 40,
          winrateAfter: 38,
          winrateDelta: -2,
          bestMove: 'G6',
          wasBestMove: false,
          explanation: null,
          analysisResponse: null,
        },
      ]

      const blunders = findBlunders(moves)
      expect(blunders.length).toBe(1)
      expect(blunders[0]?.moveNumber).toBe(2)
    })

    it('uses custom threshold', () => {
      const moves: AnalyzedMove[] = [
        {
          moveNumber: 0,
          player: 'B',
          coordinate: 'E5',
          winrateBefore: 50,
          winrateAfter: 47,
          winrateDelta: -3,
          bestMove: 'D5',
          wasBestMove: false,
          explanation: null,
          analysisResponse: null,
        },
      ]

      expect(findBlunders(moves, 2).length).toBe(1)
      expect(findBlunders(moves, 5).length).toBe(0)
    })
  })

  describe('constants', () => {
    it('BLUNDER_THRESHOLD is 5', () => {
      expect(BLUNDER_THRESHOLD).toBe(5)
    })

    it('TOP_MOVES_COUNT is 5', () => {
      expect(TOP_MOVES_COUNT).toBe(5)
    })
  })
})

// =============================================================================
// 6. INTEGRATION TESTS
// =============================================================================

describe('Quick Go Integration', () => {
  it('complete game flow: start -> play -> end -> score', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)

    // Start
    controller.startGame()
    expect(controller.getPhase()).toBe('playing')

    // Play some moves
    controller.handlePlayerMove(0) // Black A9
    useGameStore.getState().playMove(10) // White B8
    controller.handlePlayerMove(1) // Black B9
    useGameStore.getState().playMove(11) // White C8

    // End game
    const result = controller.endGame('scoring')

    expect(result).toBeDefined()
    expect(result.score).not.toBeNull()
    expect(controller.getPhase()).toBe('analyzing')
  })

  it('game flow with pass-pass ending', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)
    controller.startGame()

    // Both players pass immediately
    controller.handlePass() // Black passes

    // Store shows White's turn
    expect(useGameStore.getState().currentPlayer).toBe('W')

    // White passes (normally AI would do this)
    useGameStore.getState().pass()

    // Game should be finished
    expect(useGameStore.getState().status).toBe('finished')
  })

  it('game flow with resignation', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)
    controller.startGame()

    controller.handlePlayerMove(0)
    controller.handleResign()

    expect(controller.getPhase()).toBe('analyzing')
    const result = controller.getGameResult()
    expect(result).not.toBeNull()
    expect(result?.endReason).toBe('resignation')
    expect(result?.winner).toBe('W') // Black resigned, White wins
  })

  it('session stats accumulate across games', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)

    // Game 1
    controller.startGame()
    controller.handlePlayerMove(0)
    controller.endGame('scoring')

    // Game 2
    controller.rematch()
    controller.handlePlayerMove(0)
    controller.endGame('scoring')

    expect(controller.getSession().gamesPlayed).toBe(2)
  })

  it('difficulty uses 30-level system exclusively', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)

    // Start with specific level
    controller.startGame({ difficultyLevel: 20 })

    // Verify the bridge received the correct level
    expect(deps.bridge.difficultyLevel).toBe(20)

    // Verify the config from 30-level system
    const config = getDifficultyForLevel(20)
    expect(config.level).toBe(20)
    expect(config.maxVisits).toBe(260) // Level 20 from the table
  })

  it('no dead-end states — user always has valid actions', () => {
    const deps = createTestDeps()
    const controller = createQuickGoController(deps)

    // Setup phase: can start
    expect(controller.getPhase()).toBe('setup')

    // Playing phase: can move, pass, resign
    controller.startGame()
    expect(controller.getPhase()).toBe('playing')

    const moveResult = controller.handlePlayerMove(0)
    expect(moveResult.success).toBe(true)

    // After game ends: can analyze or rematch
    controller.endGame('scoring')
    expect(controller.getPhase()).toBe('analyzing')

    // Can still call rematch
    controller.rematch()
    expect(controller.getPhase()).toBe('playing')

    // Can reset from any state
    controller.reset()
    expect(controller.getPhase()).toBe('setup')
  })
})
