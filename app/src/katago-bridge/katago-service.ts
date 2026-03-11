// =============================================================================
// katago-bridge/katago-service.ts — Main KataGo Bridge Service
// =============================================================================
// Implements the IKatagoBridge interface from core/interfaces.ts.
//
// Architecture:
// - TypeScript side manages high-level state (circuit breaker, difficulty,
//   visits tiers, request queue) and builds/parses JSON.
// - Rust side (via Tauri invoke) handles process lifecycle, stdin/stdout IPC,
//   stderr monitoring, and watchdog.
//
// All heavy I/O goes through Tauri invoke calls:
//   katago_initialize  -> spawn sidecar
//   katago_shutdown     -> graceful shutdown
//   katago_analyze      -> send query, receive response
//   katago_cancel       -> terminate specific query
//   katago_cancel_all   -> terminate all queries
//   katago_get_status   -> check process status
//   katago_detect_backend -> detect GPU backend
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
  KataGoStatusState,
  VersionInfo,
  VisitsTierConfig,
} from '../core/interfaces'
import { Err, Ok, type Result } from '../core/interfaces'
import { getDifficultyConfig } from './difficulty'
import { clearBackendCache, detectBackend } from './gpu-detection'
import { buildTauriAnalysisQuery, validateAnalysisQuery } from './query-builder'
import { makeKataGoError, parseAnalysisResponse } from './response-parser'
import type {
  CircuitBreakerConfig,
  DifficultyConfig,
  TauriAnalysisResponse,
  TauriBackendInfo,
  TauriKataGoConfig,
  TauriVersionInfo,
} from './types'
import { DEFAULT_CIRCUIT_BREAKER_CONFIG } from './types'
import { calibrateTiersFromVPS, getHangTimeout, getVisitsTiers, setVisitsTiers } from './visits'

// ---------------------------------------------------------------------------
// Tauri Invoke Adapter
// ---------------------------------------------------------------------------

/**
 * Adapter type for the Tauri invoke function.
 * Extracted as a type to allow dependency injection in tests.
 */
export type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

/**
 * Default invoke implementation — imports from @tauri-apps/api/core.
 * This is lazy-loaded to avoid import errors in test environments.
 */
let invokeImpl: InvokeFn | null = null

async function getInvoke(): Promise<InvokeFn> {
  if (invokeImpl !== null) return invokeImpl
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    invokeImpl = invoke as InvokeFn
    return invokeImpl
  } catch {
    throw new Error('Tauri API not available. Are you running inside a Tauri application?')
  }
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

class CircuitBreaker {
  private failures: number[] = []
  private consecutiveFailures = 0
  private readonly config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_BREAKER_CONFIG) {
    this.config = config
  }

  recordFailure(): void {
    const now = Date.now()
    this.failures.push(now)
    this.consecutiveFailures += 1
    // Prune old failures outside the window
    this.failures = this.failures.filter((t) => now - t < this.config.windowMs)
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0
  }

  isOpen(): boolean {
    // Prune stale failures before checking
    const now = Date.now()
    this.failures = this.failures.filter((t) => now - t < this.config.windowMs)
    return this.failures.length >= this.config.maxFailures
  }

  getBackoffDelay(): number {
    if (this.consecutiveFailures === 0) return this.config.backoffBaseMs
    const delay =
      this.config.backoffBaseMs * this.config.backoffMultiplier ** (this.consecutiveFailures - 1)
    return Math.min(delay, this.config.backoffMaxMs)
  }

  getState(): CircuitBreakerState {
    const isOpenNow = this.isOpen()
    const lastFailure = this.failures.length > 0 ? this.failures[this.failures.length - 1]! : null

    if (isOpenNow) {
      return {
        state: 'open',
        failureCount: this.consecutiveFailures,
        lastFailure,
        nextRetry: null, // No automatic retry when open
      }
    }

    if (this.consecutiveFailures > 0 && !isOpenNow) {
      return {
        state: 'half-open',
        failureCount: this.consecutiveFailures,
        lastFailure,
        nextRetry: lastFailure !== null ? lastFailure + this.getBackoffDelay() : null,
      }
    }

    return {
      state: 'closed',
      failureCount: 0,
      lastFailure: null,
      nextRetry: null,
    }
  }

  reset(): void {
    this.failures = []
    this.consecutiveFailures = 0
  }
}

// ---------------------------------------------------------------------------
// KataGo Service Implementation
// ---------------------------------------------------------------------------

/**
 * Main KataGo bridge service implementing IKatagoBridge.
 *
 * Usage:
 *   const bridge = createKatagoBridge()
 *   await bridge.initialize(config)
 *   const result = await bridge.analyze(query)
 *   await bridge.shutdown()
 */
export class KataGoService implements IKatagoBridge {
  private status: KataGoStatus = {
    state: 'idle',
    message: 'KataGo not started',
    pendingQueries: 0,
    uptimeSeconds: 0,
  }

  private startTime: number | null = null
  private pendingQueries = new Map<
    string,
    { resolve: (v: unknown) => void; timer: ReturnType<typeof setTimeout> }
  >()
  private circuitBreaker = new CircuitBreaker()
  private currentDifficulty: DifficultyConfig | null = null
  private invoke: InvokeFn

  constructor(invoke?: InvokeFn) {
    this.invoke =
      invoke ??
      (async (...args: Parameters<InvokeFn>) => {
        const fn = await getInvoke()
        return fn(...args)
      })
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Lifecycle
  // -------------------------------------------------------------------------

  async initialize(config: KataGoConfig): Promise<Result<VersionInfo, KataGoError>> {
    if (this.status.state !== 'idle' && this.status.state !== 'failed') {
      return Err(
        makeKataGoError(
          'STARTUP_FAILED',
          `Cannot initialize: KataGo is in state "${this.status.state}"`
        )
      )
    }

    this.setStatus('starting', 'Spawning KataGo process...')

    try {
      const tauriConfig: TauriKataGoConfig = {
        configPath: config.configPath,
        modelPath: config.modelPath,
      }

      const result = await this.invoke<TauriVersionInfo>('katago_initialize', {
        config: tauriConfig,
      })

      this.startTime = Date.now()
      this.circuitBreaker.reset()
      this.setStatus('ready', `KataGo ${result.version} ready`)

      return Ok({
        version: result.version,
        gitHash: result.gitHash ?? '',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setStatus('failed', `Startup failed: ${message}`)
      this.circuitBreaker.recordFailure()

      if (message.includes('sidecar not found') || message.includes('not found')) {
        return Err(makeKataGoError('BINARY_NOT_FOUND', message))
      }
      if (message.includes('model')) {
        return Err(makeKataGoError('MODEL_NOT_FOUND', message))
      }
      if (message.includes('timeout')) {
        return Err(makeKataGoError('STARTUP_TIMEOUT', message))
      }
      return Err(makeKataGoError('STARTUP_FAILED', message))
    }
  }

  async shutdown(): Promise<Result<void, KataGoError>> {
    if (this.status.state === 'idle') {
      return Ok(undefined)
    }

    this.setStatus('idle', 'Shutting down...')

    // Cancel all pending queries
    for (const [id, pending] of this.pendingQueries) {
      clearTimeout(pending.timer)
      this.pendingQueries.delete(id)
    }

    try {
      await this.invoke<void>('katago_shutdown')
      this.startTime = null
      this.setStatus('idle', 'KataGo stopped')
      return Ok(undefined)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setStatus('idle', `Shutdown error: ${message}`)
      this.startTime = null
      return Err(makeKataGoError('SHUTDOWN_ERROR', message))
    }
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Status
  // -------------------------------------------------------------------------

  getStatus(): KataGoStatus {
    return {
      ...this.status,
      pendingQueries: this.pendingQueries.size,
      uptimeSeconds: this.startTime !== null ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    }
  }

  isHealthy(): boolean {
    const state = this.status.state
    return state === 'ready' || state === 'analyzing'
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return this.circuitBreaker.getState()
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Analysis
  // -------------------------------------------------------------------------

  async analyze(query: AnalysisQuery): Promise<Result<AnalysisResponse, KataGoError>> {
    // Pre-flight checks
    if (!this.isHealthy()) {
      if (this.circuitBreaker.isOpen()) {
        return Err(
          makeKataGoError(
            'CIRCUIT_BREAKER_OPEN',
            'KataGo circuit breaker is open — too many recent failures'
          )
        )
      }
      return Err(
        makeKataGoError('ANALYSIS_ERROR', `KataGo not ready (state: ${this.status.state})`)
      )
    }

    // Validate query
    const validationError = validateAnalysisQuery(query)
    if (validationError !== null) {
      return Err(makeKataGoError('INVALID_QUERY', validationError))
    }

    // Build Tauri command payload with difficulty settings
    const tauriQuery = buildTauriAnalysisQuery(query, this.currentDifficulty ?? undefined)

    // Calculate timeout based on visits
    const maxVisits = tauriQuery.maxVisits ?? 500
    const timeout = getHangTimeout(maxVisits)

    this.setStatus('analyzing', `Analyzing query ${query.id}`)

    try {
      const result = await Promise.race([
        this.invoke<TauriAnalysisResponse>('katago_analyze', { query: tauriQuery }),
        this.createTimeout(query.id, timeout),
      ])

      // Clear timeout tracker
      this.clearPendingQuery(query.id)

      // Check for no-result (terminated query)
      if (result.noResults === true) {
        this.setStatus('ready', 'Analysis cancelled')
        return Err(makeKataGoError('ANALYSIS_ERROR', `Query ${query.id} returned no results`))
      }

      // Parse the response
      const parseResult = parseAnalysisResponse(result as Record<string, unknown>)
      if (!parseResult.ok) {
        this.circuitBreaker.recordFailure()
        return parseResult
      }

      this.circuitBreaker.recordSuccess()
      this.setStatus('ready', 'Analysis complete')
      return parseResult
    } catch (error) {
      this.clearPendingQuery(query.id)
      const message = error instanceof Error ? error.message : String(error)
      this.circuitBreaker.recordFailure()

      if (message.includes('timeout') || message.includes('Timeout')) {
        this.setStatus('degraded', `Analysis timeout: ${message}`)
        return Err(makeKataGoError('ANALYSIS_TIMEOUT', message))
      }

      if (message.includes('not initialized') || message.includes('crashed')) {
        this.setStatus('failed', `Process error: ${message}`)
        return Err(makeKataGoError('PROCESS_CRASHED', message))
      }

      this.setStatus('ready', `Analysis error: ${message}`)
      return Err(makeKataGoError('ANALYSIS_ERROR', message))
    }
  }

  async analyzeMultiple(
    queries: readonly AnalysisQuery[]
  ): Promise<Result<readonly AnalysisResponse[], KataGoError>> {
    const results: AnalysisResponse[] = []

    for (const query of queries) {
      const result = await this.analyze(query)
      if (!result.ok) {
        return result as Result<never, KataGoError>
      }
      results.push(result.value)
    }

    return Ok(results)
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Cancel
  // -------------------------------------------------------------------------

  async cancelAnalysis(queryId: string): Promise<Result<void, KataGoError>> {
    this.clearPendingQuery(queryId)

    try {
      await this.invoke<void>('katago_cancel', { queryId })
      return Ok(undefined)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Err(makeKataGoError('ANALYSIS_ERROR', `Cancel failed: ${message}`))
    }
  }

  async cancelAll(): Promise<Result<void, KataGoError>> {
    // Clear all pending query timeouts
    for (const [id, pending] of this.pendingQueries) {
      clearTimeout(pending.timer)
      this.pendingQueries.delete(id)
    }

    try {
      await this.invoke<void>('katago_cancel_all')
      this.setStatus('ready', 'All queries cancelled')
      return Ok(undefined)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Err(makeKataGoError('ANALYSIS_ERROR', `Cancel all failed: ${message}`))
    }
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Visits Tiers
  // -------------------------------------------------------------------------

  getVisitsTiers(): VisitsTierConfig {
    return getVisitsTiers()
  }

  async calibrateVisitsTiers(): Promise<Result<VisitsTierConfig, KataGoError>> {
    if (!this.isHealthy()) {
      return Err(makeKataGoError('ANALYSIS_ERROR', 'KataGo must be in Ready state to calibrate'))
    }

    try {
      // Send a benchmark query: empty board, 100 visits
      const startTime = Date.now()
      const benchQuery: AnalysisQuery = {
        id: '__calibrate__',
        moves: [],
        rules: 'chinese',
        komi: 7.5,
        boardXSize: 19,
        boardYSize: 19,
        maxVisits: 100,
      }

      const result = await this.analyze(benchQuery)
      if (!result.ok) {
        return Err(result.error)
      }

      const elapsed = (Date.now() - startTime) / 1000 // seconds
      const visitsPerSecond = elapsed > 0 ? 100 / elapsed : 100

      const tiers = calibrateTiersFromVPS(visitsPerSecond)
      return Ok(tiers)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Err(makeKataGoError('ANALYSIS_ERROR', `Calibration failed: ${message}`))
    }
  }

  // -------------------------------------------------------------------------
  // IKatagoBridge: Backend Detection
  // -------------------------------------------------------------------------

  async getBackendInfo(): Promise<Result<BackendInfo, KataGoError>> {
    try {
      const invoker = (cmd: string) => this.invoke<TauriBackendInfo>(cmd)
      const info = await detectBackend(invoker)
      return Ok(info)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return Err(makeKataGoError('STARTUP_FAILED', `Backend detection failed: ${message}`))
    }
  }

  // -------------------------------------------------------------------------
  // Extended API (not in IKatagoBridge — for internal use by game-engine)
  // -------------------------------------------------------------------------

  /**
   * Set the AI difficulty level (1-30).
   * Affects all subsequent analyze() calls.
   */
  setDifficulty(level: number): void {
    this.currentDifficulty = getDifficultyConfig(level)
  }

  /**
   * Clear the difficulty setting (use default KataGo strength).
   */
  clearDifficulty(): void {
    this.currentDifficulty = null
  }

  /**
   * Get the current difficulty config.
   */
  getDifficulty(): DifficultyConfig | null {
    return this.currentDifficulty
  }

  /**
   * Manually set visits tiers (e.g., from saved settings).
   */
  setVisitsTiers(tiers: VisitsTierConfig): void {
    setVisitsTiers(tiers)
  }

  /**
   * Reset the service state (for testing or error recovery).
   */
  reset(): void {
    this.status = { state: 'idle', message: 'Reset', pendingQueries: 0, uptimeSeconds: 0 }
    this.startTime = null
    this.currentDifficulty = null
    this.circuitBreaker.reset()
    clearBackendCache()
    for (const [, pending] of this.pendingQueries) {
      clearTimeout(pending.timer)
    }
    this.pendingQueries.clear()
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private setStatus(state: KataGoStatusState, message: string): void {
    this.status = {
      state,
      message,
      pendingQueries: this.pendingQueries.size,
      uptimeSeconds: this.startTime !== null ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
    }
  }

  private createTimeout(queryId: string, timeoutMs: number): Promise<TauriAnalysisResponse> {
    return new Promise((_resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingQueries.delete(queryId)
        reject(new Error(`Analysis timeout after ${String(timeoutMs)}ms for query ${queryId}`))
      }, timeoutMs)

      this.pendingQueries.set(queryId, {
        resolve: _resolve as (v: unknown) => void,
        timer,
      })
    })
  }

  private clearPendingQuery(queryId: string): void {
    const pending = this.pendingQueries.get(queryId)
    if (pending !== undefined) {
      clearTimeout(pending.timer)
      this.pendingQueries.delete(queryId)
    }
  }
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Create a new KataGo bridge service instance.
 *
 * @param invoke - Optional Tauri invoke function (for testing)
 * @returns New KataGoService instance implementing IKatagoBridge
 */
export function createKatagoBridge(invoke?: InvokeFn): KataGoService {
  return new KataGoService(invoke)
}
