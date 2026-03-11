// =============================================================================
// features/onboarding/OnboardingController.ts — Tutorial State Machine
// =============================================================================
// Orchestrates the interactive onboarding tutorial flow.
// Pure TypeScript — no React dependency. Testable in isolation.
//
// State machine:
//   welcome -> rules_explanation -> first_stone -> capture_experience
//   -> quick_go_transition -> ai_explanation_demo -> complete
//
// DI: Accepts IRulesEngine for move validation in interactive steps.
// Persistence: Saves progress to localStorage after each transition.
// Analytics: Emits events for tracking completion rates.
// =============================================================================

import type { BoardSize, CellState, GameState, IRulesEngine } from '@core/interfaces'
import { getScenarioForStep } from './TutorialScenarios'
import type {
  BoardScenario,
  OnboardingAnalyticsEvent,
  OnboardingAnalyticsEventType,
  OnboardingProgress,
  OnboardingState,
  TutorialStepId,
} from './types'
import {
  DEFAULT_ONBOARDING_PROGRESS,
  INTERACTIVE_STEP_COUNT,
  ONBOARDING_STORAGE_KEY,
  TUTORIAL_CONTENT,
  TUTORIAL_STEPS,
} from './types'

// ---------------------------------------------------------------------------
// Storage Adapter (abstracted for testability)
// ---------------------------------------------------------------------------

export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Default adapter uses window.localStorage */
function createDefaultStorage(): StorageAdapter {
  return {
    getItem: (key) => {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Silently fail — localStorage may be unavailable
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key)
      } catch {
        // Silently fail
      }
    },
  }
}

// ---------------------------------------------------------------------------
// OnboardingController
// ---------------------------------------------------------------------------

export interface OnboardingDependencies {
  rulesEngine: IRulesEngine
  storage?: StorageAdapter
  /** Override Date.now for testing */
  nowFn?: () => number
}

/**
 * OnboardingController manages the tutorial state machine.
 *
 * Usage:
 *   const controller = new OnboardingController({ rulesEngine })
 *   controller.startTutorial()
 *   controller.nextStep()
 *   controller.handleBoardInteraction(41) // place stone
 *   controller.nextStep()
 *   // ...
 */
export class OnboardingController {
  private deps: OnboardingDependencies
  private storage: StorageAdapter
  private nowFn: () => number

  private currentStepIndex = 0
  private interactionComplete = false
  private tutorialComplete = false
  private tutorialSkipped = false
  private progress: OnboardingProgress = { ...DEFAULT_ONBOARDING_PROGRESS }
  private analyticsEvents: OnboardingAnalyticsEvent[] = []
  private boardState: CellState[] | null = null
  private currentScenario: BoardScenario | null = null
  private lastCaptures: number[] = []
  private successMessage: string | null = null
  private startTimestamp: number | null = null

  constructor(deps: OnboardingDependencies) {
    this.deps = deps
    this.storage = deps.storage ?? createDefaultStorage()
    this.nowFn = deps.nowFn ?? (() => Date.now())
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  getCurrentStep(): TutorialStepId {
    const step = TUTORIAL_STEPS[this.currentStepIndex]
    return step ?? 'complete'
  }

  getCurrentStepIndex(): number {
    return this.currentStepIndex
  }

  getState(): OnboardingState {
    const stepId = this.getCurrentStep()
    const content = TUTORIAL_CONTENT[stepId]
    return {
      currentStep: stepId,
      currentStepIndex: this.currentStepIndex,
      currentContent: content,
      currentScenario: this.currentScenario,
      boardState: this.boardState,
      interactionComplete: this.interactionComplete,
      tutorialComplete: this.tutorialComplete,
      tutorialSkipped: this.tutorialSkipped,
      progress: { ...this.progress },
      analyticsEvents: [...this.analyticsEvents],
      highlightedIndices: this.currentScenario?.highlightIndices ?? [],
      lastCaptures: [...this.lastCaptures],
      successMessage: this.successMessage,
    }
  }

  isInteractionComplete(): boolean {
    return this.interactionComplete
  }

  isTutorialComplete(): boolean {
    return this.tutorialComplete
  }

  isTutorialSkipped(): boolean {
    return this.tutorialSkipped
  }

  getProgress(): OnboardingProgress {
    return { ...this.progress }
  }

  getAnalyticsEvents(): readonly OnboardingAnalyticsEvent[] {
    return [...this.analyticsEvents]
  }

  // -------------------------------------------------------------------------
  // Lifecycle: Start
  // -------------------------------------------------------------------------

  /**
   * Start the tutorial from the beginning.
   * Resets all state and emits onboarding_started event.
   */
  startTutorial(): void {
    this.currentStepIndex = 0
    this.interactionComplete = false
    this.tutorialComplete = false
    this.tutorialSkipped = false
    this.lastCaptures = []
    this.successMessage = null
    this.startTimestamp = this.nowFn()

    this.progress = {
      ...DEFAULT_ONBOARDING_PROGRESS,
      startedAt: new Date(this.startTimestamp).toISOString(),
    }

    this.emitEvent('onboarding_started', {})
    this.loadScenarioForCurrentStep()
    this.persistProgress()
  }

  // -------------------------------------------------------------------------
  // Lifecycle: Resume
  // -------------------------------------------------------------------------

  /**
   * Resume the tutorial from the last saved position.
   * Loads progress from localStorage and sets the current step.
   */
  resumeTutorial(): void {
    const saved = this.loadProgress()
    if (saved === null || saved.completed || saved.skipped) {
      // No progress to resume, start fresh
      this.startTutorial()
      return
    }

    this.progress = saved
    this.startTimestamp = this.nowFn()

    if (saved.lastCompletedStep !== null) {
      const completedIndex = TUTORIAL_STEPS.indexOf(saved.lastCompletedStep)
      if (completedIndex >= 0 && completedIndex < TUTORIAL_STEPS.length - 1) {
        this.currentStepIndex = completedIndex + 1
      } else {
        this.currentStepIndex = 0
      }
    } else {
      this.currentStepIndex = 0
    }

    this.interactionComplete = false
    this.tutorialComplete = false
    this.tutorialSkipped = false
    this.lastCaptures = []
    this.successMessage = null
    this.loadScenarioForCurrentStep()
  }

  // -------------------------------------------------------------------------
  // Navigation: Next Step
  // -------------------------------------------------------------------------

  /**
   * Advance to the next step.
   * Returns false if the current step's interaction requirement is not met.
   */
  nextStep(): boolean {
    const stepId = this.getCurrentStep()
    const content = TUTORIAL_CONTENT[stepId]

    // Block advancement if interaction is required but not completed
    if (content.requiresInteraction && !this.interactionComplete) {
      return false
    }

    // Emit step completed event
    this.emitEvent('onboarding_step_completed', {
      step: stepId,
      stepIndex: this.currentStepIndex,
    })

    // Update progress
    this.progress = {
      ...this.progress,
      lastCompletedStep: stepId,
    }

    // Move to next step
    this.currentStepIndex += 1
    this.interactionComplete = false
    this.lastCaptures = []
    this.successMessage = null

    // Check if tutorial is complete
    if (this.currentStepIndex >= TUTORIAL_STEPS.length - 1) {
      this.completeTutorial()
    }

    this.loadScenarioForCurrentStep()
    this.persistProgress()
    return true
  }

  // -------------------------------------------------------------------------
  // Navigation: Previous Step
  // -------------------------------------------------------------------------

  /**
   * Go back to the previous step.
   * Returns false if already at the first step.
   */
  previousStep(): boolean {
    if (this.currentStepIndex <= 0) {
      return false
    }

    this.currentStepIndex -= 1
    this.interactionComplete = false
    this.lastCaptures = []
    this.successMessage = null
    this.loadScenarioForCurrentStep()
    return true
  }

  // -------------------------------------------------------------------------
  // Skip
  // -------------------------------------------------------------------------

  /**
   * Skip the entire tutorial.
   * Marks as skipped in progress and emits analytics event.
   */
  skipTutorial(): void {
    this.tutorialSkipped = true
    const now = this.nowFn()

    const timeSpent =
      this.startTimestamp !== null ? now - this.startTimestamp + this.progress.timeSpentMs : 0

    this.progress = {
      ...this.progress,
      skipped: true,
      finishedAt: new Date(now).toISOString(),
      timeSpentMs: timeSpent,
    }

    this.emitEvent('onboarding_skipped', {
      lastStep: this.getCurrentStep(),
      stepIndex: this.currentStepIndex,
    })
    this.emitEvent('onboarding_time_spent', {
      timeSpentMs: timeSpent,
    })

    this.persistProgress()
  }

  // -------------------------------------------------------------------------
  // Restart
  // -------------------------------------------------------------------------

  /**
   * Restart the tutorial from the beginning.
   * Preserves restart count from progress.
   */
  restartTutorial(): void {
    const restartCount = this.progress.restartCount + 1
    this.startTutorial()
    this.progress = {
      ...this.progress,
      restartCount,
    }
    this.persistProgress()
  }

  // -------------------------------------------------------------------------
  // Board Interaction
  // -------------------------------------------------------------------------

  /**
   * Handle a board interaction (stone placement) at the given index.
   * Returns true if the interaction was valid and accepted.
   */
  handleBoardInteraction(index: number): boolean {
    const stepId = this.getCurrentStep()
    const content = TUTORIAL_CONTENT[stepId]

    // Only interactive steps accept board input
    if (!content.requiresInteraction) {
      return false
    }

    // Already completed
    if (this.interactionComplete) {
      return false
    }

    const scenario = this.currentScenario
    if (scenario === null || this.boardState === null) {
      return false
    }

    // Check if the target indices are specified and if the move matches
    if (scenario.targetIndices !== null) {
      if (!scenario.targetIndices.includes(index)) {
        return false // wrong position
      }
    }

    // Validate the move using the rules engine
    const isValid = this.validateMove(scenario, index)
    if (!isValid) {
      return false
    }

    // Apply the move to the board state
    const newBoard = [...this.boardState]
    const playerColor: CellState = scenario.playerToMove === 'B' ? 1 : 2
    newBoard[index] = playerColor

    // Process captures
    const captures = this.findCapturedStones(newBoard, scenario.boardSize, index, playerColor)
    for (const capturedIndex of captures) {
      newBoard[capturedIndex] = 0
    }

    this.boardState = newBoard
    this.lastCaptures = captures
    this.interactionComplete = true
    this.successMessage = scenario.successMessage

    return true
  }

  // -------------------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------------------

  /**
   * Full reset — clear all state including persisted progress.
   */
  reset(): void {
    this.currentStepIndex = 0
    this.interactionComplete = false
    this.tutorialComplete = false
    this.tutorialSkipped = false
    this.progress = { ...DEFAULT_ONBOARDING_PROGRESS }
    this.analyticsEvents = []
    this.boardState = null
    this.currentScenario = null
    this.lastCaptures = []
    this.successMessage = null
    this.startTimestamp = null
    this.storage.removeItem(ONBOARDING_STORAGE_KEY)
  }

  // -------------------------------------------------------------------------
  // Private: Complete Tutorial
  // -------------------------------------------------------------------------

  private completeTutorial(): void {
    this.tutorialComplete = true
    this.currentStepIndex = TUTORIAL_STEPS.length - 1
    const now = this.nowFn()

    const timeSpent =
      this.startTimestamp !== null ? now - this.startTimestamp + this.progress.timeSpentMs : 0

    this.progress = {
      ...this.progress,
      completed: true,
      finishedAt: new Date(now).toISOString(),
      timeSpentMs: timeSpent,
    }

    this.emitEvent('onboarding_completed', {
      timeSpentMs: timeSpent,
      stepsCompleted: INTERACTIVE_STEP_COUNT,
    })
    this.emitEvent('onboarding_time_spent', {
      timeSpentMs: timeSpent,
    })
  }

  // -------------------------------------------------------------------------
  // Private: Scenario Loading
  // -------------------------------------------------------------------------

  private loadScenarioForCurrentStep(): void {
    const stepId = this.getCurrentStep()
    const scenario = getScenarioForStep(stepId)
    this.currentScenario = scenario

    if (scenario !== null) {
      this.boardState = [...scenario.initialBoard]
    } else {
      this.boardState = null
    }
  }

  // -------------------------------------------------------------------------
  // Private: Move Validation
  // -------------------------------------------------------------------------

  /**
   * Validate a move using the rules engine.
   * Constructs a minimal GameState from the scenario for validation.
   */
  private validateMove(scenario: BoardScenario, index: number): boolean {
    try {
      const gameState = this.buildGameState(scenario)
      return this.deps.rulesEngine.isLegalMove(gameState, index)
    } catch {
      // If rules engine throws (e.g., invalid state), treat as invalid
      return false
    }
  }

  /**
   * Build a GameState suitable for IRulesEngine from a scenario.
   */
  private buildGameState(scenario: BoardScenario): GameState {
    const grid = new Uint8Array(this.boardState ?? scenario.initialBoard)
    const size = scenario.boardSize

    return {
      gameId: 'tutorial',
      config: {
        boardSize: size,
        komi: 6.5,
        rules: 'tromp-taylor',
        mode: 'tutorial',
      },
      board: {
        size,
        grid,
        hash: 0n,
      },
      currentPlayer: scenario.playerToMove,
      moves: [],
      currentMoveIndex: -1,
      phase: 'playing',
      consecutivePasses: 0,
      positionHashes: new Set<bigint>(),
      koPoint: null,
      captures: { black: 0, white: 0 },
      timer: null,
    }
  }

  /**
   * Find captured stones after placing a stone.
   * Simple flood-fill implementation for tutorial contexts.
   */
  private findCapturedStones(
    board: CellState[],
    size: BoardSize,
    placedIndex: number,
    placedColor: CellState
  ): number[] {
    const opponentColor: CellState = placedColor === 1 ? 2 : 1
    const captured: number[] = []
    const visited = new Set<number>()

    // Check each neighbor of the placed stone
    const neighbors = this.getNeighbors(placedIndex, size)
    for (const neighbor of neighbors) {
      if (board[neighbor] === opponentColor && !visited.has(neighbor)) {
        const group = this.floodFillGroup(board, size, neighbor, opponentColor)
        for (const stone of group) {
          visited.add(stone)
        }
        // Check if this group has any liberties
        const hasLiberty = this.groupHasLiberties(board, size, group)
        if (!hasLiberty) {
          for (const stone of group) {
            captured.push(stone)
          }
        }
      }
    }

    return captured
  }

  private getNeighbors(index: number, size: BoardSize): number[] {
    const row = Math.floor(index / size)
    const col = index % size
    const result: number[] = []

    if (row > 0) result.push(index - size) // up
    if (row < size - 1) result.push(index + size) // down
    if (col > 0) result.push(index - 1) // left
    if (col < size - 1) result.push(index + 1) // right

    return result
  }

  private floodFillGroup(
    board: readonly CellState[],
    size: BoardSize,
    start: number,
    color: CellState
  ): number[] {
    const group: number[] = []
    const visited = new Set<number>()
    const stack = [start]

    while (stack.length > 0) {
      const current = stack.pop()
      if (current === undefined) break
      if (visited.has(current)) continue

      const cellColor = board[current]
      if (cellColor !== color) continue

      visited.add(current)
      group.push(current)

      const neighbors = this.getNeighbors(current, size)
      for (const n of neighbors) {
        if (!visited.has(n)) {
          stack.push(n)
        }
      }
    }

    return group
  }

  private groupHasLiberties(
    board: readonly CellState[],
    size: BoardSize,
    group: readonly number[]
  ): boolean {
    for (const stone of group) {
      const neighbors = this.getNeighbors(stone, size)
      for (const n of neighbors) {
        if (board[n] === 0) {
          return true
        }
      }
    }
    return false
  }

  // -------------------------------------------------------------------------
  // Private: Analytics
  // -------------------------------------------------------------------------

  private emitEvent(
    type: OnboardingAnalyticsEventType,
    data: Record<string, string | number | boolean>
  ): void {
    this.analyticsEvents.push({
      type,
      timestamp: this.nowFn(),
      data,
    })
  }

  // -------------------------------------------------------------------------
  // Private: Persistence
  // -------------------------------------------------------------------------

  private persistProgress(): void {
    try {
      this.storage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(this.progress))
    } catch {
      // Silently fail — localStorage may be full or unavailable
    }
  }

  private loadProgress(): OnboardingProgress | null {
    try {
      const raw = this.storage.getItem(ONBOARDING_STORAGE_KEY)
      if (raw === null) return null
      return JSON.parse(raw) as OnboardingProgress
    } catch {
      return null
    }
  }
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Create a new OnboardingController with the given dependencies.
 */
export function createOnboardingController(deps: OnboardingDependencies): OnboardingController {
  return new OnboardingController(deps)
}
