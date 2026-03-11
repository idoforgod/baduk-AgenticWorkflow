// =============================================================================
// katago-bridge/difficulty.ts — 30-Level Difficulty System
// =============================================================================
// Maps 30 difficulty levels (1 = complete beginner, 30 = professional) to
// KataGo engine parameters.
//
// Design decisions:
// - Levels 1-10: Beginner range. High randomness, few visits, strong PDA penalty.
// - Levels 11-20: Intermediate range. Moderate visits, decreasing randomness.
// - Levels 21-30: Advanced/Pro range. High visits, minimal randomness.
// - Each level produces noticeably different playing strength.
// - HumanSL profiles are mapped when a human model is available (Phase 2).
// - The mapping is a pure function — no side effects.
//
// Key KataGo parameters used for difficulty:
// - maxVisits: Search depth. More visits = stronger play.
// - playoutDoublingAdvantage (PDA): Negative values make engine play weaker
//   by pretending opponent has more playouts. Range: [-3, 3].
// - rootPolicyTemperature: Values > 1 flatten the policy, making the engine
//   consider weaker moves more equally. Range: (0, inf).
// =============================================================================

import type { DifficultyConfig } from './types'

// ---------------------------------------------------------------------------
// Difficulty Level Table
// ---------------------------------------------------------------------------

/**
 * Complete 30-level difficulty configuration table.
 *
 * The design uses three dimensions of difficulty:
 * 1. maxVisits — controls search depth (strongest effect on strength)
 * 2. playoutDoublingAdvantage — controls playout asymmetry (subtle weakening)
 * 3. rootPolicyTemperature — controls move selection randomness
 *
 * Levels 1-5: Very weak. Essentially random play with minimal search.
 * Levels 6-10: Weak. Some search but high randomness and PDA penalty.
 * Levels 11-15: SDK (single-digit kyu). Moderate search, some randomness.
 * Levels 16-20: High-kyu to low-dan. Good search, minimal randomness.
 * Levels 21-25: Dan-level. Strong search, no artificial weakening.
 * Levels 26-30: Professional-level. Maximum search with full strength.
 */
const DIFFICULTY_TABLE: readonly DifficultyConfig[] = [
  // Level 1-5: Complete beginner (25k-20k equivalent)
  {
    level: 1,
    maxVisits: 1,
    playoutDoublingAdvantage: -3.0,
    rootPolicyTemperature: 3.0,
    humanSLProfile: 'rank_20k',
    overrideSettings: { wideRootNoise: 0.1 },
  },
  {
    level: 2,
    maxVisits: 1,
    playoutDoublingAdvantage: -2.5,
    rootPolicyTemperature: 2.8,
    humanSLProfile: 'rank_18k',
    overrideSettings: { wideRootNoise: 0.1 },
  },
  {
    level: 3,
    maxVisits: 2,
    playoutDoublingAdvantage: -2.5,
    rootPolicyTemperature: 2.5,
    humanSLProfile: 'rank_16k',
    overrideSettings: { wideRootNoise: 0.08 },
  },
  {
    level: 4,
    maxVisits: 2,
    playoutDoublingAdvantage: -2.0,
    rootPolicyTemperature: 2.3,
    humanSLProfile: 'rank_15k',
    overrideSettings: { wideRootNoise: 0.08 },
  },
  {
    level: 5,
    maxVisits: 3,
    playoutDoublingAdvantage: -2.0,
    rootPolicyTemperature: 2.0,
    humanSLProfile: 'rank_13k',
    overrideSettings: { wideRootNoise: 0.06 },
  },

  // Level 6-10: Beginner (15k-10k equivalent)
  {
    level: 6,
    maxVisits: 5,
    playoutDoublingAdvantage: -1.8,
    rootPolicyTemperature: 1.8,
    humanSLProfile: 'rank_12k',
    overrideSettings: { wideRootNoise: 0.05 },
  },
  {
    level: 7,
    maxVisits: 8,
    playoutDoublingAdvantage: -1.5,
    rootPolicyTemperature: 1.6,
    humanSLProfile: 'rank_10k',
    overrideSettings: { wideRootNoise: 0.04 },
  },
  {
    level: 8,
    maxVisits: 12,
    playoutDoublingAdvantage: -1.3,
    rootPolicyTemperature: 1.5,
    humanSLProfile: 'rank_8k',
    overrideSettings: { wideRootNoise: 0.03 },
  },
  {
    level: 9,
    maxVisits: 16,
    playoutDoublingAdvantage: -1.0,
    rootPolicyTemperature: 1.4,
    humanSLProfile: 'rank_7k',
    overrideSettings: { wideRootNoise: 0.03 },
  },
  {
    level: 10,
    maxVisits: 20,
    playoutDoublingAdvantage: -0.8,
    rootPolicyTemperature: 1.3,
    humanSLProfile: 'rank_5k',
    overrideSettings: { wideRootNoise: 0.02 },
  },

  // Level 11-15: Single-digit kyu (5k-1k equivalent)
  {
    level: 11,
    maxVisits: 30,
    playoutDoublingAdvantage: -0.6,
    rootPolicyTemperature: 1.25,
    humanSLProfile: 'rank_4k',
    overrideSettings: {},
  },
  {
    level: 12,
    maxVisits: 40,
    playoutDoublingAdvantage: -0.5,
    rootPolicyTemperature: 1.2,
    humanSLProfile: 'rank_3k',
    overrideSettings: {},
  },
  {
    level: 13,
    maxVisits: 50,
    playoutDoublingAdvantage: -0.4,
    rootPolicyTemperature: 1.15,
    humanSLProfile: 'rank_2k',
    overrideSettings: {},
  },
  {
    level: 14,
    maxVisits: 70,
    playoutDoublingAdvantage: -0.3,
    rootPolicyTemperature: 1.1,
    humanSLProfile: 'rank_1k',
    overrideSettings: {},
  },
  {
    level: 15,
    maxVisits: 90,
    playoutDoublingAdvantage: -0.2,
    rootPolicyTemperature: 1.05,
    humanSLProfile: 'rank_1k',
    overrideSettings: {},
  },

  // Level 16-20: Low dan (1d-3d equivalent)
  {
    level: 16,
    maxVisits: 120,
    playoutDoublingAdvantage: -0.15,
    rootPolicyTemperature: 1.03,
    humanSLProfile: 'rank_1d',
    overrideSettings: {},
  },
  {
    level: 17,
    maxVisits: 150,
    playoutDoublingAdvantage: -0.1,
    rootPolicyTemperature: 1.02,
    humanSLProfile: 'rank_1d',
    overrideSettings: {},
  },
  {
    level: 18,
    maxVisits: 180,
    playoutDoublingAdvantage: -0.05,
    rootPolicyTemperature: 1.01,
    humanSLProfile: 'rank_2d',
    overrideSettings: {},
  },
  {
    level: 19,
    maxVisits: 220,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_2d',
    overrideSettings: {},
  },
  {
    level: 20,
    maxVisits: 260,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_3d',
    overrideSettings: {},
  },

  // Level 21-25: High dan (4d-7d equivalent)
  {
    level: 21,
    maxVisits: 300,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_4d',
    overrideSettings: {},
  },
  {
    level: 22,
    maxVisits: 350,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_5d',
    overrideSettings: {},
  },
  {
    level: 23,
    maxVisits: 400,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_6d',
    overrideSettings: {},
  },
  {
    level: 24,
    maxVisits: 450,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_7d',
    overrideSettings: {},
  },
  {
    level: 25,
    maxVisits: 500,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_8d',
    overrideSettings: {},
  },

  // Level 26-30: Professional (9d / pro equivalent)
  {
    level: 26,
    maxVisits: 600,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_9d',
    overrideSettings: {},
  },
  {
    level: 27,
    maxVisits: 700,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: 'rank_9d',
    overrideSettings: {},
  },
  {
    level: 28,
    maxVisits: 800,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: null,
    overrideSettings: {},
  },
  {
    level: 29,
    maxVisits: 900,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: null,
    overrideSettings: {},
  },
  {
    level: 30,
    maxVisits: 1000,
    playoutDoublingAdvantage: 0,
    rootPolicyTemperature: 1.0,
    humanSLProfile: null,
    overrideSettings: {},
  },
] as const

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the difficulty configuration for a given level.
 *
 * @param level - Difficulty level (1-30). Clamped to [1, 30].
 * @returns DifficultyConfig for the requested level.
 */
export function getDifficultyConfig(level: number): DifficultyConfig {
  const clamped = Math.max(1, Math.min(30, Math.round(level)))
  const config = DIFFICULTY_TABLE[clamped - 1]
  if (config === undefined) {
    // Should never happen due to clamping, but defensive
    return DIFFICULTY_TABLE[14] as DifficultyConfig // Middle of the range
  }
  return config
}

/**
 * Get all 30 difficulty configurations.
 * Useful for UI display (e.g., difficulty selector showing level descriptions).
 */
export function getAllDifficultyConfigs(): readonly DifficultyConfig[] {
  return DIFFICULTY_TABLE
}

/**
 * Get a human-readable description of a difficulty level.
 */
export function getDifficultyDescription(level: number): string {
  const clamped = Math.max(1, Math.min(30, Math.round(level)))
  if (clamped <= 5) return `Level ${String(clamped)} — Beginner (${getDifficultyRank(clamped)})`
  if (clamped <= 10)
    return `Level ${String(clamped)} — Intermediate (${getDifficultyRank(clamped)})`
  if (clamped <= 15) return `Level ${String(clamped)} — SDK (${getDifficultyRank(clamped)})`
  if (clamped <= 20) return `Level ${String(clamped)} — Low Dan (${getDifficultyRank(clamped)})`
  if (clamped <= 25) return `Level ${String(clamped)} — High Dan (${getDifficultyRank(clamped)})`
  return `Level ${String(clamped)} — Professional (${getDifficultyRank(clamped)})`
}

/**
 * Get the approximate Go rank for a difficulty level.
 */
export function getDifficultyRank(level: number): string {
  const clamped = Math.max(1, Math.min(30, Math.round(level)))
  const rankMap: Record<number, string> = {
    1: '20k',
    2: '18k',
    3: '16k',
    4: '15k',
    5: '13k',
    6: '12k',
    7: '10k',
    8: '8k',
    9: '7k',
    10: '5k',
    11: '4k',
    12: '3k',
    13: '2k',
    14: '1k',
    15: '1k+',
    16: '1d',
    17: '1d+',
    18: '2d',
    19: '2d+',
    20: '3d',
    21: '4d',
    22: '5d',
    23: '6d',
    24: '7d',
    25: '8d',
    26: '9d',
    27: '9d+',
    28: 'Low Pro',
    29: 'Mid Pro',
    30: 'Top Pro',
  }
  return rankMap[clamped] ?? 'Unknown'
}

/**
 * Validate that a difficulty level is in the valid range.
 */
export function isValidDifficultyLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 30
}

/**
 * Get the minimum and maximum difficulty levels.
 */
export const DIFFICULTY_RANGE = { min: 1, max: 30 } as const
