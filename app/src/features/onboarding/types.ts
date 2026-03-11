// =============================================================================
// features/onboarding/types.ts — Interactive Tutorial Type Definitions
// =============================================================================
// All types for the Zero-to-First-Game onboarding tutorial.
// Internal to the feature module. External types from @core/interfaces.
//
// Design: Anonymous-first, localStorage-persisted, ~5 minute completion target.
// =============================================================================

import type { BoardSize, CellState, Player } from '@core/interfaces'

// ---------------------------------------------------------------------------
// Tutorial Step Definitions
// ---------------------------------------------------------------------------

/**
 * Tutorial step identifiers in order.
 * Each step maps to one screen/interaction in the onboarding flow.
 *
 * Flow:
 *   welcome -> rules_explanation -> first_stone -> capture_experience
 *   -> quick_go_transition -> ai_explanation_demo -> complete
 */
export type TutorialStepId =
  | 'welcome'
  | 'rules_explanation'
  | 'first_stone'
  | 'capture_experience'
  | 'quick_go_transition'
  | 'ai_explanation_demo'
  | 'complete'

/** Ordered list of all tutorial step IDs */
export const TUTORIAL_STEPS: readonly TutorialStepId[] = [
  'welcome',
  'rules_explanation',
  'first_stone',
  'capture_experience',
  'quick_go_transition',
  'ai_explanation_demo',
  'complete',
] as const

/** Number of interactive steps (excludes 'complete') */
export const INTERACTIVE_STEP_COUNT = TUTORIAL_STEPS.length - 1

/**
 * Content for a single tutorial step.
 * Pure data, no React — the UI layer reads this to render.
 */
export interface TutorialStepContent {
  /** Step identifier */
  readonly id: TutorialStepId
  /** Display title */
  readonly title: string
  /** Short subtitle */
  readonly subtitle: string
  /** Main description text */
  readonly description: string
  /** Whether this step requires user interaction to advance */
  readonly requiresInteraction: boolean
  /** Hint text shown if the user is stuck (null if no hint) */
  readonly hint: string | null
}

/** Map of all tutorial step content */
export const TUTORIAL_CONTENT: Readonly<Record<TutorialStepId, TutorialStepContent>> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome to Baduk',
    subtitle: 'The ancient game of Go',
    description:
      'Go (Baduk) is a 2500-year-old strategy game. Two players place black and white stones on a grid, competing to surround the most territory. Simple rules, infinite depth.',
    requiresInteraction: false,
    hint: null,
  },
  rules_explanation: {
    id: 'rules_explanation',
    title: 'The Basic Rules',
    subtitle: 'Three things to know',
    description:
      'Rule 1: Players alternate placing stones on empty intersections. Rule 2: A group of stones with no liberties (empty neighbors) is captured and removed. Rule 3: The player who controls the most territory wins.',
    requiresInteraction: false,
    hint: null,
  },
  first_stone: {
    id: 'first_stone',
    title: 'Place Your First Stone',
    subtitle: 'Tap any intersection',
    description:
      'Tap anywhere on the board to place a black stone. In Go, Black always moves first.',
    requiresInteraction: true,
    hint: 'Tap any empty intersection on the board to place a stone.',
  },
  capture_experience: {
    id: 'capture_experience',
    title: 'Capture a Stone',
    subtitle: 'Surround to capture',
    description:
      'The white stone in the center has only one liberty (empty neighbor) left. Place your black stone on the highlighted intersection to capture it!',
    requiresInteraction: true,
    hint: 'Place your stone on the flashing intersection to complete the capture.',
  },
  quick_go_transition: {
    id: 'quick_go_transition',
    title: 'Ready for Quick Go!',
    subtitle: 'Your first real game',
    description:
      'You know the basics! Quick Go is a 9x9 game that takes about 3 minutes. Our AI opponent will match your level. Ready to play?',
    requiresInteraction: false,
    hint: null,
  },
  ai_explanation_demo: {
    id: 'ai_explanation_demo',
    title: 'AI Analysis Demo',
    subtitle: 'Learn from every game',
    description:
      'After each game, our AI analyzes your moves and explains what happened. Here is an example: "Your move at C5 was a strong territorial claim, securing the left side of the board."',
    requiresInteraction: false,
    hint: null,
  },
  complete: {
    id: 'complete',
    title: 'Tutorial Complete!',
    subtitle: 'Time to play',
    description: 'You are ready to start your first Quick Go game. Good luck!',
    requiresInteraction: false,
    hint: null,
  },
} as const

// ---------------------------------------------------------------------------
// Board Scenario (for interactive steps)
// ---------------------------------------------------------------------------

/**
 * A pre-configured board scenario for interactive tutorial steps.
 * The board is represented as a flat 1D array matching the rules engine convention.
 */
export interface BoardScenario {
  /** Board size */
  readonly boardSize: BoardSize
  /** Initial board state: flat array, index = row * size + col */
  readonly initialBoard: readonly CellState[]
  /** Which player moves next */
  readonly playerToMove: Player
  /** Target indices the user should play on (null = any legal move) */
  readonly targetIndices: readonly number[] | null
  /** Indices to highlight on the board (visual hint) */
  readonly highlightIndices: readonly number[]
  /** Expected captures after the target move (board indices) */
  readonly expectedCaptures: readonly number[]
  /** Description of what happens after the move */
  readonly successMessage: string
}

// ---------------------------------------------------------------------------
// Tutorial Progress (localStorage-persisted)
// ---------------------------------------------------------------------------

/** Key used for localStorage persistence */
export const ONBOARDING_STORAGE_KEY = 'baduk_onboarding_progress'

/**
 * Persisted tutorial progress.
 * Saved to localStorage after each step completion.
 */
export interface OnboardingProgress {
  /** Last completed step ID (null if tutorial not started) */
  lastCompletedStep: TutorialStepId | null
  /** Whether the full tutorial was completed */
  completed: boolean
  /** Whether the user explicitly skipped the tutorial */
  skipped: boolean
  /** Timestamp when tutorial was started (ISO string) */
  startedAt: string | null
  /** Timestamp when tutorial was completed/skipped (ISO string) */
  finishedAt: string | null
  /** Total time spent in tutorial in milliseconds */
  timeSpentMs: number
  /** Number of times the tutorial was restarted */
  restartCount: number
}

/** Default progress for a fresh user */
export const DEFAULT_ONBOARDING_PROGRESS: OnboardingProgress = {
  lastCompletedStep: null,
  completed: false,
  skipped: false,
  startedAt: null,
  finishedAt: null,
  timeSpentMs: 0,
  restartCount: 0,
}

// ---------------------------------------------------------------------------
// Analytics Events
// ---------------------------------------------------------------------------

/** Analytics event types emitted during onboarding */
export type OnboardingAnalyticsEventType =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'onboarding_skipped'
  | 'onboarding_time_spent'

/** Analytics event payload */
export interface OnboardingAnalyticsEvent {
  readonly type: OnboardingAnalyticsEventType
  readonly timestamp: number
  readonly data: Readonly<Record<string, string | number | boolean>>
}

// ---------------------------------------------------------------------------
// Controller State
// ---------------------------------------------------------------------------

/**
 * Complete onboarding controller state.
 * Exposed via Zustand store for the UI layer.
 */
export interface OnboardingState {
  /** Current tutorial step */
  currentStep: TutorialStepId
  /** Current step index (0-based) */
  currentStepIndex: number
  /** Content for the current step */
  currentContent: TutorialStepContent
  /** Board scenario for the current step (null if non-interactive) */
  currentScenario: BoardScenario | null
  /** Current board state (flat array) for interactive steps */
  boardState: readonly CellState[] | null
  /** Whether the current step's interaction requirement is satisfied */
  interactionComplete: boolean
  /** Whether the full tutorial is complete */
  tutorialComplete: boolean
  /** Whether the tutorial was skipped */
  tutorialSkipped: boolean
  /** Progress data */
  progress: OnboardingProgress
  /** All emitted analytics events (for testing/debugging) */
  analyticsEvents: readonly OnboardingAnalyticsEvent[]
  /** Indices to highlight on the board */
  highlightedIndices: readonly number[]
  /** Captured stone indices from the last move */
  lastCaptures: readonly number[]
  /** Success message shown after completing an interactive step */
  successMessage: string | null
}

// ---------------------------------------------------------------------------
// Controller Actions
// ---------------------------------------------------------------------------

/** Onboarding controller actions */
export interface OnboardingActions {
  /** Start the tutorial from the beginning */
  startTutorial(): void
  /** Advance to the next step (must satisfy interaction requirement first) */
  nextStep(): boolean
  /** Go back to the previous step */
  previousStep(): boolean
  /** Skip the entire tutorial */
  skipTutorial(): void
  /** Restart the tutorial from the beginning */
  restartTutorial(): void
  /** Resume the tutorial from the last saved position */
  resumeTutorial(): void
  /** Handle a board interaction (stone placement) at the given index */
  handleBoardInteraction(index: number): boolean
  /** Get the analytics events log */
  getAnalyticsEvents(): readonly OnboardingAnalyticsEvent[]
  /** Reset all state (including persisted progress) */
  reset(): void
}

/** Combined onboarding store type */
export type OnboardingStore = OnboardingState & OnboardingActions
