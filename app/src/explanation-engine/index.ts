// =============================================================================
// Module: explanation-engine — Public API Barrel Export
// =============================================================================
// Layer 3 (Application)
// Purpose: Template matching, 3-tier explanation generation, pattern catalog.
//          Implements IExplanationEngine interface from core/interfaces.ts.
// Dependencies: core, katago-bridge
//
// Implemented by: Step 13 (template-engineer)
// Consumers: features/quick-go (post-game review)
// =============================================================================

// --- Coverage ---
export { CoverageTracker, measureCoverage } from './coverage'
// --- Main Engine ---
export { createExplanationEngine, ExplanationEngine } from './explanation-engine'
// --- Mandatory Fallback ---
export {
  getMandatoryCategories,
  isMandatoryCategory,
  validateMandatoryEnforcement,
} from './fallback'
// --- Output Parser ---
export { classifyMoveQuality, detectGamePhase, parseAnalysis } from './output-parser'
// --- Pattern Matcher ---
export { findAllMatchingPatterns, findBestPattern } from './pattern-matcher'
// --- Pattern Catalog ---
export { PATTERN_CATALOG } from './patterns'
// --- Template Engine ---
export { renderTemplate } from './template-engine'

// --- Types ---
export type {
  CoverageResult,
  InternalPattern,
  InternalTriggerCondition,
  ParsedAnalysis,
  PatternMatchResult,
  SlotDefinition,
  SlotFormat,
} from './types'
export { getAssessmentLabel } from './types'
