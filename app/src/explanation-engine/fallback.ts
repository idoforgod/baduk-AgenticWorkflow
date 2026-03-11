// =============================================================================
// Module: explanation-engine/fallback — Mandatory Fallback System
// =============================================================================
// L2 Category Lock: Life/death, ko, seki positions use MANDATORY pre-authored
// templates. The LLM is NEVER invoked for these categories.
//
// This module provides the structural enforcement mechanism described in
// Step 4 Section 6.5. The code makes it structurally impossible to bypass
// mandatory templates for high-risk position categories.
//
// SAFETY INVARIANT:
//   isMandatoryCategory() returning true means renderMandatoryTemplate()
//   MUST be called. There is no code path that allows LLM generation for
//   these categories.
// =============================================================================

import type { PositionCategory } from '@core/interfaces'

// =============================================================================
// Mandatory Category Check
// =============================================================================

/**
 * The set of position categories that MUST use pre-authored templates.
 * This set is a compile-time constant — it cannot be modified at runtime.
 */
const MANDATORY_CATEGORIES: ReadonlySet<PositionCategory> = new Set([
  'life_death',
  'ko',
  'seki',
] as const)

/**
 * Check if a position category requires mandatory pre-authored templates.
 *
 * When this returns true, the explanation engine MUST use a pre-authored
 * template from the pattern catalog. The LLM MUST NOT be invoked.
 *
 * @param category - The position category to check.
 * @returns true if the category requires mandatory templates.
 */
export function isMandatoryCategory(category: PositionCategory | null): boolean {
  if (category === null) return false
  return MANDATORY_CATEGORIES.has(category)
}

/**
 * Get all mandatory category values.
 * Useful for testing and validation.
 */
export function getMandatoryCategories(): readonly PositionCategory[] {
  return [...MANDATORY_CATEGORIES]
}

/**
 * Validate that a given explanation result correctly respects mandatory
 * template enforcement. Used in L3 validation and testing.
 *
 * @param category - The position category.
 * @param usedLLMFallback - Whether LLM fallback was used.
 * @returns true if the enforcement is correct, false if violated.
 */
export function validateMandatoryEnforcement(
  category: PositionCategory | null,
  usedLLMFallback: boolean
): boolean {
  if (isMandatoryCategory(category) && usedLLMFallback) {
    // CRITICAL: LLM was used for a mandatory category — this is a safety violation
    return false
  }
  return true
}
