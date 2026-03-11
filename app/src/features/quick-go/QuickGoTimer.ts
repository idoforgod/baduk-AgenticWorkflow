// =============================================================================
// features/quick-go/QuickGoTimer.ts — Timer Management
// =============================================================================
// Manages countdown timer with main time + byoyomi for Quick Go games.
// Pure state machine — no setInterval/requestAnimationFrame internally.
// The tick() method is called externally by the game loop.
//
// Timer flow:
// 1. Main time counts down from configured value (default 180s = 3 min)
// 2. When main time reaches 0, enter byoyomi
// 3. Each byoyomi period resets to the period time when a move is played
// 4. If a byoyomi period expires, consume one period
// 5. When all periods are consumed, time-out (game over)
// =============================================================================

import type { Player, TimeControl } from '@core/interfaces'
import type { QuickGoPlayerTimer, QuickGoTimerState } from './types'

// ---------------------------------------------------------------------------
// Timer Factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh player timer from time control settings.
 */
export function createPlayerTimer(timeControl: TimeControl): QuickGoPlayerTimer {
  return {
    mainTimeMs: timeControl.mainTime * 1000,
    byoyomiPeriodsRemaining: timeControl.byoyomiPeriods,
    byoyomiTimeMs: timeControl.byoyomiTime * 1000,
    inByoyomi: false,
    timedOut: false,
  }
}

/**
 * Create a fresh timer state for both players.
 */
export function createTimerState(timeControl: TimeControl): QuickGoTimerState {
  return {
    black: createPlayerTimer(timeControl),
    white: createPlayerTimer(timeControl),
    activePlayer: null,
    isPaused: true,
    lastTickTime: null,
  }
}

// ---------------------------------------------------------------------------
// Timer Operations
// ---------------------------------------------------------------------------

/**
 * Start the timer for a specific player.
 */
export function startTimer(
  state: QuickGoTimerState,
  player: Player,
  now: number
): QuickGoTimerState {
  return {
    ...state,
    activePlayer: player,
    isPaused: false,
    lastTickTime: now,
  }
}

/**
 * Pause the timer (e.g., during AI thinking on the AI's clock).
 */
export function pauseTimer(state: QuickGoTimerState): QuickGoTimerState {
  return {
    ...state,
    isPaused: true,
    lastTickTime: null,
  }
}

/**
 * Switch the timer to the other player (after a move is played).
 * Also resets byoyomi time if the player who just moved was in byoyomi.
 */
export function switchTimer(
  state: QuickGoTimerState,
  timeControl: TimeControl,
  now: number
): QuickGoTimerState {
  const currentPlayer = state.activePlayer
  if (currentPlayer === null) return state

  const nextPlayer: Player = currentPlayer === 'B' ? 'W' : 'B'

  // Reset byoyomi period for the player who just moved
  const currentTimer = currentPlayer === 'B' ? state.black : state.white
  let updatedCurrentTimer = { ...currentTimer }

  if (updatedCurrentTimer.inByoyomi) {
    // Reset the byoyomi period time for the player who completed their move
    updatedCurrentTimer = {
      ...updatedCurrentTimer,
      byoyomiTimeMs: timeControl.byoyomiTime * 1000,
    }
  }

  return {
    black: currentPlayer === 'B' ? updatedCurrentTimer : state.black,
    white: currentPlayer === 'W' ? updatedCurrentTimer : state.white,
    activePlayer: nextPlayer,
    isPaused: false,
    lastTickTime: now,
  }
}

/**
 * Tick the timer. Called every frame (or at regular intervals).
 * Returns the updated state and whether a timeout occurred.
 */
export function tickTimer(
  state: QuickGoTimerState,
  now: number
): { state: QuickGoTimerState; timedOut: Player | null } {
  // Do nothing if paused or no active player
  if (state.isPaused || state.activePlayer === null || state.lastTickTime === null) {
    return { state, timedOut: null }
  }

  const elapsed = now - state.lastTickTime
  if (elapsed <= 0) {
    return { state, timedOut: null }
  }

  const activePlayer = state.activePlayer
  const timer = activePlayer === 'B' ? { ...state.black } : { ...state.white }

  let remaining = elapsed
  let timedOut: Player | null = null

  if (!timer.inByoyomi) {
    // Subtract from main time
    timer.mainTimeMs -= remaining
    if (timer.mainTimeMs <= 0) {
      remaining = -timer.mainTimeMs
      timer.mainTimeMs = 0
      timer.inByoyomi = true
      // Fall through to byoyomi processing with the remaining time
    } else {
      remaining = 0
    }
  }

  if (timer.inByoyomi && remaining > 0) {
    // Subtract from byoyomi period
    timer.byoyomiTimeMs -= remaining
    if (timer.byoyomiTimeMs <= 0) {
      // Period expired
      timer.byoyomiPeriodsRemaining -= 1
      if (timer.byoyomiPeriodsRemaining <= 0) {
        // All periods consumed — time out
        timer.byoyomiPeriodsRemaining = 0
        timer.byoyomiTimeMs = 0
        timer.timedOut = true
        timedOut = activePlayer
      } else {
        // Still have periods — this should not normally happen during a single
        // tick because byoyomi periods are 10+ seconds and ticks are < 1 second.
        // But handle it defensively by starting the next period.
        timer.byoyomiTimeMs = 0 // Will be reset on next move
        timer.timedOut = true
        timedOut = activePlayer
      }
    }
  }

  const newState: QuickGoTimerState = {
    ...state,
    black: activePlayer === 'B' ? timer : state.black,
    white: activePlayer === 'W' ? timer : state.white,
    lastTickTime: now,
  }

  return { state: newState, timedOut }
}

// ---------------------------------------------------------------------------
// Timer Display Helpers
// ---------------------------------------------------------------------------

/**
 * Format milliseconds as MM:SS for display.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

/**
 * Get a display-friendly timer string for a player.
 * Shows main time or byoyomi state.
 */
export function getTimerDisplay(timer: QuickGoPlayerTimer): string {
  if (timer.timedOut) return '0:00'

  if (!timer.inByoyomi) {
    return formatTime(timer.mainTimeMs)
  }

  return `${formatTime(timer.byoyomiTimeMs)} (${String(timer.byoyomiPeriodsRemaining)})`
}

/**
 * Determine timer urgency level for visual indicators.
 */
export function getTimerUrgency(timer: QuickGoPlayerTimer): 'normal' | 'warning' | 'critical' {
  if (timer.timedOut) return 'critical'

  if (timer.inByoyomi) {
    if (timer.byoyomiPeriodsRemaining <= 1) return 'critical'
    return 'warning'
  }

  if (timer.mainTimeMs < 30_000) return 'critical' // Under 30 seconds
  if (timer.mainTimeMs < 60_000) return 'warning' // Under 1 minute
  return 'normal'
}

/**
 * Get total remaining time for a player (main + all byoyomi periods).
 * Useful for approximate game progress estimation.
 */
export function getTotalRemainingMs(timer: QuickGoPlayerTimer, timeControl: TimeControl): number {
  if (timer.timedOut) return 0

  let total = 0
  if (!timer.inByoyomi) {
    total += timer.mainTimeMs
    total += timer.byoyomiPeriodsRemaining * timeControl.byoyomiTime * 1000
  } else {
    total += timer.byoyomiTimeMs
    total += (timer.byoyomiPeriodsRemaining - 1) * timeControl.byoyomiTime * 1000
  }
  return Math.max(0, total)
}
