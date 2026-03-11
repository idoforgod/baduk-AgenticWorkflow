// =============================================================================
// Module: explanation-engine/coverage — Coverage Measurement
// =============================================================================
// Tracks template hits vs. LLM fallback invocations.
// Reports coverage percentage per category and overall.
// Step 4 Section 8: target >= 80% coverage.
// =============================================================================

import type { CoverageStats, PositionCategory } from '@core/interfaces'
import type { CoverageResult } from './types'

// =============================================================================
// Coverage Tracker
// =============================================================================

const ALL_CATEGORIES: readonly PositionCategory[] = [
  'life_death',
  'ko',
  'seki',
  'move_quality',
  'position',
  'opening',
  'middle_game',
  'endgame',
  'alternative',
  'generic',
]

/**
 * Mutable coverage tracker. Records each position analysis result.
 */
export class CoverageTracker {
  private totalAnalyzed = 0
  private templateHits = 0
  private templatePartials = 0
  private mandatoryHits = 0
  private llmRequired = 0
  private readonly byCategory: Map<PositionCategory, { total: number; covered: number }> = new Map()

  constructor() {
    for (const cat of ALL_CATEGORIES) {
      this.byCategory.set(cat, { total: 0, covered: 0 })
    }
  }

  /**
   * Record a single position analysis result.
   */
  record(category: PositionCategory, result: CoverageResult): void {
    this.totalAnalyzed++

    const catStats = this.byCategory.get(category) ?? { total: 0, covered: 0 }
    catStats.total++

    switch (result) {
      case 'TEMPLATE_HIT':
        this.templateHits++
        catStats.covered++
        break
      case 'TEMPLATE_PARTIAL':
        this.templatePartials++
        catStats.covered++
        break
      case 'MANDATORY_HIT':
        this.mandatoryHits++
        catStats.covered++
        break
      case 'LLM_REQUIRED':
        this.llmRequired++
        break
    }

    this.byCategory.set(category, catStats)
  }

  /**
   * Get the current coverage statistics.
   */
  getStats(): CoverageStats {
    const covered = this.templateHits + this.templatePartials + this.mandatoryHits
    const coveragePercent = this.totalAnalyzed > 0 ? (covered / this.totalAnalyzed) * 100 : 0

    const byCategory = {} as Record<
      PositionCategory,
      { total: number; covered: number; percent: number }
    >

    for (const cat of ALL_CATEGORIES) {
      const stats = this.byCategory.get(cat) ?? { total: 0, covered: 0 }
      byCategory[cat] = {
        total: stats.total,
        covered: stats.covered,
        percent: stats.total > 0 ? (stats.covered / stats.total) * 100 : 0,
      }
    }

    return {
      totalAnalyzed: this.totalAnalyzed,
      templateHits: this.templateHits,
      templatePartials: this.templatePartials,
      mandatoryHits: this.mandatoryHits,
      llmRequired: this.llmRequired,
      coveragePercent,
      byCategory,
    }
  }

  /**
   * Reset all counters.
   */
  reset(): void {
    this.totalAnalyzed = 0
    this.templateHits = 0
    this.templatePartials = 0
    this.mandatoryHits = 0
    this.llmRequired = 0
    for (const cat of ALL_CATEGORIES) {
      this.byCategory.set(cat, { total: 0, covered: 0 })
    }
  }
}

/**
 * Run coverage measurement on a set of explanation results.
 * This is a convenience function for batch measurement.
 *
 * @param results - Array of { category, result } pairs.
 * @returns Coverage statistics.
 */
export function measureCoverage(
  results: readonly { category: PositionCategory; result: CoverageResult }[]
): CoverageStats {
  const tracker = new CoverageTracker()
  for (const { category, result } of results) {
    tracker.record(category, result)
  }
  return tracker.getStats()
}
