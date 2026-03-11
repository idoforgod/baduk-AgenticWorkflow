// =============================================================================
// features/optimization/KataGoWarmup.ts — KataGo background startup state machine
// =============================================================================
// Implements the "background initialization" strategy:
// - Start KataGo warmup on app launch, not on game start.
// - Pre-warms with a minimal board query (boardsize 9 + clear_board equivalent).
// - Health check with 5s timeout.
// - Readiness state machine: cold -> warming -> ready | error.
// - Fallback: if not ready by game start, show loading indicator.
//
// Design:
// - KataGoWarmup wraps IKatagoBridge via DI (no direct service imports).
// - State machine is fully testable without real KataGo process.
// - All async operations have explicit timeout handling.
// =============================================================================

import type { AnalysisQuery, IKatagoBridge, KataGoConfig } from '@core/interfaces'
import type { WarmupConfig, WarmupState, WarmupStatus } from './types'
import { DEFAULT_WARMUP_CONFIG } from './types'

// ---------------------------------------------------------------------------
// State Change Listener
// ---------------------------------------------------------------------------

/** Callback invoked on every state transition */
export type WarmupStateListener = (status: WarmupStatus) => void

// ---------------------------------------------------------------------------
// KataGo Warmup State Machine
// ---------------------------------------------------------------------------

/**
 * Manages the KataGo background startup lifecycle.
 *
 * State machine:
 *   cold ──startWarmup()──> warming ──success──> ready
 *                                   └──failure──> error
 *   error ──startWarmup()──> warming (retry allowed)
 *   ready ──reset()──> cold
 *
 * Usage:
 *   const warmup = new KataGoWarmup(bridge, kataGoConfig)
 *   await warmup.startWarmup()   // background — call on app launch
 *   if (!warmup.isReady()) {
 *     // show loading indicator in game UI
 *   }
 */
export class KataGoWarmup {
  private state: WarmupState = 'cold'
  private warmupStartedAt: number | null = null
  private warmupCompletedAt: number | null = null
  private errorMessage: string | null = null
  private attemptCount = 0
  private readonly listeners: WarmupStateListener[] = []

  private readonly bridge: IKatagoBridge
  private readonly kataGoConfig: KataGoConfig
  private readonly config: WarmupConfig

  constructor(bridge: IKatagoBridge, kataGoConfig: KataGoConfig, config?: Partial<WarmupConfig>) {
    this.bridge = bridge
    this.kataGoConfig = kataGoConfig
    this.config = { ...DEFAULT_WARMUP_CONFIG, ...config }

    if (this.config.autoStart) {
      // Fire and forget — errors handled internally
      void this.startWarmup()
    }
  }

  // -------------------------------------------------------------------------
  // State Accessors
  // -------------------------------------------------------------------------

  /** Returns true if KataGo is ready to accept analysis queries. */
  isReady(): boolean {
    return this.state === 'ready'
  }

  /** Returns the current state machine state. */
  getState(): WarmupState {
    return this.state
  }

  /** Returns the full warmup status snapshot. */
  getStatus(): WarmupStatus {
    return {
      state: this.state,
      warmupStartedAt: this.warmupStartedAt,
      warmupCompletedAt: this.warmupCompletedAt,
      errorMessage: this.errorMessage,
      attemptCount: this.attemptCount,
    }
  }

  // -------------------------------------------------------------------------
  // State Subscriptions
  // -------------------------------------------------------------------------

  /**
   * Subscribe to state transitions.
   * @param listener - Called on every state change.
   * @returns Unsubscribe function.
   */
  onStateChange(listener: WarmupStateListener): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Warmup Operations
  // -------------------------------------------------------------------------

  /**
   * Start the warmup sequence.
   * Safe to call from any state (including 'ready' — will be a no-op).
   * From 'error', triggers a retry attempt.
   *
   * @returns true if warmup completed successfully, false if it failed.
   */
  async startWarmup(): Promise<boolean> {
    // Ready: no-op
    if (this.state === 'ready') return true

    // Already warming: do not double-start
    if (this.state === 'warming') return false

    this.transition('warming')
    this.warmupStartedAt = Date.now()
    this.attemptCount += 1

    try {
      // Step 1: Initialize the KataGo bridge (spawns the process)
      const initResult = await this.withTimeout(
        this.bridge.initialize(this.kataGoConfig),
        this.config.healthCheckTimeoutMs,
        'KataGo initialization timed out'
      )

      if (!initResult.ok) {
        this.transitionError(`Initialization failed: ${initResult.error.message}`)
        return false
      }

      // Step 2: Health check — send a minimal analysis query as warmup ping
      const healthResult = await this.withTimeout(
        this.runHealthCheck(),
        this.config.healthCheckTimeoutMs,
        'Health check timed out after 5s'
      )

      if (!healthResult) {
        this.transitionError('Health check failed — KataGo did not respond')
        return false
      }

      this.warmupCompletedAt = Date.now()
      this.errorMessage = null
      this.transition('ready')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.transitionError(message)
      return false
    }
  }

  /**
   * Reset the warmup to cold state.
   * Useful when the underlying bridge is reset/recreated.
   */
  reset(): void {
    this.state = 'cold'
    this.warmupStartedAt = null
    this.warmupCompletedAt = null
    this.errorMessage = null
    this.attemptCount = 0
    this.notifyListeners()
  }

  /**
   * Wait until KataGo is ready, or fail after the given timeout.
   * Useful at game start: `await warmup.waitUntilReady(3000)`.
   *
   * @param timeoutMs - Maximum wait time in milliseconds.
   * @returns true if ready within timeout, false if timed out.
   */
  async waitUntilReady(timeoutMs: number): Promise<boolean> {
    if (this.state === 'ready') return true

    // If cold or error, trigger warmup
    if (this.state === 'cold' || this.state === 'error') {
      const result = await this.withTimeout(
        this.startWarmup(),
        timeoutMs,
        'Warmup timed out waiting for ready state'
      )
      return result === true
    }

    // If warming, poll until ready or timeout
    if (this.state === 'warming') {
      const deadline = Date.now() + timeoutMs
      return new Promise((resolve) => {
        const unsubscribe = this.onStateChange((status) => {
          if (status.state === 'ready') {
            unsubscribe()
            resolve(true)
          } else if (status.state === 'error') {
            unsubscribe()
            resolve(false)
          } else if (Date.now() >= deadline) {
            unsubscribe()
            resolve(false)
          }
        })

        // Safety: check deadline even if no state change arrives
        setTimeout(() => {
          unsubscribe()
          resolve(this.state === 'ready')
        }, timeoutMs)
      })
    }

    return false
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Run a minimal health-check analysis query on an empty 9x9 board.
   * This pre-warms KataGo's internal state (loads model into VRAM, etc.).
   */
  private async runHealthCheck(): Promise<boolean> {
    const warmupQuery: AnalysisQuery = {
      id: '__warmup_health_check__',
      moves: [],
      rules: 'chinese',
      boardXSize: 9,
      boardYSize: 9,
      komi: 6.5,
      maxVisits: 1, // Minimal visits — just checking responsiveness
    }

    const result = await this.bridge.analyze(warmupQuery)
    return result.ok
  }

  /**
   * Wrap a promise with a timeout.
   * If the promise does not resolve before `timeoutMs`, rejects with `message`.
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), timeoutMs)

      promise.then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timer)
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      )
    })
  }

  private transition(newState: WarmupState): void {
    this.state = newState
    this.notifyListeners()
  }

  private transitionError(message: string): void {
    this.errorMessage = message
    this.transition('error')
  }

  private notifyListeners(): void {
    const status = this.getStatus()
    for (const listener of this.listeners) {
      listener(status)
    }
  }
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Create a KataGoWarmup instance with DI.
 *
 * @param bridge - IKatagoBridge implementation.
 * @param kataGoConfig - KataGo binary/model/config paths.
 * @param config - Optional warmup configuration overrides.
 */
export function createKataGoWarmup(
  bridge: IKatagoBridge,
  kataGoConfig: KataGoConfig,
  config?: Partial<WarmupConfig>
): KataGoWarmup {
  return new KataGoWarmup(bridge, kataGoConfig, config)
}
