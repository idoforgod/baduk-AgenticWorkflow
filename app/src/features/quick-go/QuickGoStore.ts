// =============================================================================
// features/quick-go/QuickGoStore.ts — Quick Go Zustand Store
// =============================================================================
// Wraps QuickGoController in a reactive Zustand store for UI consumption.
// This store provides the Quick Go-specific state that the UI components need,
// complementing the existing useGameStore for board state.
//
// Usage:
//   const phase = useQuickGoStore(s => s.phase)
//   const startGame = useQuickGoStore(s => s.startGame)
// =============================================================================

import { create } from 'zustand'
import type { QuickGoController } from './QuickGoController'
import { getDefaultLevel } from './QuickGoDifficulty'
import { createTimerState } from './QuickGoTimer'
import type { QuickGoStore } from './types'
import { DEFAULT_QUICK_GO_CONFIG } from './types'

// ---------------------------------------------------------------------------
// Module-level controller reference (injected at boot)
// ---------------------------------------------------------------------------

let _controller: QuickGoController | null = null

/**
 * Configure the Quick Go store with its controller dependency.
 * Must be called once at app startup after creating the QuickGoController.
 */
export function configureQuickGoStore(controller: QuickGoController): void {
  _controller = controller
}

function getController(): QuickGoController {
  if (_controller === null) {
    throw new Error('QuickGoStore: controller not configured. Call configureQuickGoStore() first.')
  }
  return _controller
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const initialState = {
  config: DEFAULT_QUICK_GO_CONFIG,
  phase: 'setup' as const,
  timer: createTimerState(DEFAULT_QUICK_GO_CONFIG.timeControl),
  ai: {
    isThinking: false,
    thinkingStartTime: null,
    lastMove: null,
  },
  result: null,
  analysis: null,
  session: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentDifficultyLevel: getDefaultLevel('beginner'),
    sessionTimeSeconds: 0,
  },
  progressPercent: 0,
  moveCount: 0,
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const useQuickGoStore = create<QuickGoStore>()((set, _get) => ({
  ...initialState,

  startGame(configOverride) {
    const controller = getController()
    controller.startGame(configOverride)
    const state = controller.getState()
    set({
      config: state.config,
      phase: state.phase,
      timer: state.timer,
      ai: state.ai,
      result: null,
      analysis: null,
      progressPercent: 0,
      moveCount: 0,
    })
  },

  handlePlayerMove(index) {
    const controller = getController()
    const result = controller.handlePlayerMove(index)
    const state = controller.getState()
    set({
      phase: state.phase,
      timer: state.timer,
      result: state.result,
      progressPercent: state.progressPercent,
      moveCount: state.moveCount,
    })
    return result
  },

  handlePass() {
    const controller = getController()
    const result = controller.handlePass()
    const state = controller.getState()
    set({
      phase: state.phase,
      timer: state.timer,
      result: state.result,
      progressPercent: state.progressPercent,
      moveCount: state.moveCount,
    })
    return result
  },

  handleResign() {
    const controller = getController()
    controller.handleResign()
    const state = controller.getState()
    set({
      phase: state.phase,
      timer: state.timer,
      result: state.result,
      session: state.session,
    })
  },

  async requestAIMove() {
    const controller = getController()
    set({ ai: { isThinking: true, thinkingStartTime: Date.now(), lastMove: null } })
    const result = await controller.handleAIResponse()
    const state = controller.getState()
    set({
      phase: state.phase,
      timer: state.timer,
      ai: { isThinking: false, thinkingStartTime: null, lastMove: result.coordinate ?? null },
      result: state.result,
      progressPercent: state.progressPercent,
      moveCount: state.moveCount,
    })
    return result
  },

  tickTimer(now) {
    const controller = getController()
    const timedOut = controller.tickTimer(now)
    const state = controller.getState()
    set({ timer: state.timer })
    if (timedOut !== null) {
      set({ phase: state.phase, result: state.result })
    }
  },

  endGame(reason) {
    const controller = getController()
    const result = controller.endGame(reason)
    const state = controller.getState()
    set({
      phase: state.phase,
      result: state.result,
      session: state.session,
    })
    return result
  },

  async analyzeGame() {
    const controller = getController()
    const analysis = await controller.analyzeGame()
    const state = controller.getState()
    set({
      phase: state.phase,
      analysis,
    })
    return analysis
  },

  rematch() {
    const controller = getController()
    controller.rematch()
    const state = controller.getState()
    set({
      config: state.config,
      phase: state.phase,
      timer: state.timer,
      ai: state.ai,
      result: null,
      analysis: null,
      progressPercent: 0,
      moveCount: 0,
    })
  },

  reset() {
    const controller = getController()
    controller.reset()
    set({ ...initialState })
  },

  setPhase(phase) {
    set({ phase })
  },

  updateAnalysis(result) {
    set({ analysis: result })
  },
}))
