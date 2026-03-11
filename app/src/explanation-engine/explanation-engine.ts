// =============================================================================
// Module: explanation-engine/explanation-engine — Main Engine
// =============================================================================
// Implements IExplanationEngine from core/interfaces.ts.
// Pure transformation: AnalysisResponse -> ExplanationOutput.
// No I/O, no side effects, no LLM calls.
//
// SAFETY: The explain() method enforces the mandatory fallback chain:
//   1. Check position category (life/death, ko, seki?)
//      -> YES: Use MANDATORY pre-authored template. NEVER proceed to LLM.
//   2. Match against template catalog
//      -> MATCH: Use template with data slots filled.
//   3. No template match
//      -> Mark as LLM_REQUIRED (but do NOT invoke LLM — that is the caller's job).
//
// The life/death/ko/seki check is the FIRST check in explain().
// Code structure makes bypassing impossible.
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  CoverageStats,
  ExplanationError,
  ExplanationOutput,
  GTPLocation,
  IExplanationEngine,
  PatternCatalog,
  PositionCategory,
  Result,
  Tier,
} from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'
import { CoverageTracker } from './coverage'
import { isMandatoryCategory } from './fallback'
import { parseAnalysis } from './output-parser'
import { findBestPattern } from './pattern-matcher'
import { PATTERN_CATALOG } from './patterns'
import { renderTemplate } from './template-engine'

// =============================================================================
// ExplanationEngine Implementation
// =============================================================================

export class ExplanationEngine implements IExplanationEngine {
  private defaultTier: Tier = 'beginner'
  private readonly coverageTracker = new CoverageTracker()

  // ---------------------------------------------------------------------------
  // IExplanationEngine.explain()
  // ---------------------------------------------------------------------------

  explain(
    current: AnalysisResponse,
    previous: AnalysisResponse | null,
    actualMove: GTPLocation | null,
    tier: Tier,
    turnNumber: number,
    boardSize: BoardSize
  ): Result<ExplanationOutput, ExplanationError> {
    // --- Validate input ---
    if (!current.rootInfo || !current.moveInfos || current.moveInfos.length === 0) {
      return Err({
        module: 'explanation' as const,
        code: 'INVALID_ANALYSIS_DATA' as const,
        message: 'Analysis data is missing rootInfo or has no moveInfos.',
      })
    }

    // --- Step 1: Parse KataGo response ---
    const parsed = parseAnalysis(current, previous, actualMove, turnNumber, boardSize)

    // --- Step 2: Determine position category ---
    // The categoryHint is provided externally for life/death, ko, seki.
    // For this V1, we use the parsed data's categoryHint (set by caller) or null.
    const categoryHint = parsed.categoryHint

    // --- Step 3: MANDATORY FALLBACK CHECK (L2 Category Lock) ---
    // This is the FIRST check. If category is life_death, ko, or seki,
    // we ALWAYS use a pre-authored template. We NEVER fall through to LLM.
    if (isMandatoryCategory(categoryHint)) {
      return this.handleMandatoryCategory(parsed, tier, categoryHint!)
    }

    // --- Step 4: Standard template matching (Priority 2-6) ---
    const match = findBestPattern(parsed, tier, categoryHint)

    if (match) {
      const renderedText = renderTemplate(match, parsed)
      if (renderedText) {
        // Track coverage
        this.coverageTracker.record(match.category, 'TEMPLATE_HIT')

        return Ok({
          text: renderedText,
          matchedPatterns: [match.patternId],
          category: match.category,
          moveQuality: parsed.moveQuality,
          tier,
          computed: parsed.computed,
          isMandatoryTemplate: false,
          usedLLMFallback: false,
        })
      }
    }

    // --- Step 5: No template match — mark as LLM_REQUIRED ---
    // We do NOT invoke the LLM here. We return a generic fallback text
    // derived purely from KataGo data.
    const genericCategory: PositionCategory = categoryHint ?? 'generic'
    this.coverageTracker.record(genericCategory, 'LLM_REQUIRED')

    const fallbackText = this.generateDataOnlyFallback(parsed, tier)

    return Ok({
      text: fallbackText,
      matchedPatterns: [],
      category: genericCategory,
      moveQuality: parsed.moveQuality,
      tier,
      computed: parsed.computed,
      isMandatoryTemplate: false,
      usedLLMFallback: true,
    })
  }

  // ---------------------------------------------------------------------------
  // IExplanationEngine.getPatternCatalog()
  // ---------------------------------------------------------------------------

  getPatternCatalog(): PatternCatalog {
    const countByTier: Record<Tier, number> = { beginner: 0, intermediate: 0, advanced: 0 }
    const countByCategory: Record<PositionCategory, number> = {
      life_death: 0,
      ko: 0,
      seki: 0,
      move_quality: 0,
      position: 0,
      opening: 0,
      middle_game: 0,
      endgame: 0,
      alternative: 0,
      generic: 0,
    }

    for (const p of PATTERN_CATALOG) {
      countByTier[p.tier]++
      countByCategory[p.category]++
    }

    return {
      patterns: PATTERN_CATALOG.map((p) => ({
        id: p.id,
        tier: p.tier,
        category: p.category,
        trigger: {
          conditions: p.trigger.conditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })),
          requiresDelta: p.trigger.requiresDelta,
        },
        template: {
          text: p.template.text,
          slots: Object.fromEntries(
            Object.entries(p.template.slots).map(([k, v]) => [k, v.source])
          ),
        },
        fallbackId: p.fallbackId,
        mandatory: p.mandatory,
      })),
      version: '1.0.0',
      totalCount: PATTERN_CATALOG.length,
      countByTier,
      countByCategory,
    }
  }

  // ---------------------------------------------------------------------------
  // IExplanationEngine.getCoverageStats()
  // ---------------------------------------------------------------------------

  getCoverageStats(): CoverageStats {
    return this.coverageTracker.getStats()
  }

  // ---------------------------------------------------------------------------
  // IExplanationEngine.setDefaultTier() / getDefaultTier()
  // ---------------------------------------------------------------------------

  setDefaultTier(tier: Tier): void {
    this.defaultTier = tier
  }

  getDefaultTier(): Tier {
    return this.defaultTier
  }

  // ---------------------------------------------------------------------------
  // Explain with external category hint (for testing and external callers)
  // ---------------------------------------------------------------------------

  /**
   * Same as explain() but allows passing a category hint externally.
   * This is used when the game engine has already classified the position
   * (e.g., detected life/death, ko, or seki).
   */
  explainWithCategory(
    current: AnalysisResponse,
    previous: AnalysisResponse | null,
    actualMove: GTPLocation | null,
    tier: Tier,
    turnNumber: number,
    boardSize: BoardSize,
    category: PositionCategory | null
  ): Result<ExplanationOutput, ExplanationError> {
    // Validate input
    if (!current.rootInfo || !current.moveInfos || current.moveInfos.length === 0) {
      return Err({
        module: 'explanation' as const,
        code: 'INVALID_ANALYSIS_DATA' as const,
        message: 'Analysis data is missing rootInfo or has no moveInfos.',
      })
    }

    const parsed = parseAnalysis(current, previous, actualMove, turnNumber, boardSize)

    // Override the category hint
    const parsedWithCategory = { ...parsed, categoryHint: category }

    // --- MANDATORY FALLBACK CHECK --- FIRST CHECK, ALWAYS
    if (isMandatoryCategory(category)) {
      return this.handleMandatoryCategory(parsedWithCategory, tier, category!)
    }

    // Standard template matching
    const match = findBestPattern(parsedWithCategory, tier, category)

    if (match) {
      const renderedText = renderTemplate(match, parsedWithCategory)
      if (renderedText) {
        this.coverageTracker.record(match.category, 'TEMPLATE_HIT')
        return Ok({
          text: renderedText,
          matchedPatterns: [match.patternId],
          category: match.category,
          moveQuality: parsedWithCategory.moveQuality,
          tier,
          computed: parsedWithCategory.computed,
          isMandatoryTemplate: false,
          usedLLMFallback: false,
        })
      }
    }

    const genericCategory: PositionCategory = category ?? 'generic'
    this.coverageTracker.record(genericCategory, 'LLM_REQUIRED')
    const fallbackText = this.generateDataOnlyFallback(parsedWithCategory, tier)

    return Ok({
      text: fallbackText,
      matchedPatterns: [],
      category: genericCategory,
      moveQuality: parsedWithCategory.moveQuality,
      tier,
      computed: parsedWithCategory.computed,
      isMandatoryTemplate: false,
      usedLLMFallback: true,
    })
  }

  // ---------------------------------------------------------------------------
  // Private: Handle mandatory categories
  // ---------------------------------------------------------------------------

  private handleMandatoryCategory(
    parsed: ReturnType<typeof parseAnalysis>,
    tier: Tier,
    category: PositionCategory
  ): Result<ExplanationOutput, ExplanationError> {
    // Find the best mandatory template for this category and tier
    const match = findBestPattern(parsed, tier, category)

    if (match && match.isMandatory) {
      const renderedText = renderTemplate(match, parsed)
      if (renderedText) {
        this.coverageTracker.record(category, 'MANDATORY_HIT')
        return Ok({
          text: renderedText,
          matchedPatterns: [match.patternId],
          category,
          moveQuality: parsed.moveQuality,
          tier,
          computed: parsed.computed,
          isMandatoryTemplate: true,
          usedLLMFallback: false,
        })
      }
    }

    // Even if no specific mandatory template matched (should not happen with
    // the unsettled/catch-all patterns), we NEVER fall through to LLM.
    // Instead, we return a generic mandatory template.
    this.coverageTracker.record(category, 'MANDATORY_HIT')

    const genericMandatoryText = this.getGenericMandatoryText(category, parsed, tier)
    return Ok({
      text: genericMandatoryText,
      matchedPatterns: [],
      category,
      moveQuality: parsed.moveQuality,
      tier,
      computed: parsed.computed,
      isMandatoryTemplate: true,
      usedLLMFallback: false,
    })
  }

  // ---------------------------------------------------------------------------
  // Private: Generic mandatory text (ultimate fallback for L/D, Ko, Seki)
  // ---------------------------------------------------------------------------

  private getGenericMandatoryText(
    category: PositionCategory,
    parsed: ReturnType<typeof parseAnalysis>,
    tier: Tier
  ): string {
    const bestMove = parsed.raw.moveInfos[0]?.move ?? 'unknown'
    const winrate = Math.round(parsed.winratePct)

    switch (category) {
      case 'life_death':
        return tier === 'beginner'
          ? `There is a fight for survival happening here. The computer suggests playing at ${bestMove}.`
          : `Life/death situation. Best move: ${bestMove} (WR: ${winrate}%).`

      case 'ko':
        return tier === 'beginner'
          ? `There is a back-and-forth fight here. The best move is ${bestMove}.`
          : `Ko fight detected. Best: ${bestMove} (WR: ${winrate}%).`

      case 'seki':
        return tier === 'beginner'
          ? 'Both groups of stones here are alive. Neither side can capture the other.'
          : `Seki (mutual life). WR: ${winrate}%.`

      default:
        return `Position analysis: WR ${winrate}%, best move ${bestMove}.`
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Data-only fallback (when no template matches, NOT for mandatory)
  // ---------------------------------------------------------------------------

  private generateDataOnlyFallback(parsed: ReturnType<typeof parseAnalysis>, tier: Tier): string {
    const winrate = parsed.winratePct
    const bestMove = parsed.raw.moveInfos[0]?.move ?? 'unknown'
    const scoreLead = parsed.raw.rootInfo.scoreLead

    if (tier === 'beginner') {
      return `The computer's best suggestion is ${bestMove}. Your current winning chance is ${Math.round(winrate)}%.`
    }

    if (tier === 'intermediate') {
      return `Position evaluation: WR ${winrate.toFixed(1)}%, Score ${scoreLead.toFixed(1)} points. Best move: ${bestMove}.`
    }

    return `WR: ${winrate.toFixed(1)}%, Score: ${scoreLead.toFixed(1)}. Best: ${bestMove}. V: ${parsed.raw.rootInfo.visits}.`
  }
}

// =============================================================================
// Factory function
// =============================================================================

/**
 * Create a new ExplanationEngine instance.
 */
export function createExplanationEngine(): ExplanationEngine {
  return new ExplanationEngine()
}
