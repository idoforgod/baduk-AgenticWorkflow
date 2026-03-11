// =============================================================================
// katago-bridge/visits.ts — Visits Tier Management
// =============================================================================
// Manages the three visits tiers (fast/standard/deep) and hardware-adaptive
// calibration (Step 2 Section 9).
//
// The default tiers are: fast=5, standard=50, deep=500.
// On low-spec hardware, these are automatically reduced based on a benchmark
// probe that measures visits per second.
//
// Hardware classification (Step 2 Section 10.3):
//   High (>=500 v/s): 5 / 50 / 500
//   Medium (100-499): 5 / 50 / 300
//   Low (30-99):      3 / 30 / 150
//   Minimal (10-29):  1 / 10 / 50
//   Ultra-Low (<10):  1 / 5  / 25
// =============================================================================

import type { VisitsTierConfig } from '../core/interfaces'
import { DEFAULT_VISITS_TIERS } from './types'

// ---------------------------------------------------------------------------
// Visits Tier State
// ---------------------------------------------------------------------------

/** Current visits tier configuration (mutable — updated by calibration) */
let currentTiers: VisitsTierConfig = { ...DEFAULT_VISITS_TIERS }

/** Cached visits-per-second from last calibration (null if not calibrated) */
let cachedVisitsPerSecond: number | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the current visits tier configuration.
 */
export function getVisitsTiers(): VisitsTierConfig {
  return { ...currentTiers }
}

/**
 * Set the visits tier configuration manually.
 * Used when loading saved calibration results from storage.
 */
export function setVisitsTiers(tiers: VisitsTierConfig): void {
  currentTiers = { ...tiers }
}

/**
 * Reset visits tiers to defaults.
 */
export function resetVisitsTiers(): void {
  currentTiers = { ...DEFAULT_VISITS_TIERS }
  cachedVisitsPerSecond = null
}

/**
 * Get the cached visits-per-second from the last calibration.
 * Returns null if no calibration has been performed.
 */
export function getCachedVisitsPerSecond(): number | null {
  return cachedVisitsPerSecond
}

/**
 * Calculate visits tiers from a measured visits-per-second value.
 * Implements the Step 2 Section 9.3 calibration algorithm.
 *
 * @param visitsPerSecond - Measured visits per second from benchmark
 * @returns Calibrated visits tier configuration
 */
export function calibrateTiersFromVPS(visitsPerSecond: number): VisitsTierConfig {
  cachedVisitsPerSecond = visitsPerSecond

  let tiers: VisitsTierConfig

  if (visitsPerSecond >= 500) {
    // High-performance GPU: use default tiers
    tiers = { fast: 5, standard: 50, deep: 500 }
  } else if (visitsPerSecond >= 100) {
    // Mid-range GPU: moderate reduction
    tiers = { fast: 5, standard: 50, deep: 300 }
  } else if (visitsPerSecond >= 30) {
    // Low-end GPU or fast CPU: significant reduction
    tiers = { fast: 3, standard: 30, deep: 150 }
  } else if (visitsPerSecond >= 10) {
    // CPU-only: minimal analysis
    tiers = { fast: 1, standard: 10, deep: 50 }
  } else {
    // Very slow hardware: consider smaller model
    tiers = { fast: 1, standard: 5, deep: 25 }
  }

  currentTiers = tiers
  return { ...tiers }
}

/**
 * Get the hardware classification based on visits-per-second.
 */
export function getHardwareClass(
  visitsPerSecond: number
): 'high' | 'medium' | 'low' | 'minimal' | 'ultra-low' {
  if (visitsPerSecond >= 500) return 'high'
  if (visitsPerSecond >= 100) return 'medium'
  if (visitsPerSecond >= 30) return 'low'
  if (visitsPerSecond >= 10) return 'minimal'
  return 'ultra-low'
}

/**
 * Check if the hardware is fast enough for a comfortable analysis experience.
 * Returns true if visits-per-second is at least 10 (minimal tier).
 */
export function isHardwareSufficient(visitsPerSecond: number): boolean {
  return visitsPerSecond >= 10
}

/**
 * Estimate response time for a given number of visits.
 *
 * @param visits - Number of visits to estimate
 * @param visitsPerSecond - Measured hardware speed (or null for cached value)
 * @returns Estimated time in milliseconds, or null if no benchmark data
 */
export function estimateResponseTime(visits: number, visitsPerSecond?: number): number | null {
  const vps = visitsPerSecond ?? cachedVisitsPerSecond
  if (vps === null || vps <= 0) return null
  return (visits / vps) * 1000
}

/**
 * Get the recommended hang timeout for a given visits count.
 * Based on Step 2 Section 7.4 timeout recommendations.
 *
 * @param visits - Number of visits
 * @param visitsPerSecond - Measured hardware speed (or null for cached)
 * @returns Timeout in milliseconds
 */
export function getHangTimeout(visits: number, visitsPerSecond?: number): number {
  const vps = visitsPerSecond ?? cachedVisitsPerSecond

  // If we have benchmark data, use 3x estimated time with minimum floor
  if (vps !== null && vps > 0) {
    const estimated = (visits / vps) * 1000
    return Math.max(5000, estimated * 3)
  }

  // Default timeouts without benchmark data (Step 2 Section 7.4)
  if (visits <= 5) return 5000
  if (visits <= 50) return 15000
  if (visits <= 500) return 90000
  return 180000
}
