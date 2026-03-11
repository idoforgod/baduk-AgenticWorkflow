// =============================================================================
// features/optimization/optimization.test.ts — Optimization module tests
// =============================================================================
// Test coverage:
// 1. LazyModules: registry structure, preload functions, app-init modules
// 2. KataGoWarmup: state machine transitions, timeout handling, retries
// 3. RenderOptimization: shallow equality, board diff, throttle, tracker
// 4. DbOptimization: bulk insert, LRU eviction, WAL checkpoint, cache key
// 5. BundleConfig: chunk grouping, budget validation, manual chunks
// =============================================================================

import type {
  AnalysisQuery,
  AnalysisResponse,
  BackendInfo,
  CircuitBreakerState,
  IKatagoBridge,
  KataGoConfig,
  KataGoError,
  KataGoStatus,
  MoveInfo,
  Result,
  RootInfo,
  VersionInfo,
  VisitsTierConfig,
} from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  allChunkBudgetsPassing,
  BUNDLE_BUDGET,
  CHUNK_BUDGETS,
  createManualChunks,
  getChunkGroupForModule,
  validateChunkBudgets,
} from './BundleConfig'
import {
  buildAnalysisCacheKey,
  computeLruEviction,
  createWalCheckpointTracker,
  optimizeForBulkInsert,
  SQLITE_CONNECTION_RECOMMENDATIONS,
  shouldCacheAnalysis,
} from './DbOptimization'
import { createKataGoWarmup, KataGoWarmup } from './KataGoWarmup'
import {
  getAppInitModules,
  getModuleEntry,
  LAZY_MODULE_REGISTRY,
  preloadModule,
} from './LazyModules'
import {
  createBoardTracker,
  createEmptyBoardState,
  createMemoizedSelector,
  createThrottledCallback,
  diffBoardState,
  MOVE_LIST_VIRTUALIZATION,
  shallowEqual,
} from './RenderOptimization'
import type { AnalysisCacheEntry } from './types'
import { DEFAULT_LRU_EVICTION_CONFIG, DEFAULT_WARMUP_CONFIG } from './types'

// =============================================================================
// Test Helpers — Mock IKatagoBridge
// =============================================================================

function createMockRootInfo(winrate: number): RootInfo {
  return {
    visits: 1,
    winrate,
    scoreLead: (winrate - 0.5) * 20,
    scoreMean: (winrate - 0.5) * 20,
    scoreSelfplay: (winrate - 0.5) * 20,
    scoreStdev: 5,
    utility: (winrate - 0.5) * 2,
    utilityLcb: (winrate - 0.5) * 2 - 0.1,
    lcb: winrate - 0.05,
    rawLead: (winrate - 0.5) * 20,
    rawNoResultProb: 0,
    rawStScoreError: 0.5,
    rawStWrError: 0.05,
    rawVarTimeLeft: 0,
    rawWinrate: winrate,
    symHash: 'AABBCCDDEEFF0011',
    thisHash: 'AABBCCDDEEFF0011',
    noResultProb: 0,
    drawProb: 0,
  }
}

function createMockMoveInfo(move: string, winrate: number): MoveInfo {
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
    lcb: winrate - 0.05,
    utilityLcb: (winrate - 0.5) * 2 - 0.1,
    order: 0,
    isSymmetryOf: null,
  }
}

function createMockAnalysisResponse(): AnalysisResponse {
  return {
    id: 'test-query',
    turnNumber: 0,
    moveInfos: [createMockMoveInfo('D4', 0.55)],
    rootInfo: createMockRootInfo(0.55),
    isDuringSearch: false,
  }
}

/**
 * Create a mock IKatagoBridge for testing.
 */
function createMockBridge(options?: {
  initShouldFail?: boolean
  analyzeShouldFail?: boolean
  initDelayMs?: number
  analyzeDelayMs?: number
}): IKatagoBridge {
  const opts = {
    initShouldFail: false,
    analyzeShouldFail: false,
    initDelayMs: 0,
    analyzeDelayMs: 0,
    ...options,
  }

  const initialize = async (_config: KataGoConfig): Promise<Result<VersionInfo, KataGoError>> => {
    if (opts.initDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.initDelayMs))
    }
    if (opts.initShouldFail) {
      return Err({
        module: 'katago' as const,
        code: 'STARTUP_FAILED' as const,
        message: 'Mock initialization failure',
      })
    }
    return Ok({ version: '1.14.0', gitHash: 'abc123' })
  }

  const analyze = async (_query: AnalysisQuery): Promise<Result<AnalysisResponse, KataGoError>> => {
    if (opts.analyzeDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.analyzeDelayMs))
    }
    if (opts.analyzeShouldFail) {
      return Err({
        module: 'katago' as const,
        code: 'ANALYSIS_ERROR' as const,
        message: 'Mock analysis failure',
      })
    }
    return Ok(createMockAnalysisResponse())
  }

  const getStatus = (): KataGoStatus => ({
    state: 'ready',
    message: 'Mock KataGo ready',
    pendingQueries: 0,
    uptimeSeconds: 0,
  })

  const isHealthy = (): boolean => true

  const getCircuitBreakerState = (): CircuitBreakerState => ({
    state: 'closed',
    failureCount: 0,
    lastFailure: null,
    nextRetry: null,
  })

  const getVisitsTiers = (): VisitsTierConfig => ({ fast: 5, standard: 50, deep: 500 })

  const shutdown = async (): Promise<Result<void, KataGoError>> => Ok(undefined)
  const cancelAnalysis = async (_id: string): Promise<Result<void, KataGoError>> => Ok(undefined)
  const cancelAll = async (): Promise<Result<void, KataGoError>> => Ok(undefined)
  const analyzeMultiple = async (
    queries: readonly AnalysisQuery[]
  ): Promise<Result<readonly AnalysisResponse[], KataGoError>> => {
    const results: AnalysisResponse[] = []
    for (const _q of queries) {
      results.push(createMockAnalysisResponse())
    }
    return Ok(results)
  }
  const calibrateVisitsTiers = async (): Promise<Result<VisitsTierConfig, KataGoError>> =>
    Ok({ fast: 5, standard: 50, deep: 500 })
  const getBackendInfo = async (): Promise<Result<BackendInfo, KataGoError>> =>
    Ok({ backend: 'eigen', gpuName: 'CPU', binaryPath: '/mock/katago', needsTuning: false })

  return {
    initialize,
    analyze,
    analyzeMultiple,
    shutdown,
    cancelAnalysis,
    cancelAll,
    getStatus,
    isHealthy,
    getCircuitBreakerState,
    getVisitsTiers,
    calibrateVisitsTiers,
    getBackendInfo,
  }
}

const MOCK_KATAGO_CONFIG: KataGoConfig = {
  binaryPath: '/mock/katago',
  configPath: '/mock/katago.cfg',
  modelPath: '/mock/model.bin.gz',
}

// =============================================================================
// 1. LazyModules Tests
// =============================================================================

describe('LazyModules', () => {
  describe('LAZY_MODULE_REGISTRY', () => {
    it('contains all four expected module keys', () => {
      const keys = Object.keys(LAZY_MODULE_REGISTRY)
      expect(keys).toContain('katago')
      expect(keys).toContain('explanation')
      expect(keys).toContain('analytics')
      expect(keys).toContain('gamification')
    })

    it('marks analytics as preloadOnAppInit = true', () => {
      expect(LAZY_MODULE_REGISTRY.analytics.preloadOnAppInit).toBe(true)
    })

    it('marks katago as preloadOnAppInit = false (lazy until game start)', () => {
      expect(LAZY_MODULE_REGISTRY.katago.preloadOnAppInit).toBe(false)
    })

    it('marks explanation as preloadOnAppInit = false', () => {
      expect(LAZY_MODULE_REGISTRY.explanation.preloadOnAppInit).toBe(false)
    })

    it('marks gamification as preloadOnAppInit = false', () => {
      expect(LAZY_MODULE_REGISTRY.gamification.preloadOnAppInit).toBe(false)
    })

    it('all entries have positive estimatedKb', () => {
      for (const key of Object.keys(LAZY_MODULE_REGISTRY) as Array<
        keyof typeof LAZY_MODULE_REGISTRY
      >) {
        expect(LAZY_MODULE_REGISTRY[key].estimatedKb).toBeGreaterThan(0)
      }
    })

    it('all entries have a non-empty name', () => {
      for (const key of Object.keys(LAZY_MODULE_REGISTRY) as Array<
        keyof typeof LAZY_MODULE_REGISTRY
      >) {
        expect(LAZY_MODULE_REGISTRY[key].name.length).toBeGreaterThan(0)
      }
    })
  })

  describe('getAppInitModules()', () => {
    it('returns only modules with preloadOnAppInit = true', () => {
      const keys = getAppInitModules()
      expect(keys).toContain('analytics')
      expect(keys).not.toContain('katago')
      expect(keys).not.toContain('explanation')
      expect(keys).not.toContain('gamification')
    })
  })

  describe('getModuleEntry()', () => {
    it('returns correct entry for katago', () => {
      const entry = getModuleEntry('katago')
      expect(entry.name).toBe('KataGo Bridge')
      expect(entry.preloadOnAppInit).toBe(false)
    })

    it('returns correct entry for analytics', () => {
      const entry = getModuleEntry('analytics')
      expect(entry.preloadOnAppInit).toBe(true)
    })
  })

  describe('preloadModule()', () => {
    it('returns a PreloadResult with the correct key', async () => {
      // Dynamic import will fail in test environment — we just check the shape
      const result = await preloadModule('analytics')
      expect(result.key).toBe('analytics')
      expect(typeof result.elapsedMs).toBe('number')
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
      // success may be true or false depending on test environment
      expect(typeof result.success).toBe('boolean')
    })

    it('records elapsed time even on failure', async () => {
      const result = await preloadModule('katago')
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    })

    it('sets error message on failure', async () => {
      const result = await preloadModule('gamification')
      if (!result.success) {
        expect(typeof result.error).toBe('string')
        expect((result.error ?? '').length).toBeGreaterThan(0)
      }
    })
  })
})

// =============================================================================
// 2. KataGoWarmup Tests
// =============================================================================

describe('KataGoWarmup', () => {
  describe('initial state', () => {
    it('starts in cold state', () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      expect(warmup.getState()).toBe('cold')
      expect(warmup.isReady()).toBe(false)
    })

    it('initial status has null timestamps and zero attempts', () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      const status = warmup.getStatus()
      expect(status.warmupStartedAt).toBeNull()
      expect(status.warmupCompletedAt).toBeNull()
      expect(status.attemptCount).toBe(0)
      expect(status.errorMessage).toBeNull()
    })
  })

  describe('state machine: cold -> warming -> ready', () => {
    it('transitions to ready on successful warmup', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      const result = await warmup.startWarmup()

      expect(result).toBe(true)
      expect(warmup.getState()).toBe('ready')
      expect(warmup.isReady()).toBe(true)
    })

    it('records warmupStartedAt and warmupCompletedAt on success', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      const before = Date.now()

      await warmup.startWarmup()

      const status = warmup.getStatus()
      expect(status.warmupStartedAt).toBeGreaterThanOrEqual(before)
      expect(status.warmupCompletedAt).toBeGreaterThanOrEqual(before)
      expect(status.warmupCompletedAt).toBeGreaterThanOrEqual(status.warmupStartedAt!)
    })

    it('increments attemptCount on each warmup', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      await warmup.startWarmup()
      expect(warmup.getStatus().attemptCount).toBe(1)
    })
  })

  describe('state machine: cold -> warming -> error', () => {
    it('transitions to error when initialization fails', async () => {
      const bridge = createMockBridge({ initShouldFail: true })
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      const result = await warmup.startWarmup()

      expect(result).toBe(false)
      expect(warmup.getState()).toBe('error')
      expect(warmup.isReady()).toBe(false)
    })

    it('sets errorMessage when initialization fails', async () => {
      const bridge = createMockBridge({ initShouldFail: true })
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      await warmup.startWarmup()

      const status = warmup.getStatus()
      expect(status.errorMessage).not.toBeNull()
      expect(status.errorMessage!.length).toBeGreaterThan(0)
    })

    it('transitions to error when health check (analyze) fails', async () => {
      const bridge = createMockBridge({ analyzeShouldFail: true })
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      const result = await warmup.startWarmup()

      expect(result).toBe(false)
      expect(warmup.getState()).toBe('error')
    })
  })

  describe('state machine: error -> warming -> ready (retry)', () => {
    it('allows retry from error state', async () => {
      let callCount = 0
      const bridge: IKatagoBridge = {
        ...createMockBridge(),
        initialize: async (_config: KataGoConfig): Promise<Result<VersionInfo, KataGoError>> => {
          callCount++
          if (callCount === 1) {
            return Err({
              module: 'katago' as const,
              code: 'STARTUP_FAILED' as const,
              message: 'First attempt fails',
            })
          }
          return Ok({ version: '1.14.0', gitHash: '' })
        },
      }

      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      // First attempt fails
      const firstResult = await warmup.startWarmup()
      expect(firstResult).toBe(false)
      expect(warmup.getState()).toBe('error')

      // Second attempt succeeds
      const secondResult = await warmup.startWarmup()
      expect(secondResult).toBe(true)
      expect(warmup.getState()).toBe('ready')
    })

    it('does not double-start when already warming', async () => {
      const bridge = createMockBridge({ initDelayMs: 50 })
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      const [first, second] = await Promise.all([warmup.startWarmup(), warmup.startWarmup()])

      // Second call returns false immediately (already warming)
      expect(second).toBe(false)
      expect(first).toBe(true)
    })
  })

  describe('reset()', () => {
    it('resets state back to cold', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      await warmup.startWarmup()
      expect(warmup.getState()).toBe('ready')

      warmup.reset()

      expect(warmup.getState()).toBe('cold')
      expect(warmup.isReady()).toBe(false)
      expect(warmup.getStatus().attemptCount).toBe(0)
      expect(warmup.getStatus().warmupStartedAt).toBeNull()
    })
  })

  describe('onStateChange()', () => {
    it('notifies listeners on state transitions', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      const states: string[] = []

      warmup.onStateChange((status) => {
        states.push(status.state)
      })

      await warmup.startWarmup()

      // Should have seen: warming, ready
      expect(states).toContain('warming')
      expect(states).toContain('ready')
    })

    it('returns an unsubscribe function that stops notifications', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      const states: string[] = []

      const unsubscribe = warmup.onStateChange((status) => {
        states.push(status.state)
      })

      unsubscribe()
      await warmup.startWarmup()

      // No notifications after unsubscribe
      expect(states).toHaveLength(0)
    })
  })

  describe('timeout handling', () => {
    it('fails with error when initialization exceeds timeout', async () => {
      const bridge = createMockBridge({ initDelayMs: 200 })
      const warmup = createKataGoWarmup(bridge, MOCK_KATAGO_CONFIG, {
        healthCheckTimeoutMs: 50, // Very short timeout
      })

      const result = await warmup.startWarmup()

      expect(result).toBe(false)
      expect(warmup.getState()).toBe('error')
      expect(warmup.getStatus().errorMessage).not.toBeNull()
    }, 2000)

    it('DEFAULT_WARMUP_CONFIG has 5000ms health check timeout', () => {
      expect(DEFAULT_WARMUP_CONFIG.healthCheckTimeoutMs).toBe(5000)
    })

    it('DEFAULT_WARMUP_CONFIG has autoStart = false', () => {
      expect(DEFAULT_WARMUP_CONFIG.autoStart).toBe(false)
    })
  })

  describe('waitUntilReady()', () => {
    it('returns true immediately when already ready', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)
      await warmup.startWarmup()

      const result = await warmup.waitUntilReady(1000)
      expect(result).toBe(true)
    })

    it('starts warmup and waits when cold', async () => {
      const bridge = createMockBridge()
      const warmup = new KataGoWarmup(bridge, MOCK_KATAGO_CONFIG)

      const result = await warmup.waitUntilReady(2000)
      expect(result).toBe(true)
      expect(warmup.isReady()).toBe(true)
    })
  })
})

// =============================================================================
// 3. RenderOptimization Tests
// =============================================================================

describe('RenderOptimization', () => {
  describe('shallowEqual()', () => {
    it('returns true for identical primitive values', () => {
      expect(shallowEqual(1, 1)).toBe(true)
      expect(shallowEqual('hello', 'hello')).toBe(true)
      expect(shallowEqual(null, null)).toBe(true)
    })

    it('returns false for different primitive values', () => {
      expect(shallowEqual(1, 2)).toBe(false)
      expect(shallowEqual('a', 'b')).toBe(false)
    })

    it('returns true for objects with same properties', () => {
      const a = { x: 1, y: 2 }
      const b = { x: 1, y: 2 }
      expect(shallowEqual(a, b)).toBe(true)
    })

    it('returns false for objects with different property values', () => {
      const a = { x: 1, y: 2 }
      const b = { x: 1, y: 3 }
      expect(shallowEqual(a, b)).toBe(false)
    })

    it('returns false for objects with different number of properties', () => {
      const a = { x: 1 }
      const b = { x: 1, y: 2 }
      expect(shallowEqual(a, b)).toBe(false)
    })

    it('returns true for same object reference', () => {
      const obj = { a: 1 }
      expect(shallowEqual(obj, obj)).toBe(true)
    })

    it('does not deep-compare nested objects', () => {
      const nested = { a: 1 }
      const a = { obj: nested }
      const b = { obj: { a: 1 } } // Same value, different reference
      // Shallow equality: obj !== obj (different reference), returns false
      expect(shallowEqual(a, b)).toBe(false)
    })

    it('returns true for same nested reference', () => {
      const nested = { a: 1 }
      const a = { obj: nested }
      const b = { obj: nested } // Same reference
      expect(shallowEqual(a, b)).toBe(true)
    })
  })

  describe('createMemoizedSelector()', () => {
    it('returns an object with selector and equality', () => {
      type State = { count: number }
      const ms = createMemoizedSelector((s: State) => s.count)
      expect(typeof ms.selector).toBe('function')
      expect(typeof ms.equality).toBe('function')
    })

    it('selector extracts correct slice', () => {
      type State = { a: number; b: string }
      const ms = createMemoizedSelector((s: State) => s.a)
      expect(ms.selector({ a: 42, b: 'hi' })).toBe(42)
    })

    it('default equality is shallowEqual', () => {
      type State = { board: { x: number } }
      const ms = createMemoizedSelector((s: State) => s.board)
      const obj = { x: 1 }
      expect(ms.equality(obj, obj)).toBe(true)
      expect(ms.equality({ x: 1 }, { x: 2 })).toBe(false)
    })

    it('accepts custom equality function', () => {
      type State = { count: number }
      const customEq = (a: number, b: number) => Math.abs(a - b) < 5
      const ms = createMemoizedSelector((s: State) => s.count, customEq)
      expect(ms.equality(10, 12)).toBe(true) // within 5
      expect(ms.equality(10, 20)).toBe(false) // beyond 5
    })
  })

  describe('diffBoardState()', () => {
    it('returns no changes for identical boards', () => {
      const board = new Uint8Array([0, 1, 2, 0, 1])
      const diff = diffBoardState(board, board)
      expect(diff.hasChanges).toBe(false)
      expect(diff.changes).toHaveLength(0)
    })

    it('detects a single stone placement', () => {
      const prev = new Uint8Array([0, 0, 0, 0])
      const next = new Uint8Array([0, 1, 0, 0])
      const diff = diffBoardState(prev, next)
      expect(diff.hasChanges).toBe(true)
      expect(diff.changes).toHaveLength(1)
      expect(diff.changes[0]!.index).toBe(1)
      expect(diff.changes[0]!.from).toBe(0)
      expect(diff.changes[0]!.to).toBe(1)
    })

    it('detects multiple changes (capture)', () => {
      const prev = new Uint8Array([1, 1, 0, 2])
      const next = new Uint8Array([0, 0, 1, 2]) // Two stones captured
      const diff = diffBoardState(prev, next)
      expect(diff.hasChanges).toBe(true)
      expect(diff.changes).toHaveLength(3) // Two captures + one placement
    })

    it('reports correct totalIntersections', () => {
      const board = new Uint8Array(81) // 9x9
      const diff = diffBoardState(board, board)
      expect(diff.totalIntersections).toBe(81)
    })

    it('handles empty board diff (all zeros)', () => {
      const prev = new Uint8Array(81)
      const next = new Uint8Array(81)
      const diff = diffBoardState(prev, next)
      expect(diff.hasChanges).toBe(false)
      expect(diff.changes).toHaveLength(0)
    })

    it('works with readonly number arrays', () => {
      const prev = [0, 0, 0] as const
      const next = [0, 1, 0] as const
      const diff = diffBoardState(prev, next)
      expect(diff.hasChanges).toBe(true)
      expect(diff.changes[0]!.index).toBe(1)
    })
  })

  describe('createEmptyBoardState()', () => {
    it('creates a Uint8Array of size*size', () => {
      const board = createEmptyBoardState(9)
      expect(board.length).toBe(81)
    })

    it('fills all cells with 0', () => {
      const board = createEmptyBoardState(9)
      expect(board.every((v) => v === 0)).toBe(true)
    })
  })

  describe('createThrottledCallback()', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('calls the function immediately on first invocation', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      throttled.call(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('throttles rapid calls', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      throttled.call()
      throttled.call()
      throttled.call()

      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('allows calls after throttle interval elapses', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      throttled.call()
      expect(fn).toHaveBeenCalledTimes(1)

      // Advance timer past the throttle interval
      vi.advanceTimersByTime(150)

      throttled.call()
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('passes arguments correctly', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      throttled.call(42, 'hello')
      expect(fn).toHaveBeenCalledWith(42, 'hello')
    })

    it('isThrottled returns false when outside window', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      expect(throttled.isThrottled()).toBe(false)
    })

    it('cancel resets the throttle', () => {
      const fn = vi.fn()
      const throttled = createThrottledCallback(fn, 100)

      throttled.call()
      throttled.cancel()

      // After cancel, next call should fire immediately
      throttled.call()
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('createBoardTracker()', () => {
    it('starts with an empty board', () => {
      const tracker = createBoardTracker(9)
      const current = tracker.getCurrent()
      expect(current.length).toBe(81)
      expect(current.every((v) => v === 0)).toBe(true)
    })

    it('returns diff on update', () => {
      const tracker = createBoardTracker(9)
      const newBoard = new Uint8Array(81)
      newBoard[40] = 1 // Place stone at center

      const diff = tracker.update(newBoard)
      expect(diff.hasChanges).toBe(true)
      expect(diff.changes[0]!.index).toBe(40)
    })

    it('accumulates state across updates', () => {
      const tracker = createBoardTracker(9)

      const board1 = new Uint8Array(81)
      board1[0] = 1
      tracker.update(board1)

      const board2 = new Uint8Array(81)
      board2[0] = 1
      board2[1] = 2 // New stone
      const diff = tracker.update(board2)

      // Only the new stone should be in the diff
      expect(diff.changes).toHaveLength(1)
      expect(diff.changes[0]!.index).toBe(1)
    })

    it('reset returns to empty board', () => {
      const tracker = createBoardTracker(9)
      const board = new Uint8Array(81)
      board[5] = 1
      tracker.update(board)

      tracker.reset()
      const current = tracker.getCurrent()
      expect(current.every((v) => v === 0)).toBe(true)
    })
  })

  describe('MOVE_LIST_VIRTUALIZATION', () => {
    it('has activationThreshold of 200', () => {
      expect(MOVE_LIST_VIRTUALIZATION.activationThreshold).toBe(200)
    })

    it('has positive itemHeightPx', () => {
      expect(MOVE_LIST_VIRTUALIZATION.itemHeightPx).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// 4. DbOptimization Tests
// =============================================================================

describe('DbOptimization', () => {
  describe('WalCheckpointTracker', () => {
    it('does not trigger checkpoint below threshold', async () => {
      const mockCheckpoint = vi.fn().mockResolvedValue(undefined)
      const tracker = createWalCheckpointTracker(mockCheckpoint, { writesPerCheckpoint: 5 })

      await tracker.recordWrite()
      await tracker.recordWrite()
      await tracker.recordWrite()

      expect(mockCheckpoint).not.toHaveBeenCalled()
      expect(tracker.getWriteCount()).toBe(3)
    })

    it('triggers checkpoint at threshold and resets counter', async () => {
      const mockCheckpoint = vi.fn().mockResolvedValue(undefined)
      const tracker = createWalCheckpointTracker(mockCheckpoint, { writesPerCheckpoint: 3 })

      await tracker.recordWrite()
      await tracker.recordWrite()
      const triggered = await tracker.recordWrite() // 3rd write triggers

      expect(triggered).toBe(true)
      expect(mockCheckpoint).toHaveBeenCalledTimes(1)
      expect(mockCheckpoint).toHaveBeenCalledWith('passive')
      expect(tracker.getWriteCount()).toBe(0)
    })

    it('triggers checkpoint with configured mode', async () => {
      const mockCheckpoint = vi.fn().mockResolvedValue(undefined)
      const tracker = createWalCheckpointTracker(mockCheckpoint, {
        writesPerCheckpoint: 1,
        mode: 'full',
      })

      await tracker.recordWrite()

      expect(mockCheckpoint).toHaveBeenCalledWith('full')
    })

    it('forceCheckpoint triggers immediately regardless of count', async () => {
      const mockCheckpoint = vi.fn().mockResolvedValue(undefined)
      const tracker = createWalCheckpointTracker(mockCheckpoint, { writesPerCheckpoint: 100 })

      await tracker.forceCheckpoint()

      expect(mockCheckpoint).toHaveBeenCalledTimes(1)
      expect(tracker.getWriteCount()).toBe(0)
    })

    it('resetCounter sets count to zero', async () => {
      const mockCheckpoint = vi.fn().mockResolvedValue(undefined)
      const tracker = createWalCheckpointTracker(mockCheckpoint, { writesPerCheckpoint: 10 })

      await tracker.recordWrite()
      await tracker.recordWrite()
      tracker.resetCounter()

      expect(tracker.getWriteCount()).toBe(0)
    })
  })

  describe('optimizeForBulkInsert()', () => {
    it('returns empty result for zero rows', async () => {
      const executeBatch = vi.fn().mockResolvedValue(undefined)
      const result = await optimizeForBulkInsert([], executeBatch)

      expect(result.insertedCount).toBe(0)
      expect(result.success).toBe(true)
      expect(executeBatch).not.toHaveBeenCalled()
    })

    it('calls executeBatch with all rows', async () => {
      const rows = [
        { id: '1', value: 'a' },
        { id: '2', value: 'b' },
      ]
      const executeBatch = vi.fn().mockResolvedValue(undefined)

      const result = await optimizeForBulkInsert(rows, executeBatch)

      expect(result.insertedCount).toBe(2)
      expect(result.success).toBe(true)
      expect(executeBatch).toHaveBeenCalledWith(rows)
    })

    it('returns error result when executeBatch throws', async () => {
      const rows = [{ id: '1' }]
      const executeBatch = vi.fn().mockRejectedValue(new Error('DB locked'))

      const result = await optimizeForBulkInsert(rows, executeBatch)

      expect(result.success).toBe(false)
      expect(result.insertedCount).toBe(0)
      expect(result.error).toContain('DB locked')
    })
  })

  describe('computeLruEviction()', () => {
    const makeEntry = (
      key: string,
      lastAccessedAt: number,
      sizeBytes = 100
    ): AnalysisCacheEntry => ({
      key,
      lastAccessedAt,
      sizeBytes,
    })

    it('returns no evictions when under maxEntries', () => {
      const entries = [makeEntry('a', 100), makeEntry('b', 200)]
      const result = computeLruEviction(entries, { maxEntries: 10, maxSizeBytes: 0 })

      expect(result.evictedCount).toBe(0)
      expect(result.remainingCount).toBe(2)
    })

    it('evicts oldest entries when over maxEntries', () => {
      const entries = [
        makeEntry('old', 1000), // oldest
        makeEntry('mid', 2000),
        makeEntry('new', 3000),
      ]
      const result = computeLruEviction(entries, { maxEntries: 2, maxSizeBytes: 0 })

      expect(result.evictedCount).toBe(1)
      expect(result.evictedKeys).toContain('old')
      expect(result.remainingCount).toBe(2)
    })

    it('evicts multiple oldest entries', () => {
      const entries = Array.from({ length: 5 }, (_, i) => makeEntry(`key${String(i)}`, i * 1000))
      const result = computeLruEviction(entries, { maxEntries: 2, maxSizeBytes: 0 })

      expect(result.evictedCount).toBe(3)
      expect(result.remainingCount).toBe(2)
      // The 3 oldest (keys 0,1,2) should be evicted
      expect(result.evictedKeys).toContain('key0')
      expect(result.evictedKeys).toContain('key1')
      expect(result.evictedKeys).toContain('key2')
    })

    it('enforces size budget when maxSizeBytes > 0', () => {
      const entries = [makeEntry('a', 100, 500), makeEntry('b', 200, 500), makeEntry('c', 300, 500)]
      // Total = 1500, budget = 1000, need to evict 1
      const result = computeLruEviction(entries, { maxEntries: 1000, maxSizeBytes: 1000 })

      expect(result.evictedCount).toBe(1)
      expect(result.evictedKeys).toContain('a') // Oldest evicted first
    })

    it('uses DEFAULT_LRU_EVICTION_CONFIG with maxEntries = 1000', () => {
      expect(DEFAULT_LRU_EVICTION_CONFIG.maxEntries).toBe(1000)
      expect(DEFAULT_LRU_EVICTION_CONFIG.maxSizeBytes).toBe(0)
    })

    it('does not evict when exactly at maxEntries', () => {
      const entries = [makeEntry('a', 1), makeEntry('b', 2)]
      const result = computeLruEviction(entries, { maxEntries: 2, maxSizeBytes: 0 })
      expect(result.evictedCount).toBe(0)
    })
  })

  describe('buildAnalysisCacheKey()', () => {
    it('builds consistent key from parameters', () => {
      const key = buildAnalysisCacheKey('abc123', 'chinese', 6.5, 50)
      expect(key).toBe('abc123:chinese:6.5:50')
    })

    it('converts bigint to hex string', () => {
      const key = buildAnalysisCacheKey(255n, 'tromp-taylor', 7.0, 100)
      expect(key).toBe('ff:tromp-taylor:7.0:100')
    })

    it('produces different keys for different parameters', () => {
      const key1 = buildAnalysisCacheKey('abc', 'chinese', 6.5, 50)
      const key2 = buildAnalysisCacheKey('abc', 'chinese', 6.5, 100)
      expect(key1).not.toBe(key2)
    })

    it('formats komi to 1 decimal place', () => {
      const key = buildAnalysisCacheKey('hash', 'chinese', 7, 50)
      expect(key).toContain('7.0')
    })
  })

  describe('shouldCacheAnalysis()', () => {
    it('returns true for visits >= minVisitsForCache', () => {
      expect(shouldCacheAnalysis(10)).toBe(true)
      expect(shouldCacheAnalysis(100)).toBe(true)
    })

    it('returns false for visits below minVisitsForCache', () => {
      expect(shouldCacheAnalysis(5)).toBe(false)
      expect(shouldCacheAnalysis(1)).toBe(false)
    })

    it('uses custom minVisitsForCache', () => {
      expect(shouldCacheAnalysis(50, 100)).toBe(false)
      expect(shouldCacheAnalysis(100, 100)).toBe(true)
    })
  })

  describe('SQLITE_CONNECTION_RECOMMENDATIONS', () => {
    it('recommends single read-write connection', () => {
      expect(SQLITE_CONNECTION_RECOMMENDATIONS.readWriteConnections).toBe(1)
    })

    it('has positive busy timeout', () => {
      expect(SQLITE_CONNECTION_RECOMMENDATIONS.busyTimeoutMs).toBeGreaterThan(0)
    })

    it('has positive statement cache size', () => {
      expect(SQLITE_CONNECTION_RECOMMENDATIONS.statementCacheSize).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// 5. BundleConfig Tests
// =============================================================================

describe('BundleConfig', () => {
  describe('CHUNK_BUDGETS', () => {
    it('contains entries for all 5 chunk groups', () => {
      const groups = CHUNK_BUDGETS.map((b) => b.group)
      expect(groups).toContain('core')
      expect(groups).toContain('board-ui')
      expect(groups).toContain('katago')
      expect(groups).toContain('explanation')
      expect(groups).toContain('analytics')
    })

    it('all chunks have maxKb > expectedKb (headroom built in)', () => {
      for (const budget of CHUNK_BUDGETS) {
        expect(budget.maxKb).toBeGreaterThanOrEqual(budget.expectedKb)
      }
    })

    it('all chunks have positive maxKb', () => {
      for (const budget of CHUNK_BUDGETS) {
        expect(budget.maxKb).toBeGreaterThan(0)
      }
    })
  })

  describe('BUNDLE_BUDGET', () => {
    it('total budget is 100MB = 102400 KB', () => {
      expect(BUNDLE_BUDGET.maxTotalKb).toBe(102_400)
    })

    it('KataGo binary budget is ~50MB', () => {
      expect(BUNDLE_BUDGET.kataGoBinaryKb).toBe(51_200)
    })

    it('KataGo model budget is ~30MB', () => {
      expect(BUNDLE_BUDGET.kataGoModelKb).toBe(30_720)
    })

    it('JS bundle + binary + model fits within total budget', () => {
      const total =
        BUNDLE_BUDGET.maxJsBundleKb + BUNDLE_BUDGET.kataGoBinaryKb + BUNDLE_BUDGET.kataGoModelKb
      expect(total).toBeLessThanOrEqual(BUNDLE_BUDGET.maxTotalKb)
    })
  })

  describe('validateChunkBudgets()', () => {
    it('passes when all chunks are within budget', () => {
      const actualSizes = {
        core: 50,
        'board-ui': 60,
        katago: 40,
        explanation: 15,
        analytics: 55,
      }
      const results = validateChunkBudgets(actualSizes)
      expect(allChunkBudgetsPassing(results)).toBe(true)
    })

    it('fails when a chunk exceeds its budget', () => {
      const actualSizes = {
        core: 9999, // Way over budget
        'board-ui': 60,
        katago: 40,
        explanation: 15,
        analytics: 55,
      }
      const results = validateChunkBudgets(actualSizes)
      expect(allChunkBudgetsPassing(results)).toBe(false)
    })

    it('reports overageKb for failing chunks', () => {
      const coreMaxKb = CHUNK_BUDGETS.find((b) => b.group === 'core')!.maxKb
      const actualSizes = { core: coreMaxKb + 50 }
      const results = validateChunkBudgets(actualSizes)
      const coreResult = results.find((r) => r.group === 'core')!
      expect(coreResult.overageKb).toBe(50)
      expect(coreResult.passes).toBe(false)
    })

    it('treats missing chunk size as 0 (passes)', () => {
      const results = validateChunkBudgets({})
      // All chunks report 0 KB actual size → all pass
      expect(allChunkBudgetsPassing(results)).toBe(true)
    })
  })

  describe('createManualChunks()', () => {
    it('returns a function', () => {
      const fn = createManualChunks()
      expect(typeof fn).toBe('function')
    })

    it('assigns katago-bridge modules to chunk-katago', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/katago-bridge/katago-service.ts')
      expect(result).toBe('chunk-katago')
    })

    it('assigns explanation-engine modules to chunk-explanation', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/explanation-engine/index.ts')
      expect(result).toBe('chunk-explanation')
    })

    it('assigns analytics modules to chunk-analytics', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/analytics/posthog.ts')
      expect(result).toBe('chunk-analytics')
    })

    it('assigns board-ui modules to chunk-board-ui', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/board-ui/BoardCanvas.tsx')
      expect(result).toBe('chunk-board-ui')
    })

    it('assigns rules-engine modules to chunk-core', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/rules-engine/rules.ts')
      expect(result).toBe('chunk-core')
    })

    it('assigns game-engine modules to chunk-core', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/game-engine/store.ts')
      expect(result).toBe('chunk-core')
    })

    it('assigns react node_modules to vendor-react', () => {
      const fn = createManualChunks()
      const result = fn('/project/node_modules/react/index.js')
      expect(result).toBe('vendor-react')
    })

    it('assigns zustand to vendor-zustand', () => {
      const fn = createManualChunks()
      const result = fn('/project/node_modules/zustand/index.js')
      expect(result).toBe('vendor-zustand')
    })

    it('returns undefined for unmatched modules', () => {
      const fn = createManualChunks()
      const result = fn('/project/src/App.tsx')
      expect(result).toBeUndefined()
    })

    it('handles Windows-style backslash paths', () => {
      const fn = createManualChunks()
      const result = fn('C:\\project\\src\\katago-bridge\\katago-service.ts')
      expect(result).toBe('chunk-katago')
    })
  })

  describe('getChunkGroupForModule()', () => {
    it('returns katago group for katago-bridge path', () => {
      expect(getChunkGroupForModule('src/katago-bridge/foo')).toBe('katago')
    })

    it('returns explanation group for explanation-engine path', () => {
      expect(getChunkGroupForModule('src/explanation-engine/foo')).toBe('explanation')
    })

    it('returns undefined for unknown path', () => {
      expect(getChunkGroupForModule('src/unknown/foo')).toBeUndefined()
    })

    it('returns core group for rules-engine path', () => {
      expect(getChunkGroupForModule('src/rules-engine/rules.ts')).toBe('core')
    })
  })
})
