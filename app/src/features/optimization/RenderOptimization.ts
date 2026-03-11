// =============================================================================
// features/optimization/RenderOptimization.ts — React rendering optimization utilities
// =============================================================================
// Pure TypeScript utilities — no React imports. These functions are consumed
// by React hooks/components but contain no React-specific code themselves.
//
// Utilities:
// 1. createMemoizedSelector() — factory for Zustand selectors with shallow equality
// 2. diffBoardState() — return changed intersections between two board snapshots
// 3. createThrottledCallback() — throttle rapid user inputs
// 4. DEFAULT_VIRTUALIZATION_CONFIG — move list virtualization parameters
// =============================================================================

import type { BoardDiff, IntersectionDiff, IntersectionState, VirtualizationConfig } from './types'

// ---------------------------------------------------------------------------
// Memoized Selector Factory
// ---------------------------------------------------------------------------

/**
 * Equality function type for Zustand selectors.
 * Returns true if the two values are considered equal (no re-render needed).
 */
export type EqualityFn<T> = (a: T, b: T) => boolean

/**
 * A Zustand selector function: maps the full store state to a derived slice.
 */
export type SelectorFn<TState, TSlice> = (state: TState) => TSlice

/**
 * A memoized selector pairs a selector function with a custom equality check.
 * This is the value passed to Zustand's `useStore(selector, equality)`.
 */
export interface MemoizedSelector<TState, TSlice> {
  readonly selector: SelectorFn<TState, TSlice>
  readonly equality: EqualityFn<TSlice>
}

/**
 * Shallow equality check for plain objects and arrays.
 * Returns true if both values have the same keys/indices with identical values (===).
 *
 * This is the standard Zustand shallow equality from zustand/shallow, re-implemented
 * here to avoid the import and enable testing without a full store.
 */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true

  if (typeof a !== 'object' || a === null) return false
  if (typeof b !== 'object' || b === null) return false

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>

  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)

  if (aKeys.length !== bKeys.length) return false

  for (const key of aKeys) {
    if (!Object.hasOwn(bObj, key)) return false
    if (!Object.is(aObj[key], bObj[key])) return false
  }

  return true
}

/**
 * Create a memoized Zustand selector with shallow equality.
 *
 * Usage in a React component:
 *   const { selector, equality } = createMemoizedSelector(
 *     (state: GameStore) => ({ board: state.board, currentPlayer: state.currentPlayer })
 *   )
 *   const slice = useGameStore(selector, equality)
 *
 * @param selector - Function that extracts the required slice from the store state.
 * @param equality - Optional custom equality function. Defaults to shallowEqual.
 * @returns MemoizedSelector ready to pass to useStore().
 */
export function createMemoizedSelector<TState, TSlice>(
  selector: SelectorFn<TState, TSlice>,
  equality: EqualityFn<TSlice> = shallowEqual
): MemoizedSelector<TState, TSlice> {
  return { selector, equality }
}

// ---------------------------------------------------------------------------
// Board State Diff
// ---------------------------------------------------------------------------

/**
 * Compare two board state arrays and return only the changed intersections.
 *
 * This function enables selective re-rendering: instead of re-rendering all
 * size*size intersections, only changed ones are updated.
 *
 * @param prev - Previous board state (flat Uint8Array or number array, length = size*size).
 * @param next - New board state (same shape).
 * @returns BoardDiff describing what changed.
 */
export function diffBoardState(
  prev: Uint8Array | readonly number[],
  next: Uint8Array | readonly number[]
): BoardDiff {
  const total = Math.min(prev.length, next.length)
  const changes: IntersectionDiff[] = []

  for (let i = 0; i < total; i++) {
    const fromRaw = prev[i] ?? 0
    const toRaw = next[i] ?? 0
    const from = fromRaw as IntersectionState
    const to = toRaw as IntersectionState

    if (from !== to) {
      changes.push({ index: i, from, to })
    }
  }

  // Handle length mismatch (board resize or first render)
  if (next.length > prev.length) {
    for (let i = total; i < next.length; i++) {
      const toRaw = next[i] ?? 0
      const to = toRaw as IntersectionState
      if (to !== 0) {
        changes.push({ index: i, from: 0, to })
      }
    }
  }

  return {
    changes,
    hasChanges: changes.length > 0,
    totalIntersections: next.length,
  }
}

/**
 * Create an empty board state (all zeros) of the given size.
 * Convenience helper for initializing board comparisons.
 *
 * @param size - Board dimension (9, 13, or 19 — creates size*size array).
 */
export function createEmptyBoardState(size: number): Uint8Array {
  return new Uint8Array(size * size)
}

// ---------------------------------------------------------------------------
// Throttled Callback
// ---------------------------------------------------------------------------

/**
 * A throttled version of a callback function.
 * During the throttle window, extra calls are dropped (leading edge).
 */
export interface ThrottledCallback<TArgs extends readonly unknown[]> {
  /** Call the throttled function. */
  readonly call: (...args: TArgs) => void
  /** Cancel any pending throttle. */
  readonly cancel: () => void
  /** Return true if currently within the throttle window. */
  readonly isThrottled: () => boolean
}

/**
 * Create a throttled callback that fires at most once per `intervalMs`.
 * Uses leading-edge execution: the first call fires immediately,
 * subsequent calls within the interval are discarded.
 *
 * Use case: stone placement taps, scroll events.
 *
 * @param fn - The function to throttle.
 * @param intervalMs - Throttle interval in milliseconds (default 16ms = 1 frame).
 * @returns ThrottledCallback with call/cancel/isThrottled methods.
 */
export function createThrottledCallback<TArgs extends readonly unknown[]>(
  fn: (...args: TArgs) => void,
  intervalMs = 16
): ThrottledCallback<TArgs> {
  let lastCallTime = 0
  let timerId: ReturnType<typeof setTimeout> | null = null

  const call = (...args: TArgs): void => {
    const now = Date.now()
    const elapsed = now - lastCallTime

    if (elapsed >= intervalMs) {
      lastCallTime = now
      fn(...args)
    }
    // Leading-edge only: discard calls within window
  }

  const cancel = (): void => {
    if (timerId !== null) {
      clearTimeout(timerId)
      timerId = null
    }
    lastCallTime = 0
  }

  const isThrottled = (): boolean => {
    const now = Date.now()
    return now - lastCallTime < intervalMs
  }

  return { call, cancel, isThrottled }
}

// ---------------------------------------------------------------------------
// Move List Virtualization Config
// ---------------------------------------------------------------------------

/**
 * Virtualization configuration for the move list panel.
 * When a game exceeds 200 moves, virtual scrolling should activate
 * to avoid rendering hundreds of DOM nodes.
 *
 * Usage with @tanstack/react-virtual or react-window:
 *   const rowVirtualizer = useVirtualizer({
 *     count: moveHistory.length,
 *     estimateSize: () => MOVE_LIST_VIRTUALIZATION.itemHeightPx,
 *     overscan: MOVE_LIST_VIRTUALIZATION.overscanCount,
 *   })
 */
export const MOVE_LIST_VIRTUALIZATION: VirtualizationConfig = {
  activationThreshold: 200,
  itemHeightPx: 28,
  overscanCount: 5,
} as const

// ---------------------------------------------------------------------------
// Board Render Helper: Track Previous Board for Diff
// ---------------------------------------------------------------------------

/**
 * A stateful board snapshot tracker for incremental rendering.
 *
 * Usage pattern (outside React):
 *   const tracker = createBoardTracker(boardSize)
 *   const diff = tracker.update(newBoard)
 *   // Only re-render intersections in diff.changes
 */
export interface BoardTracker {
  /** Update with new board state and return the diff. */
  readonly update: (newBoard: Uint8Array | readonly number[]) => BoardDiff
  /** Reset to empty board (use on game reset). */
  readonly reset: () => void
  /** Get the current tracked board state. */
  readonly getCurrent: () => Uint8Array
}

/**
 * Create a board tracker that remembers the previous board state
 * and returns only the changed intersections on each update.
 *
 * @param boardSize - Size of one side of the board (9, 13, or 19).
 */
export function createBoardTracker(boardSize: number): BoardTracker {
  let current = createEmptyBoardState(boardSize)

  const update = (newBoard: Uint8Array | readonly number[]): BoardDiff => {
    const diff = diffBoardState(current, newBoard)
    current = newBoard instanceof Uint8Array ? newBoard : new Uint8Array(newBoard)
    return diff
  }

  const reset = (): void => {
    current = createEmptyBoardState(boardSize)
  }

  const getCurrent = (): Uint8Array => current

  return { update, reset, getCurrent }
}
