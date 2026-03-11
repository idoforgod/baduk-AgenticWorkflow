// =============================================================================
// features/optimization/LazyModules.ts — Module lazy loading and preloading
// =============================================================================
// Defines which modules should be lazy-loaded to reduce initial bundle size
// and improve Time To Interactive (TTI).
//
// Strategy:
// - katago: Only needed when an AI game starts — heaviest module.
// - explanation: Only needed for post-game analysis.
// - analytics: Loaded after app init to not block main thread.
// - gamification: Loaded on first access (quest/achievement screen).
//
// Usage:
//   // Preload katago in background while user is on setup screen:
//   await preloadModule('katago')
//
//   // Dynamically import on demand:
//   const { createKatagoBridge } = await loadKatago()
// =============================================================================

import type { LazyModuleEntry, LazyModuleKey, LazyModuleRegistry, PreloadResult } from './types'

// ---------------------------------------------------------------------------
// Module Registry
// ---------------------------------------------------------------------------

/**
 * Registry of all lazy-loadable modules with metadata.
 * Preloading order: analytics (background, low priority) -> katago (on setup screen).
 */
export const LAZY_MODULE_REGISTRY: LazyModuleRegistry = {
  katago: {
    name: 'KataGo Bridge',
    preloadOnAppInit: false, // Only preload when user navigates to game setup
    estimatedKb: 45,
  },
  explanation: {
    name: 'Explanation Engine',
    preloadOnAppInit: false, // Only preload when game ends
    estimatedKb: 20,
  },
  analytics: {
    name: 'Analytics (PostHog / Sentry)',
    preloadOnAppInit: true, // Load in background after app mounts
    estimatedKb: 60,
  },
  gamification: {
    name: 'Gamification Service',
    preloadOnAppInit: false, // Load on first access
    estimatedKb: 15,
  },
} as const

// ---------------------------------------------------------------------------
// Vite Chunk Group Assignments
// ---------------------------------------------------------------------------

/**
 * Map of module path substrings to their Vite chunk group names.
 * Used by BundleConfig.ts to configure rollup manual chunks.
 * These paths are relative to the project root (as Vite sees them).
 */
export const MODULE_CHUNK_GROUPS: ReadonlyMap<string, string> = new Map([
  ['src/katago-bridge', 'chunk-katago'],
  ['src/explanation-engine', 'chunk-explanation'],
  ['src/analytics', 'chunk-analytics'],
  ['src/gamification', 'chunk-gamification'],
  ['src/board-ui', 'chunk-board-ui'],
  ['src/rules-engine', 'chunk-core'],
  ['src/game-engine', 'chunk-core'],
  ['src/core', 'chunk-core'],
])

// ---------------------------------------------------------------------------
// Dynamic Import Factories
// ---------------------------------------------------------------------------
// Each factory returns a Promise for the module namespace.
// Vite will create separate chunks for each dynamic import().
// These functions are the only place dynamic imports live — centralizing
// the chunk boundary ensures consistent splitting.

/**
 * Dynamically import the KataGo bridge module.
 * Chunk: chunk-katago
 */
export function loadKatago(): Promise<typeof import('@katago-bridge/index')> {
  return import('@katago-bridge/index')
}

/**
 * Dynamically import the explanation engine module.
 * Chunk: chunk-explanation
 */
export function loadExplanationEngine(): Promise<typeof import('@explanation-engine/index')> {
  return import('@explanation-engine/index')
}

/**
 * Dynamically import the analytics module.
 * Chunk: chunk-analytics
 */
export function loadAnalytics(): Promise<typeof import('@analytics/index')> {
  return import('@analytics/index')
}

/**
 * Dynamically import the gamification module.
 * Chunk: chunk-gamification
 */
export function loadGamification(): Promise<typeof import('@gamification/index')> {
  return import('@gamification/index')
}

// ---------------------------------------------------------------------------
// Preload Utilities
// ---------------------------------------------------------------------------

/**
 * Map from LazyModuleKey to its dynamic import factory.
 * Keeps preloadModule() and the import factories in sync.
 */
const MODULE_LOADERS: Readonly<Record<LazyModuleKey, () => Promise<unknown>>> = {
  katago: loadKatago,
  explanation: loadExplanationEngine,
  analytics: loadAnalytics,
  gamification: loadGamification,
}

/**
 * Preload a specific lazy module in the background.
 * Returns a PreloadResult with timing info.
 *
 * Calling this function before the module is actually needed warms up
 * the browser's module cache so the first real import is synchronous.
 *
 * @param key - The lazy module key to preload.
 * @returns PreloadResult with success/failure info.
 */
export async function preloadModule(key: LazyModuleKey): Promise<PreloadResult> {
  const loader = MODULE_LOADERS[key]
  const start = Date.now()

  try {
    await loader()
    return {
      key,
      success: true,
      elapsedMs: Date.now() - start,
    }
  } catch (error) {
    return {
      key,
      success: false,
      elapsedMs: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Preload all modules flagged with `preloadOnAppInit: true`.
 * Called once after the main app shell mounts.
 * Runs preloads in parallel to minimize wall-clock time.
 *
 * @returns Array of PreloadResult for each module attempted.
 */
export async function preloadAppInitModules(): Promise<readonly PreloadResult[]> {
  const keys = (Object.keys(LAZY_MODULE_REGISTRY) as LazyModuleKey[]).filter(
    (key) => LAZY_MODULE_REGISTRY[key].preloadOnAppInit
  )

  return Promise.all(keys.map((key) => preloadModule(key)))
}

/**
 * Get the module entry for a given key.
 * Returns null for unknown keys (safe lookup).
 *
 * @param key - Module key to look up.
 */
export function getModuleEntry(key: LazyModuleKey): LazyModuleEntry {
  return LAZY_MODULE_REGISTRY[key]
}

/**
 * Get all modules that should be preloaded on app init.
 */
export function getAppInitModules(): readonly LazyModuleKey[] {
  return (Object.keys(LAZY_MODULE_REGISTRY) as LazyModuleKey[]).filter(
    (key) => LAZY_MODULE_REGISTRY[key].preloadOnAppInit
  )
}
