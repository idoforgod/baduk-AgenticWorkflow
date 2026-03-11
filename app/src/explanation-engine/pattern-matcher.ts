// =============================================================================
// Module: explanation-engine/pattern-matcher — Pattern Matching Pipeline
// =============================================================================
// Matches parsed KataGo data against the pattern catalog using the 6-level
// priority chain from Step 4 Section 4.1.
//
// Priority chain (first match wins):
//   1. Mandatory Fallback (life/death, ko, seki)
//   2. Move Quality (blunder/mistake/inaccuracy/brilliant/excellent/good/acceptable)
//   3. Position Assessment (decisive/strong/even/disadvantage)
//   4. Game Phase (opening/middle/endgame)
//   5. Alternative Moves
//   6. Generic Fallback
// =============================================================================

import type { PositionCategory, Tier } from '@core/interfaces'
import { PATTERN_CATALOG } from './patterns'
import type {
  InternalPattern,
  InternalTriggerCondition,
  ParsedAnalysis,
  PatternMatchResult,
} from './types'

// =============================================================================
// Priority Assignment
// =============================================================================

const CATEGORY_PRIORITY: Record<string, number> = {
  life_death: 1,
  ko: 1,
  seki: 1,
  move_quality: 2,
  position: 3,
  opening: 4,
  middle_game: 4,
  endgame: 4,
  alternative: 5,
  generic: 6,
}

// =============================================================================
// Condition Evaluation
// =============================================================================

/**
 * Resolve a field reference to its value from the parsed analysis.
 */
function resolveField(
  field: string,
  parsed: ParsedAnalysis,
  categoryHint: PositionCategory | null
): number | string | null {
  // Special fields
  if (field === 'winrateDelta') return parsed.computed.winrateDelta
  if (field === 'moveRank') return parsed.computed.moveRank
  if (field === 'topMoveGap') return parsed.computed.topMoveGap
  if (field === 'movePhase') return parsed.computed.movePhase
  if (field === 'category') return categoryHint
  if (field === 'ko_value') return parsed.koValue

  // rootInfo fields
  if (field === 'rootInfo.winrate') return parsed.raw.rootInfo.winrate
  if (field === 'rootInfo.scoreLead') return parsed.raw.rootInfo.scoreLead
  if (field === 'rootInfo.visits') return parsed.raw.rootInfo.visits

  // moveInfos fields
  const moveInfoMatch = field.match(/^moveInfos\[(\d+)]\.(.+)$/)
  if (moveInfoMatch) {
    const idx = Number.parseInt(moveInfoMatch[1], 10)
    const prop = moveInfoMatch[2]
    const moveInfo = parsed.raw.moveInfos[idx]
    if (!moveInfo) return null
    if (prop === 'prior') return moveInfo.prior
    if (prop === 'visits') return moveInfo.visits
    if (prop === 'winrate') return moveInfo.winrate
    if (prop === 'scoreLead') return moveInfo.scoreLead
    if (prop === 'move') return moveInfo.move
    if (prop === 'lcb') return moveInfo.lcb
    if (prop === 'utility') return moveInfo.utility
    if (prop === 'order') return moveInfo.order
  }

  // group_ownership — not available in V1 (no board-level ownership tracking)
  if (field === 'group_ownership') return null

  return null
}

/**
 * Evaluate a single trigger condition.
 */
function evaluateCondition(
  condition: InternalTriggerCondition,
  parsed: ParsedAnalysis,
  categoryHint: PositionCategory | null
): boolean {
  const fieldValue = resolveField(condition.field, parsed, categoryHint)

  // If field is null and we need it, condition fails
  if (fieldValue === null || fieldValue === undefined) return false

  const { operator, value } = condition

  switch (operator) {
    case '<':
      return typeof fieldValue === 'number' && fieldValue < (value as number)
    case '>':
      return typeof fieldValue === 'number' && fieldValue > (value as number)
    case '<=':
      return typeof fieldValue === 'number' && fieldValue <= (value as number)
    case '>=':
      return typeof fieldValue === 'number' && fieldValue >= (value as number)
    case '==':
      return fieldValue === value
    case '!=':
      return fieldValue !== value
    case 'in':
      return Array.isArray(value) && (value as readonly number[]).includes(fieldValue as number)
    case 'between':
      if (Array.isArray(value) && value.length === 2 && typeof fieldValue === 'number') {
        return fieldValue >= (value[0] as number) && fieldValue <= (value[1] as number)
      }
      return false
    default:
      return false
  }
}

/**
 * Check if all trigger conditions for a pattern match.
 */
function evaluateTrigger(
  pattern: InternalPattern,
  parsed: ParsedAnalysis,
  categoryHint: PositionCategory | null
): boolean {
  // Check delta requirement
  if (pattern.trigger.requiresDelta && parsed.computed.winrateDelta === null) {
    return false
  }

  // Empty conditions = always match (generic fallback)
  if (pattern.trigger.conditions.length === 0) return true

  // All conditions must be true (AND logic)
  return pattern.trigger.conditions.every((cond) => evaluateCondition(cond, parsed, categoryHint))
}

// =============================================================================
// Main Pattern Matcher
// =============================================================================

/**
 * Find the best matching pattern for a given parsed analysis.
 *
 * Patterns are evaluated in priority order. The first match wins.
 * Patterns are pre-filtered by tier to ensure correct audience level.
 *
 * @param parsed - The parsed analysis data.
 * @param tier - The target audience tier.
 * @param categoryHint - External category classification (life_death, ko, seki, or null).
 * @returns The best matching PatternMatchResult, or null if no pattern matches.
 */
export function findBestPattern(
  parsed: ParsedAnalysis,
  tier: Tier,
  categoryHint: PositionCategory | null
): PatternMatchResult | null {
  // Filter patterns by tier
  const tierPatterns = PATTERN_CATALOG.filter((p) => p.tier === tier)

  // Sort by priority (lower = higher priority)
  const sorted = [...tierPatterns].sort((a, b) => {
    const aPri = CATEGORY_PRIORITY[a.category] ?? 99
    const bPri = CATEGORY_PRIORITY[b.category] ?? 99
    return aPri - bPri
  })

  // Find first matching pattern
  for (const pattern of sorted) {
    if (evaluateTrigger(pattern, parsed, categoryHint)) {
      return {
        patternId: pattern.id,
        category: pattern.category,
        isMandatory: pattern.mandatory,
        templateText: pattern.template.text,
        slots: pattern.template.slots,
        priority: CATEGORY_PRIORITY[pattern.category] ?? 99,
      }
    }
  }

  return null
}

/**
 * Find all matching patterns for a position (for composition).
 * Returns up to maxPatterns matches sorted by priority.
 */
export function findAllMatchingPatterns(
  parsed: ParsedAnalysis,
  tier: Tier,
  categoryHint: PositionCategory | null,
  maxPatterns: number = 3
): PatternMatchResult[] {
  const tierPatterns = PATTERN_CATALOG.filter((p) => p.tier === tier)
  const results: PatternMatchResult[] = []
  const seenCategories = new Set<string>()

  const sorted = [...tierPatterns].sort((a, b) => {
    const aPri = CATEGORY_PRIORITY[a.category] ?? 99
    const bPri = CATEGORY_PRIORITY[b.category] ?? 99
    return aPri - bPri
  })

  for (const pattern of sorted) {
    if (results.length >= maxPatterns) break
    // Only one match per category (avoid duplicates)
    if (seenCategories.has(pattern.category)) continue

    if (evaluateTrigger(pattern, parsed, categoryHint)) {
      results.push({
        patternId: pattern.id,
        category: pattern.category,
        isMandatory: pattern.mandatory,
        templateText: pattern.template.text,
        slots: pattern.template.slots,
        priority: CATEGORY_PRIORITY[pattern.category] ?? 99,
      })
      seenCategories.add(pattern.category)
    }
  }

  return results
}
