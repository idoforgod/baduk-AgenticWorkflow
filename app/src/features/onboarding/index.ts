// =============================================================================
// features/onboarding/index.ts — Barrel Exports
// =============================================================================

export type { OnboardingDependencies, StorageAdapter } from './OnboardingController'
// --- Controller ---
export { createOnboardingController, OnboardingController } from './OnboardingController'
// --- Store ---
export { configureOnboardingStore, useOnboardingStore } from './OnboardingStore'
// --- Scenarios ---
export {
  createCaptureScenario,
  createCornerCaptureScenario,
  createMultiCaptureScenario,
  FIRST_STONE_SCENARIO,
  getScenarioForStep,
} from './TutorialScenarios'
// --- Types ---
export type {
  BoardScenario,
  OnboardingActions,
  OnboardingAnalyticsEvent,
  OnboardingAnalyticsEventType,
  OnboardingProgress,
  OnboardingState,
  OnboardingStore,
  TutorialStepContent,
  TutorialStepId,
} from './types'
export {
  DEFAULT_ONBOARDING_PROGRESS,
  INTERACTIVE_STEP_COUNT,
  ONBOARDING_STORAGE_KEY,
  TUTORIAL_CONTENT,
  TUTORIAL_STEPS,
} from './types'
