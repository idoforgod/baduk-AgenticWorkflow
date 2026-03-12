// =============================================================================
// coaching/index.ts — Module Barrel Export
// =============================================================================
// Public API for the coaching module.
// =============================================================================

// Engine
export { generateCoachingMessage, transitionEncouragementFSM } from './coaching-adapter'
// Templates
export {
  COACHING_CATALOG,
  MOMENTUM_SUFFIXES,
  RECOVERY_SUFFIXES,
  STREAK_SUFFIXES,
} from './coaching-templates'
// Classification
export {
  classifySpatial,
  classifyTacticalSituation,
  computeAdjacentGroups,
} from './strategic-classifier'
// Types
export type {
  CoachingEmotion,
  CoachingMessage,
  CoachingTemplate,
  EncouragementState,
  PlayerContext,
  SituationTemplates,
  SlotValues,
  TacticalSituation,
} from './types'
