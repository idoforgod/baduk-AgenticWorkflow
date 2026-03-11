// =============================================================================
// features/onboarding/OnboardingStore.ts — Zustand Store for Onboarding
// =============================================================================
// Wraps OnboardingController in a Zustand store for reactive UI binding.
// Follows the same DI pattern as game-engine/store.ts: inject dependencies
// via a configure function before using the store.
//
// Usage:
//   configureOnboardingStore(rulesEngine)
//   const state = useOnboardingStore.getState()
//   state.startTutorial()
// =============================================================================

import type { IRulesEngine } from '@core/interfaces'
import { create } from 'zustand'
import type { StorageAdapter } from './OnboardingController'
import { OnboardingController } from './OnboardingController'
import type { OnboardingStore } from './types'

// ---------------------------------------------------------------------------
// Module-level dependency (injected once at app boot)
// ---------------------------------------------------------------------------

let _controller: OnboardingController | null = null

/**
 * Configure the onboarding store with its required dependencies.
 * Must be called before any store actions are invoked.
 */
export function configureOnboardingStore(
  rulesEngine: IRulesEngine,
  storage?: StorageAdapter,
  nowFn?: () => number
): void {
  _controller = new OnboardingController({ rulesEngine, storage, nowFn })
}

/** Get the controller or throw if not configured */
function getController(): OnboardingController {
  if (_controller === null) {
    throw new Error('OnboardingStore: not configured. Call configureOnboardingStore() first.')
  }
  return _controller
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

/**
 * Zustand store for onboarding state.
 * Delegates all logic to OnboardingController and syncs state after each action.
 */
export const useOnboardingStore = create<OnboardingStore>((set) => {
  /** Sync Zustand state from the controller */
  function sync(): void {
    const controller = getController()
    const state = controller.getState()
    set({
      currentStep: state.currentStep,
      currentStepIndex: state.currentStepIndex,
      currentContent: state.currentContent,
      currentScenario: state.currentScenario,
      boardState: state.boardState,
      interactionComplete: state.interactionComplete,
      tutorialComplete: state.tutorialComplete,
      tutorialSkipped: state.tutorialSkipped,
      progress: state.progress,
      analyticsEvents: state.analyticsEvents,
      highlightedIndices: state.highlightedIndices,
      lastCaptures: state.lastCaptures,
      successMessage: state.successMessage,
    })
  }

  return {
    // --- Initial state ---
    currentStep: 'welcome',
    currentStepIndex: 0,
    currentContent: {
      id: 'welcome',
      title: 'Welcome to Baduk',
      subtitle: 'The ancient game of Go',
      description: '',
      requiresInteraction: false,
      hint: null,
    },
    currentScenario: null,
    boardState: null,
    interactionComplete: false,
    tutorialComplete: false,
    tutorialSkipped: false,
    progress: {
      lastCompletedStep: null,
      completed: false,
      skipped: false,
      startedAt: null,
      finishedAt: null,
      timeSpentMs: 0,
      restartCount: 0,
    },
    analyticsEvents: [],
    highlightedIndices: [],
    lastCaptures: [],
    successMessage: null,

    // --- Actions ---
    startTutorial() {
      getController().startTutorial()
      sync()
    },

    nextStep() {
      const result = getController().nextStep()
      sync()
      return result
    },

    previousStep() {
      const result = getController().previousStep()
      sync()
      return result
    },

    skipTutorial() {
      getController().skipTutorial()
      sync()
    },

    restartTutorial() {
      getController().restartTutorial()
      sync()
    },

    resumeTutorial() {
      getController().resumeTutorial()
      sync()
    },

    handleBoardInteraction(index: number) {
      const result = getController().handleBoardInteraction(index)
      sync()
      return result
    },

    getAnalyticsEvents() {
      return getController().getAnalyticsEvents()
    },

    reset() {
      getController().reset()
      sync()
    },
  }
})
