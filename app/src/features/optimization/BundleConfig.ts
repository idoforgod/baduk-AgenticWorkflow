// =============================================================================
// features/optimization/BundleConfig.ts — Vite chunk splitting configuration
// =============================================================================
// Defines the rollup manual chunks configuration for Vite.
//
// Chunk strategy:
// - chunk-core: rules-engine + game-engine + core types (always needed)
// - chunk-board-ui: SVG board components (needed when any game is shown)
// - chunk-katago: KataGo bridge (lazy — only when AI game starts)
// - chunk-explanation: Explanation engine (lazy — only for post-game analysis)
// - chunk-analytics: PostHog + Sentry (loaded after app init)
//
// App size budget:
// - JS bundle: < 5MB total (< 100KB initial chunk)
// - KataGo binary: ~50MB (Tauri sidecar, not in JS bundle)
// - KataGo model: ~30MB (resource file, not in JS bundle)
// - Total app install: < 100MB
// =============================================================================

import type { BundleBudget, ChunkBudget, ChunkGroup, ChunkModuleMapping } from './types'

// ---------------------------------------------------------------------------
// Chunk Module Mappings
// ---------------------------------------------------------------------------

/**
 * Rules for assigning modules to named chunks.
 * Evaluated in order — first match wins.
 *
 * These patterns match against the module's resolved file path.
 */
export const CHUNK_MODULE_MAPPINGS: readonly ChunkModuleMapping[] = [
  // KataGo bridge — lazy loaded when AI game starts
  { pattern: 'src/katago-bridge', group: 'katago' },
  // Explanation engine — lazy loaded for post-game analysis
  { pattern: 'src/explanation-engine', group: 'explanation' },
  // Analytics — loaded in background after app init
  { pattern: 'src/analytics', group: 'analytics' },
  { pattern: 'posthog', group: 'analytics' },
  { pattern: '@sentry', group: 'analytics' },
  // Board UI — needed whenever a game board is shown
  { pattern: 'src/board-ui', group: 'board-ui' },
  { pattern: 'src/components/board', group: 'board-ui' },
  // Core — always needed
  { pattern: 'src/rules-engine', group: 'core' },
  { pattern: 'src/game-engine', group: 'core' },
  { pattern: 'src/core', group: 'core' },
  { pattern: 'src/db', group: 'core' },
] as const

// ---------------------------------------------------------------------------
// Rollup Manual Chunks Configuration
// ---------------------------------------------------------------------------

/**
 * Map from chunk group to Vite chunk name.
 * These names appear in the built output (e.g., chunk-katago.js).
 */
export const CHUNK_GROUP_NAMES: Readonly<Record<ChunkGroup, string>> = {
  core: 'chunk-core',
  'board-ui': 'chunk-board-ui',
  katago: 'chunk-katago',
  explanation: 'chunk-explanation',
  analytics: 'chunk-analytics',
} as const

/**
 * Vite rollup manualChunks function.
 *
 * Usage in vite.config.ts:
 *   build: {
 *     rollupOptions: {
 *       output: {
 *         manualChunks: createManualChunks(),
 *       }
 *     }
 *   }
 *
 * @returns A function that maps module IDs to chunk names.
 */
export function createManualChunks(): (id: string) => string | undefined {
  return (id: string): string | undefined => {
    // Normalize path separators for cross-platform compatibility
    const normalized = id.replace(/\\/g, '/')

    for (const mapping of CHUNK_MODULE_MAPPINGS) {
      if (normalized.includes(mapping.pattern)) {
        return CHUNK_GROUP_NAMES[mapping.group]
      }
    }

    // vendor chunk for node_modules
    if (normalized.includes('node_modules')) {
      // React and react-dom together (always needed)
      if (normalized.includes('react') || normalized.includes('react-dom')) {
        return 'vendor-react'
      }
      // Zustand
      if (normalized.includes('zustand')) {
        return 'vendor-zustand'
      }
      // Everything else in node_modules
      return 'vendor'
    }

    return undefined
  }
}

// ---------------------------------------------------------------------------
// Bundle Size Budget
// ---------------------------------------------------------------------------

/**
 * Per-chunk size budgets.
 * These are enforced by validateChunkBudgets() in CI.
 */
export const CHUNK_BUDGETS: readonly ChunkBudget[] = [
  { group: 'core', expectedKb: 80, maxKb: 150 },
  { group: 'board-ui', expectedKb: 60, maxKb: 120 },
  { group: 'katago', expectedKb: 45, maxKb: 100 },
  { group: 'explanation', expectedKb: 20, maxKb: 50 },
  { group: 'analytics', expectedKb: 60, maxKb: 120 },
] as const

/**
 * Complete bundle size budget for the app.
 * Total install target: < 100MB (Step 23 requirement).
 */
export const BUNDLE_BUDGET: BundleBudget = {
  maxJsBundleKb: 5_000, // 5MB total JS
  kataGoBinaryKb: 51_200, // ~50MB KataGo binary
  kataGoModelKb: 30_720, // ~30MB model file
  maxTotalKb: 102_400, // 100MB total install
  chunks: CHUNK_BUDGETS,
} as const

// ---------------------------------------------------------------------------
// Budget Validation
// ---------------------------------------------------------------------------

/**
 * Result of validating a chunk's size against its budget.
 */
export interface ChunkValidationResult {
  readonly group: ChunkGroup
  readonly actualKb: number
  readonly maxKb: number
  readonly passes: boolean
  readonly overageKb: number
}

/**
 * Validate actual chunk sizes against the defined budgets.
 * Designed for use in a CI/CD step that reads Vite's stats output.
 *
 * @param actualSizes - Map from chunk group name to actual size in KB.
 * @returns Array of validation results (one per budget entry).
 */
export function validateChunkBudgets(
  actualSizes: Readonly<Partial<Record<ChunkGroup, number>>>
): readonly ChunkValidationResult[] {
  return CHUNK_BUDGETS.map((budget) => {
    const actualKb = actualSizes[budget.group] ?? 0
    const passes = actualKb <= budget.maxKb
    return {
      group: budget.group,
      actualKb,
      maxKb: budget.maxKb,
      passes,
      overageKb: passes ? 0 : actualKb - budget.maxKb,
    }
  })
}

/**
 * Check if all chunk budgets pass.
 *
 * @param results - Results from validateChunkBudgets().
 * @returns true if all chunks are within budget.
 */
export function allChunkBudgetsPassing(results: readonly ChunkValidationResult[]): boolean {
  return results.every((r) => r.passes)
}

// ---------------------------------------------------------------------------
// Tree-Shaking Hints
// ---------------------------------------------------------------------------

/**
 * Modules that are side-effect-free and eligible for tree-shaking.
 * These should be declared in package.json under `sideEffects: false`,
 * or listed here for reference in the build configuration.
 *
 * Adding sideEffects: false enables Vite/rollup to eliminate unused exports.
 */
export const SIDE_EFFECT_FREE_MODULES: readonly string[] = [
  'src/core',
  'src/rules-engine',
  'src/game-engine/sgf.ts',
  'src/katago-bridge/difficulty.ts',
  'src/katago-bridge/query-builder.ts',
  'src/katago-bridge/response-parser.ts',
  'src/explanation-engine',
  'src/features/optimization',
] as const

/**
 * Get the chunk group for a given module path.
 * Returns undefined if no mapping matches (module goes in default chunk).
 *
 * @param modulePath - Module path to look up.
 */
export function getChunkGroupForModule(modulePath: string): ChunkGroup | undefined {
  const normalized = modulePath.replace(/\\/g, '/')
  for (const mapping of CHUNK_MODULE_MAPPINGS) {
    if (normalized.includes(mapping.pattern)) {
      return mapping.group
    }
  }
  return undefined
}
