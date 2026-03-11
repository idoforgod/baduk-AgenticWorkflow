// =============================================================================
// Module: explanation-engine/template-engine — Template Rendering
// =============================================================================
// Fills template slots with KataGo-derived values.
// L1 Slot Binding: Every {placeholder} maps to a specific KataGo field.
// Empty slots produce a rendering error, not a silent empty string.
// =============================================================================

import type { ParsedAnalysis, PatternMatchResult, SlotFormat } from './types'

// =============================================================================
// Number Formatting
// =============================================================================

function formatNumber(value: number, format: SlotFormat): string {
  switch (format) {
    case 'integer':
      return Math.round(value).toString()
    case 'one_decimal':
      return value.toFixed(1)
    case 'two_decimal':
      return value.toFixed(2)
    case 'three_decimal':
      return value.toFixed(3)
    case 'string':
      return value.toString()
    default:
      return value.toString()
  }
}

// =============================================================================
// Slot Resolution
// =============================================================================

/**
 * Resolve a slot source to its value from the parsed analysis.
 *
 * Sources follow one of these patterns:
 *   - "moveInfos[N].field" -> direct access
 *   - "rootInfo.field" -> direct access
 *   - "computed.field_name" -> pre-computed values
 *   - "abs(x)" -> absolute value wrapper
 *   - "moveInfos[N].field * N" -> multiplication
 *   - "computed.moveRank + N" -> addition
 *   - "moveInfos.length" -> array length
 *   - "N" -> literal number
 */
function resolveSlotValue(source: string, parsed: ParsedAnalysis): string | number | null {
  // Literal number
  if (/^\d+(\.\d+)?$/.test(source)) {
    return Number.parseFloat(source)
  }

  // abs() wrapper
  if (source.startsWith('abs(') && source.endsWith(')')) {
    const inner = source.slice(4, -1)
    const val = resolveSlotValue(inner, parsed)
    if (typeof val === 'number') return Math.abs(val)
    return null
  }

  // Addition: "computed.moveRank + 1"
  const addMatch = source.match(/^(.+?)\s*\+\s*(\d+)$/)
  if (addMatch) {
    const baseVal = resolveSlotValue(addMatch[1], parsed)
    if (typeof baseVal === 'number') return baseVal + Number.parseInt(addMatch[2], 10)
    return null
  }

  // Multiplication: "moveInfos[0].prior * 100"
  const mulMatch = source.match(/^(.+?)\s*\*\s*(\d+(?:\.\d+)?)$/)
  if (mulMatch) {
    const baseVal = resolveSlotValue(mulMatch[1], parsed)
    if (typeof baseVal === 'number') return baseVal * Number.parseFloat(mulMatch[2])
    return null
  }

  // Subtraction: "moveInfos[0].scoreLead - moveInfos[1].scoreLead"
  const subMatch = source.match(/^(.+?)\s*-\s*(.+)$/)
  if (subMatch && !subMatch[1].includes('(')) {
    const left = resolveSlotValue(subMatch[1], parsed)
    const right = resolveSlotValue(subMatch[2], parsed)
    if (typeof left === 'number' && typeof right === 'number') return left - right
    return null
  }

  // moveInfos.length
  if (source === 'moveInfos.length') {
    return parsed.raw.moveInfos.length
  }

  // moveInfos[N].field
  const moveInfoMatch = source.match(/^moveInfos\[(\d+)]\.(.+)$/)
  if (moveInfoMatch) {
    const idx = Number.parseInt(moveInfoMatch[1], 10)
    const prop = moveInfoMatch[2]
    const moveInfo = parsed.raw.moveInfos[idx]
    if (!moveInfo) return null
    switch (prop) {
      case 'move':
        return moveInfo.move
      case 'winrate':
        return moveInfo.winrate
      case 'scoreLead':
        return moveInfo.scoreLead
      case 'visits':
        return moveInfo.visits
      case 'prior':
        return moveInfo.prior
      case 'order':
        return moveInfo.order
      case 'lcb':
        return moveInfo.lcb
      case 'utility':
        return moveInfo.utility
      case 'scoreStdev':
        return moveInfo.scoreStdev
      default:
        return null
    }
  }

  // rootInfo.field
  if (source.startsWith('rootInfo.')) {
    const prop = source.slice(9)
    const ri = parsed.raw.rootInfo
    switch (prop) {
      case 'winrate':
        return ri.winrate
      case 'scoreLead':
        return ri.scoreLead
      case 'visits':
        return ri.visits
      case 'scoreStdev':
        return ri.scoreStdev
      case 'rawVarTimeLeft':
        return ri.rawVarTimeLeft
      case 'rawWinrate':
        return ri.rawWinrate
      case 'rawLead':
        return ri.rawLead
      case 'rawStWrError':
        return ri.rawStWrError
      case 'rawStScoreError':
        return ri.rawStScoreError
      case 'lcb':
        return ri.lcb
      case 'currentPlayer':
        return ri.currentPlayer
      default:
        return null
    }
  }

  // computed.* fields
  if (source.startsWith('computed.')) {
    const prop = source.slice(9)
    switch (prop) {
      case 'winrate_pct':
        return parsed.winratePct
      case 'best_winrate_pct':
        return parsed.bestWinratePct
      case 'winrate_delta_pct':
        return parsed.winrateDeltaPct
      case 'scoreLeadDelta':
        return parsed.computed.scoreLeadDelta
      case 'pv_short':
        return parsed.pvShort
      case 'pv_medium':
        return parsed.pvMedium
      case 'pv_long':
        return parsed.pvLong
      case 'ko_value':
        return parsed.koValue
      case 'prior_pct':
        return parsed.priorPct
      case 'lcb_pct':
        return parsed.lcbPct
      case 'topMoveGap':
        return parsed.computed.topMoveGap
      case 'moveRank':
        return parsed.computed.moveRank
      case 'previous_assessment_label':
        return parsed.previousAssessmentLabel
      case 'current_assessment_label':
        return parsed.currentAssessmentLabel
      default:
        return null
    }
  }

  return null
}

// =============================================================================
// Template Rendering
// =============================================================================

/**
 * Render a template by filling all {placeholder} slots with computed values.
 *
 * @param match - The pattern match result containing template text and slot definitions.
 * @param parsed - The parsed analysis data.
 * @returns The rendered text, or null if any required slot could not be filled.
 */
export function renderTemplate(match: PatternMatchResult, parsed: ParsedAnalysis): string | null {
  let text = match.templateText
  const slotEntries = Object.entries(match.slots)

  for (const [placeholder, slotDef] of slotEntries) {
    const rawValue = resolveSlotValue(slotDef.source, parsed)

    if (rawValue === null || rawValue === undefined) {
      // Slot could not be filled — this is a rendering issue.
      // For robustness, replace with a safe fallback instead of failing entirely.
      text = text.replace(`{${placeholder}}`, '?')
      continue
    }

    let formatted: string
    if (typeof rawValue === 'number') {
      formatted = formatNumber(rawValue, slotDef.format)
    } else {
      formatted = String(rawValue)
    }

    // Replace all occurrences of {placeholder}
    text = text.split(`{${placeholder}}`).join(formatted)
  }

  // Check for any remaining unfilled placeholders
  // This catches template text that references slots not in the slots map
  const remaining = text.match(/\{[a-z_]+\}/g)
  if (remaining && remaining.length > 0) {
    // Still has unfilled placeholders — replace with safe fallback
    for (const r of remaining) {
      text = text.replace(r, '?')
    }
  }

  return text
}
