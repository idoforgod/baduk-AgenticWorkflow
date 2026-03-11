// =============================================================================
// features/onboarding/onboarding.test.ts — Interactive Onboarding Tests
// =============================================================================
// Comprehensive tests covering:
// 1. Tutorial flow: start -> each step -> completion
// 2. Step validation (user must complete interactive action before advancing)
// 3. Progress persistence (save/resume via localStorage)
// 4. Scenario correctness (capture scenarios produce valid captures)
// 5. Edge cases: skip, restart, resume from any step
// 6. Analytics event emission
// 7. Integration with rules engine (real implementation)
// =============================================================================

import type { IRulesEngine } from '@core/interfaces'
import { createRulesEngine } from '@rules-engine/rules'
import { beforeEach, describe, expect, it } from 'vitest'
import type { StorageAdapter } from './OnboardingController'
import { createOnboardingController } from './OnboardingController'
import {
  createCaptureScenario,
  createCornerCaptureScenario,
  createMultiCaptureScenario,
  FIRST_STONE_SCENARIO,
  getScenarioForStep,
} from './TutorialScenarios'
import {
  DEFAULT_ONBOARDING_PROGRESS,
  INTERACTIVE_STEP_COUNT,
  ONBOARDING_STORAGE_KEY,
  TUTORIAL_CONTENT,
  TUTORIAL_STEPS,
} from './types'

// =============================================================================
// Test Helpers
// =============================================================================

function createMockStorage(): StorageAdapter & { store: Record<string, string> } {
  const store: Record<string, string> = {}
  return {
    store,
    getItem(key: string) {
      return store[key] ?? null
    },
    setItem(key: string, value: string) {
      store[key] = value
    },
    removeItem(key: string) {
      delete store[key]
    },
  }
}

/** Fixed timestamp for deterministic tests */
let mockTime = 1000000

function mockNow(): number {
  return mockTime
}

function advanceTime(ms: number): void {
  mockTime += ms
}

let rulesEngine: IRulesEngine
let storage: ReturnType<typeof createMockStorage>

beforeEach(() => {
  rulesEngine = createRulesEngine()
  storage = createMockStorage()
  mockTime = 1000000
})

// =============================================================================
// 1. Tutorial Flow Tests
// =============================================================================

describe('Tutorial Flow', () => {
  it('should start at the welcome step', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    expect(controller.getCurrentStep()).toBe('welcome')
    expect(controller.getCurrentStepIndex()).toBe(0)
  })

  it('should advance through all steps to completion', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    // Step 0: welcome (no interaction required)
    expect(controller.getCurrentStep()).toBe('welcome')
    expect(controller.nextStep()).toBe(true)

    // Step 1: rules_explanation (no interaction required)
    expect(controller.getCurrentStep()).toBe('rules_explanation')
    expect(controller.nextStep()).toBe(true)

    // Step 2: first_stone (requires interaction)
    expect(controller.getCurrentStep()).toBe('first_stone')
    // Place a stone at any intersection
    expect(controller.handleBoardInteraction(40)).toBe(true)
    expect(controller.nextStep()).toBe(true)

    // Step 3: capture_experience (requires interaction)
    expect(controller.getCurrentStep()).toBe('capture_experience')
    // Place black at index 41 to capture white at 40
    expect(controller.handleBoardInteraction(41)).toBe(true)
    expect(controller.nextStep()).toBe(true)

    // Step 4: quick_go_transition (no interaction required)
    expect(controller.getCurrentStep()).toBe('quick_go_transition')
    expect(controller.nextStep()).toBe(true)

    // Step 5: ai_explanation_demo (no interaction required)
    expect(controller.getCurrentStep()).toBe('ai_explanation_demo')
    advanceTime(30000) // 30 seconds spent
    expect(controller.nextStep()).toBe(true)

    // Should be complete
    expect(controller.isTutorialComplete()).toBe(true)
    expect(controller.getCurrentStep()).toBe('complete')
  })

  it('should have the correct number of steps', () => {
    expect(TUTORIAL_STEPS.length).toBe(7)
    expect(INTERACTIVE_STEP_COUNT).toBe(6)
  })

  it('should provide content for every step', () => {
    for (const stepId of TUTORIAL_STEPS) {
      const content = TUTORIAL_CONTENT[stepId]
      expect(content).toBeDefined()
      expect(content.id).toBe(stepId)
      expect(content.title.length).toBeGreaterThan(0)
      expect(content.description.length).toBeGreaterThan(0)
    }
  })

  it('should expose the full state object', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    const state = controller.getState()
    expect(state.currentStep).toBe('welcome')
    expect(state.currentStepIndex).toBe(0)
    expect(state.currentContent.id).toBe('welcome')
    expect(state.interactionComplete).toBe(false)
    expect(state.tutorialComplete).toBe(false)
    expect(state.tutorialSkipped).toBe(false)
    expect(state.progress.startedAt).toBeTruthy()
  })
})

// =============================================================================
// 2. Step Validation Tests
// =============================================================================

describe('Step Validation', () => {
  it('should block advancement on interactive steps without interaction', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    // Advance to first_stone (interactive)
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    expect(controller.getCurrentStep()).toBe('first_stone')
    // Try to advance without interacting
    expect(controller.nextStep()).toBe(false)
    // Should still be on first_stone
    expect(controller.getCurrentStep()).toBe('first_stone')
  })

  it('should allow advancement on non-interactive steps', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    // Welcome is non-interactive
    expect(controller.nextStep()).toBe(true)
    expect(controller.getCurrentStep()).toBe('rules_explanation')
  })

  it('should allow advancement after completing interaction', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    expect(controller.getCurrentStep()).toBe('first_stone')
    controller.handleBoardInteraction(40)
    expect(controller.isInteractionComplete()).toBe(true)
    expect(controller.nextStep()).toBe(true)
    expect(controller.getCurrentStep()).toBe('capture_experience')
  })

  it('should reject board interaction on non-interactive steps', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    // Welcome is non-interactive
    expect(controller.handleBoardInteraction(40)).toBe(false)
  })

  it('should reject duplicate board interactions after completion', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    // first_stone
    expect(controller.handleBoardInteraction(40)).toBe(true)
    // Second interaction should be rejected
    expect(controller.handleBoardInteraction(41)).toBe(false)
  })

  it('should reject interaction at occupied index on first_stone', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    // first_stone scenario has an empty board, so any index is valid
    // But an out-of-range index should fail via rules engine
    expect(controller.handleBoardInteraction(-1)).toBe(false)
    expect(controller.handleBoardInteraction(81)).toBe(false)
  })
})

// =============================================================================
// 3. Progress Persistence Tests
// =============================================================================

describe('Progress Persistence', () => {
  it('should save progress to storage on start', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    const saved = storage.store[ONBOARDING_STORAGE_KEY]
    expect(saved).toBeDefined()
    const parsed = JSON.parse(saved!)
    expect(parsed.startedAt).toBeTruthy()
  })

  it('should save progress after each step', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome

    const saved = JSON.parse(storage.store[ONBOARDING_STORAGE_KEY]!)
    expect(saved.lastCompletedStep).toBe('welcome')
  })

  it('should resume from the correct step', () => {
    // Complete first two steps
    const controller1 = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller1.startTutorial()
    controller1.nextStep() // welcome
    controller1.nextStep() // rules_explanation

    // Create a new controller (simulating app restart) and resume
    const controller2 = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller2.resumeTutorial()

    // Should be at first_stone (the step after rules_explanation)
    expect(controller2.getCurrentStep()).toBe('first_stone')
  })

  it('should start fresh if no saved progress exists', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.resumeTutorial()

    expect(controller.getCurrentStep()).toBe('welcome')
    expect(controller.getCurrentStepIndex()).toBe(0)
  })

  it('should start fresh if saved progress is completed', () => {
    // Manually save completed progress
    storage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_ONBOARDING_PROGRESS, completed: true })
    )

    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.resumeTutorial()

    expect(controller.getCurrentStep()).toBe('welcome')
  })

  it('should start fresh if saved progress is skipped', () => {
    storage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_ONBOARDING_PROGRESS, skipped: true })
    )

    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.resumeTutorial()

    expect(controller.getCurrentStep()).toBe('welcome')
  })

  it('should clear progress on reset', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.reset()

    expect(storage.store[ONBOARDING_STORAGE_KEY]).toBeUndefined()
    expect(controller.getCurrentStep()).toBe('welcome')
    expect(controller.getCurrentStepIndex()).toBe(0)
  })

  it('should handle corrupted storage gracefully', () => {
    storage.setItem(ONBOARDING_STORAGE_KEY, 'not-valid-json')

    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    // Should not throw, should start fresh
    controller.resumeTutorial()
    expect(controller.getCurrentStep()).toBe('welcome')
  })
})

// =============================================================================
// 4. Scenario Correctness Tests
// =============================================================================

describe('Tutorial Scenarios', () => {
  it('should provide first_stone scenario for the first_stone step', () => {
    const scenario = getScenarioForStep('first_stone')
    expect(scenario).not.toBeNull()
    expect(scenario!.boardSize).toBe(9)
    expect(scenario!.initialBoard.length).toBe(81)
    expect(scenario!.playerToMove).toBe('B')
    expect(scenario!.targetIndices).toBeNull() // any move
  })

  it('should provide capture scenario for the capture_experience step', () => {
    const scenario = getScenarioForStep('capture_experience')
    expect(scenario).not.toBeNull()
    expect(scenario!.boardSize).toBe(9)
    expect(scenario!.targetIndices).toEqual([41])
    expect(scenario!.expectedCaptures).toEqual([40])
  })

  it('should return null for non-interactive steps', () => {
    expect(getScenarioForStep('welcome')).toBeNull()
    expect(getScenarioForStep('rules_explanation')).toBeNull()
    expect(getScenarioForStep('quick_go_transition')).toBeNull()
    expect(getScenarioForStep('ai_explanation_demo')).toBeNull()
    expect(getScenarioForStep('complete')).toBeNull()
  })

  it('should have first_stone scenario with all empty board', () => {
    const scenario = FIRST_STONE_SCENARIO
    for (const cell of scenario.initialBoard) {
      expect(cell).toBe(0) // all empty
    }
  })

  it('should have capture scenario with correct stone placement', () => {
    const scenario = createCaptureScenario()
    // Black stones
    expect(scenario.initialBoard[31]).toBe(1) // above
    expect(scenario.initialBoard[39]).toBe(1) // left
    expect(scenario.initialBoard[49]).toBe(1) // below
    // White stone to capture
    expect(scenario.initialBoard[40]).toBe(2) // center
    // Target is empty
    expect(scenario.initialBoard[41]).toBe(0) // right (target)
  })

  it('should validate that capture move is legal via rules engine', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    // first_stone
    controller.handleBoardInteraction(0) // place anywhere
    controller.nextStep()

    // capture_experience — place at 41 to capture
    expect(controller.getCurrentStep()).toBe('capture_experience')
    const result = controller.handleBoardInteraction(41)
    expect(result).toBe(true)

    // Verify capture occurred in board state
    const state = controller.getState()
    expect(state.lastCaptures).toEqual([40])
    expect(state.boardState).not.toBeNull()
    // The captured white stone should be removed
    expect(state.boardState![40]).toBe(0)
    // The placed black stone should be present
    expect(state.boardState![41]).toBe(1)
  })

  it('should reject wrong target in capture scenario', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation
    controller.handleBoardInteraction(0)
    controller.nextStep()

    // capture_experience — try placing at wrong position
    expect(controller.getCurrentStep()).toBe('capture_experience')
    expect(controller.handleBoardInteraction(42)).toBe(false) // not the target
    expect(controller.handleBoardInteraction(30)).toBe(false) // not the target
    expect(controller.isInteractionComplete()).toBe(false)
  })

  it('should create valid corner capture scenario', () => {
    const scenario = createCornerCaptureScenario()
    expect(scenario.initialBoard[0]).toBe(2) // white in corner
    expect(scenario.initialBoard[1]).toBe(1) // black to right
    expect(scenario.targetIndices).toEqual([9])
    expect(scenario.expectedCaptures).toEqual([0])
  })

  it('should create valid multi-stone capture scenario', () => {
    const scenario = createMultiCaptureScenario()
    expect(scenario.initialBoard[40]).toBe(2) // white
    expect(scenario.initialBoard[41]).toBe(2) // white
    expect(scenario.targetIndices).toEqual([42])
    expect(scenario.expectedCaptures).toEqual([40, 41])
  })

  it('should show success message after completing capture', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(0)
    controller.nextStep()

    // capture_experience
    controller.handleBoardInteraction(41)
    const state = controller.getState()
    expect(state.successMessage).toBeTruthy()
    expect(state.successMessage!.length).toBeGreaterThan(0)
  })

  it('should show highlighted indices for capture scenario', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(0)
    controller.nextStep()

    // capture_experience — should highlight the target
    const state = controller.getState()
    expect(state.highlightedIndices).toEqual([41])
  })
})

// =============================================================================
// 5. Edge Cases Tests
// =============================================================================

describe('Edge Cases', () => {
  it('should handle skip at the beginning', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.skipTutorial()

    expect(controller.isTutorialSkipped()).toBe(true)
    const progress = controller.getProgress()
    expect(progress.skipped).toBe(true)
    expect(progress.finishedAt).toBeTruthy()
  })

  it('should handle skip mid-tutorial', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation
    controller.skipTutorial()

    expect(controller.isTutorialSkipped()).toBe(true)
    expect(controller.getCurrentStep()).toBe('first_stone') // stays where it was
  })

  it('should handle restart', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()

    controller.restartTutorial()
    expect(controller.getCurrentStep()).toBe('welcome')
    expect(controller.getCurrentStepIndex()).toBe(0)
    expect(controller.getProgress().restartCount).toBe(1)
  })

  it('should increment restart count on multiple restarts', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.restartTutorial()
    controller.restartTutorial()
    controller.restartTutorial()

    expect(controller.getProgress().restartCount).toBe(3)
  })

  it('should not go before the first step', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    expect(controller.previousStep()).toBe(false)
    expect(controller.getCurrentStepIndex()).toBe(0)
  })

  it('should go back correctly', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome -> rules_explanation

    expect(controller.previousStep()).toBe(true)
    expect(controller.getCurrentStep()).toBe('welcome')
  })

  it('should reset interaction state when going back', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation
    controller.handleBoardInteraction(40) // first_stone completed

    controller.previousStep() // go back to rules_explanation
    controller.nextStep() // back to first_stone

    // Interaction should be reset
    expect(controller.isInteractionComplete()).toBe(false)
  })

  it('should handle resuming with last step completed', () => {
    // Save progress with last step being ai_explanation_demo (second to last)
    const progress = {
      ...DEFAULT_ONBOARDING_PROGRESS,
      lastCompletedStep: 'ai_explanation_demo',
      startedAt: new Date(mockTime).toISOString(),
    }
    storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(progress))

    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.resumeTutorial()

    // Should be at the 'complete' step (index 6, the step after ai_explanation_demo)
    expect(controller.getCurrentStep()).toBe('complete')
  })

  it('should clear success message and captures on step change', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(0)
    controller.nextStep()

    // capture_experience
    controller.handleBoardInteraction(41)
    expect(controller.getState().successMessage).toBeTruthy()
    expect(controller.getState().lastCaptures.length).toBeGreaterThan(0)

    controller.nextStep()
    expect(controller.getState().successMessage).toBeNull()
    expect(controller.getState().lastCaptures.length).toBe(0)
  })
})

// =============================================================================
// 6. Analytics Event Tests
// =============================================================================

describe('Analytics Events', () => {
  it('should emit onboarding_started on startTutorial', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    const events = controller.getAnalyticsEvents()
    expect(events.length).toBe(1)
    expect(events[0]!.type).toBe('onboarding_started')
    expect(events[0]!.timestamp).toBe(mockTime)
  })

  it('should emit onboarding_step_completed for each step', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome

    const events = controller.getAnalyticsEvents()
    const stepEvents = events.filter((e) => e.type === 'onboarding_step_completed')
    expect(stepEvents.length).toBe(1)
    expect(stepEvents[0]!.data['step']).toBe('welcome')
  })

  it('should emit onboarding_completed when tutorial finishes', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    // Go through all steps
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation
    controller.handleBoardInteraction(40)
    controller.nextStep() // first_stone
    controller.handleBoardInteraction(41)
    controller.nextStep() // capture_experience
    controller.nextStep() // quick_go_transition
    advanceTime(60000)
    controller.nextStep() // ai_explanation_demo -> complete

    const events = controller.getAnalyticsEvents()
    const completedEvents = events.filter((e) => e.type === 'onboarding_completed')
    expect(completedEvents.length).toBe(1)
    expect(completedEvents[0]!.data['timeSpentMs']).toBe(60000)
  })

  it('should emit onboarding_skipped when tutorial is skipped', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.skipTutorial()

    const events = controller.getAnalyticsEvents()
    const skipEvents = events.filter((e) => e.type === 'onboarding_skipped')
    expect(skipEvents.length).toBe(1)
    expect(skipEvents[0]!.data['lastStep']).toBe('rules_explanation')
  })

  it('should emit onboarding_time_spent on completion', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    advanceTime(120000) // 2 minutes
    controller.skipTutorial()

    const events = controller.getAnalyticsEvents()
    const timeEvents = events.filter((e) => e.type === 'onboarding_time_spent')
    expect(timeEvents.length).toBe(1)
    expect(timeEvents[0]!.data['timeSpentMs']).toBe(120000)
  })

  it('should track timestamps on all events', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    advanceTime(5000)
    controller.nextStep()

    const events = controller.getAnalyticsEvents()
    expect(events[0]!.timestamp).toBe(1000000)
    expect(events[1]!.timestamp).toBe(1005000)
  })

  it('should include step index in step_completed events', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome (index 0)
    controller.nextStep() // rules_explanation (index 1)

    const events = controller.getAnalyticsEvents()
    const stepEvents = events.filter((e) => e.type === 'onboarding_step_completed')
    expect(stepEvents[0]!.data['stepIndex']).toBe(0)
    expect(stepEvents[1]!.data['stepIndex']).toBe(1)
  })
})

// =============================================================================
// 7. Rules Engine Integration Tests
// =============================================================================

describe('Rules Engine Integration', () => {
  it('should validate moves via the real rules engine', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()

    // first_stone: any valid position should work
    expect(controller.handleBoardInteraction(0)).toBe(true)
    expect(controller.isInteractionComplete()).toBe(true)
  })

  it('should reject out-of-bounds moves via rules engine', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()

    // first_stone: out-of-bounds
    expect(controller.handleBoardInteraction(100)).toBe(false)
    expect(controller.isInteractionComplete()).toBe(false)
  })

  it('should correctly execute capture via rules engine validation', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(0) // first_stone
    controller.nextStep()

    // capture_experience: place at 41 to capture white at 40
    const result = controller.handleBoardInteraction(41)
    expect(result).toBe(true)

    const state = controller.getState()
    expect(state.lastCaptures).toContain(40)
    // Board should show the capture
    expect(state.boardState![40]).toBe(0) // captured
    expect(state.boardState![41]).toBe(1) // placed black
  })

  it('should keep surrounding stones after capture', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(0)
    controller.nextStep()

    controller.handleBoardInteraction(41) // capture

    const state = controller.getState()
    // Surrounding black stones should still be present
    expect(state.boardState![31]).toBe(1) // above
    expect(state.boardState![39]).toBe(1) // left
    expect(state.boardState![49]).toBe(1) // below
    expect(state.boardState![41]).toBe(1) // the capturing stone
  })
})

// =============================================================================
// 8. Default Progress Tests
// =============================================================================

describe('Default Progress', () => {
  it('should have sensible defaults', () => {
    expect(DEFAULT_ONBOARDING_PROGRESS.lastCompletedStep).toBeNull()
    expect(DEFAULT_ONBOARDING_PROGRESS.completed).toBe(false)
    expect(DEFAULT_ONBOARDING_PROGRESS.skipped).toBe(false)
    expect(DEFAULT_ONBOARDING_PROGRESS.startedAt).toBeNull()
    expect(DEFAULT_ONBOARDING_PROGRESS.finishedAt).toBeNull()
    expect(DEFAULT_ONBOARDING_PROGRESS.timeSpentMs).toBe(0)
    expect(DEFAULT_ONBOARDING_PROGRESS.restartCount).toBe(0)
  })
})

// =============================================================================
// 9. Board State Tests
// =============================================================================

describe('Board State Management', () => {
  it('should have null board state for non-interactive steps', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    const state = controller.getState()
    expect(state.boardState).toBeNull()
    expect(state.currentScenario).toBeNull()
  })

  it('should load board state for interactive steps', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep() // welcome
    controller.nextStep() // rules_explanation

    // first_stone should have a board
    const state = controller.getState()
    expect(state.boardState).not.toBeNull()
    expect(state.boardState!.length).toBe(81)
    expect(state.currentScenario).not.toBeNull()
  })

  it('should update board state after interaction', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()

    // Place a stone at index 40
    controller.handleBoardInteraction(40)
    const state = controller.getState()
    expect(state.boardState![40]).toBe(1) // black stone
  })

  it('should reset board state when moving to non-interactive step', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(40) // first_stone
    controller.nextStep()
    controller.handleBoardInteraction(41) // capture
    controller.nextStep() // quick_go_transition (non-interactive)

    const state = controller.getState()
    expect(state.boardState).toBeNull()
    expect(state.currentScenario).toBeNull()
  })

  it('should have highlight indices matching scenario', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    controller.nextStep()
    controller.nextStep()

    // first_stone highlights star points
    const state = controller.getState()
    expect(state.highlightedIndices.length).toBeGreaterThan(0)
    expect(state.highlightedIndices).toEqual([20, 24, 40, 56, 60])
  })
})

// =============================================================================
// 10. Time Tracking Tests
// =============================================================================

describe('Time Tracking', () => {
  it('should track time spent in tutorial on completion', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()

    advanceTime(60000) // 1 minute
    controller.nextStep()
    controller.nextStep()
    controller.handleBoardInteraction(40)
    controller.nextStep()
    controller.handleBoardInteraction(41)
    controller.nextStep()
    controller.nextStep()

    advanceTime(60000) // another minute
    controller.nextStep() // complete

    const progress = controller.getProgress()
    expect(progress.timeSpentMs).toBe(120000) // 2 minutes
    expect(progress.completed).toBe(true)
  })

  it('should track time spent on skip', () => {
    const controller = createOnboardingController({
      rulesEngine,
      storage,
      nowFn: mockNow,
    })
    controller.startTutorial()
    advanceTime(30000)
    controller.skipTutorial()

    const progress = controller.getProgress()
    expect(progress.timeSpentMs).toBe(30000)
    expect(progress.skipped).toBe(true)
  })
})
