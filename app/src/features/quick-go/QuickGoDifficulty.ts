// =============================================================================
// features/quick-go/QuickGoDifficulty.ts — Difficulty Mapping
// =============================================================================
// Maps Quick Go presets (beginner/intermediate/advanced) to the 30-level
// difficulty system from Step 12 (katago-bridge/difficulty.ts).
//
// RULE: This module does NOT invent its own difficulty mechanism.
//       It is a thin mapping layer over the katago-bridge 30-level system.
// =============================================================================

import { getDifficultyConfig, getDifficultyRank } from '@katago-bridge/difficulty'
import type { DifficultyConfig } from '@katago-bridge/types'
import type { DifficultyPreset } from './types'

// ---------------------------------------------------------------------------
// Preset -> Level Mapping
// ---------------------------------------------------------------------------

/**
 * Difficulty range for each preset.
 * Within a range, the exact level can be auto-adjusted based on win/loss.
 */
export interface DifficultyRange {
  readonly min: number
  readonly max: number
  readonly default: number
}

const PRESET_RANGES: Record<DifficultyPreset, DifficultyRange> = {
  beginner: { min: 1, max: 10, default: 5 },
  intermediate: { min: 11, max: 20, default: 15 },
  advanced: { min: 21, max: 30, default: 25 },
} as const

/**
 * Get the difficulty level range for a preset.
 */
export function getPresetRange(preset: DifficultyPreset): DifficultyRange {
  return PRESET_RANGES[preset]
}

/**
 * Get the default difficulty level for a preset.
 */
export function getDefaultLevel(preset: DifficultyPreset): number {
  return PRESET_RANGES[preset].default
}

/**
 * Get the DifficultyConfig from the 30-level system for a given preset.
 * Uses the default level for the preset.
 */
export function getDifficultyForPreset(preset: DifficultyPreset): DifficultyConfig {
  return getDifficultyConfig(getDefaultLevel(preset))
}

/**
 * Get the DifficultyConfig for an exact level.
 * Delegates directly to the katago-bridge difficulty system.
 */
export function getDifficultyForLevel(level: number): DifficultyConfig {
  return getDifficultyConfig(level)
}

/**
 * Get a human-readable description of the difficulty.
 */
export function getDifficultyLabel(level: number): string {
  const rank = getDifficultyRank(level)
  return `Level ${String(level)} (${rank})`
}

// ---------------------------------------------------------------------------
// Auto-Adjustment
// ---------------------------------------------------------------------------

/**
 * Adjust difficulty level based on game outcome.
 * Stays within the preset's range boundaries.
 *
 * Rules:
 * - Win by more than 10 points or quickly (< 40 moves): increase by 2
 * - Win: increase by 1
 * - Loss by more than 10 points: decrease by 2
 * - Loss: decrease by 1
 * - Close game (within 5 points): no change
 */
export function adjustDifficulty(
  currentLevel: number,
  preset: DifficultyPreset,
  playerWon: boolean,
  scoreDifferential: number | null,
  moveCount: number
): number {
  const range = PRESET_RANGES[preset]
  let adjustment = 0

  if (playerWon) {
    if (moveCount < 40 || (scoreDifferential !== null && Math.abs(scoreDifferential) > 10)) {
      adjustment = 2 // Dominant win
    } else if (scoreDifferential !== null && Math.abs(scoreDifferential) <= 5) {
      adjustment = 0 // Close win — stay
    } else {
      adjustment = 1 // Normal win
    }
  } else {
    if (scoreDifferential !== null && Math.abs(scoreDifferential) > 10) {
      adjustment = -2 // Heavy loss
    } else if (scoreDifferential !== null && Math.abs(scoreDifferential) <= 5) {
      adjustment = 0 // Close loss — stay
    } else {
      adjustment = -1 // Normal loss
    }
  }

  const newLevel = currentLevel + adjustment
  return Math.max(range.min, Math.min(range.max, newLevel))
}

/**
 * Determine the preset category for a given difficulty level.
 */
export function getPresetForLevel(level: number): DifficultyPreset {
  if (level <= 10) return 'beginner'
  if (level <= 20) return 'intermediate'
  return 'advanced'
}
