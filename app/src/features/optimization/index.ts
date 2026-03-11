// =============================================================================
// features/optimization — Public API Barrel Export
// =============================================================================
// Layer 4 (Feature) — performance optimization utilities
// Purpose: Lazy loading, KataGo warmup, render optimization, DB optimization,
//          and bundle configuration for the Baduk Platform.
//
// Implemented by: Step 23 (optimization-engineer)
// =============================================================================

export type { ChunkValidationResult } from './BundleConfig'
// --- Bundle Config ---
export {
  allChunkBudgetsPassing,
  BUNDLE_BUDGET,
  CHUNK_BUDGETS,
  CHUNK_GROUP_NAMES,
  CHUNK_MODULE_MAPPINGS,
  createManualChunks,
  getChunkGroupForModule,
  SIDE_EFFECT_FREE_MODULES,
  validateChunkBudgets,
} from './BundleConfig'

// --- DB Optimization ---
export {
  buildAnalysisCacheKey,
  computeLruEviction,
  createWalCheckpointTracker,
  optimizeForBulkInsert,
  SQLITE_CONNECTION_RECOMMENDATIONS,
  shouldCacheAnalysis,
  WalCheckpointTracker,
} from './DbOptimization'
export type { WarmupStateListener } from './KataGoWarmup'
// --- KataGo Warmup ---
export { createKataGoWarmup, KataGoWarmup } from './KataGoWarmup'

// --- Lazy Modules ---
export {
  getAppInitModules,
  getModuleEntry,
  LAZY_MODULE_REGISTRY,
  loadAnalytics,
  loadExplanationEngine,
  loadGamification,
  loadKatago,
  MODULE_CHUNK_GROUPS,
  preloadAppInitModules,
  preloadModule,
} from './LazyModules'
export type {
  BoardTracker,
  EqualityFn,
  MemoizedSelector,
  SelectorFn,
  ThrottledCallback,
} from './RenderOptimization'
// --- Render Optimization ---
export {
  createBoardTracker,
  createEmptyBoardState,
  createMemoizedSelector,
  createThrottledCallback,
  diffBoardState,
  MOVE_LIST_VIRTUALIZATION,
  shallowEqual,
} from './RenderOptimization'

// --- Types ---
export type {
  AnalysisCacheEntry,
  BoardDiff,
  BulkInsertResult,
  BundleBudget,
  ChunkBudget,
  ChunkGroup,
  ChunkModuleMapping,
  EvictionResult,
  IntersectionDiff,
  IntersectionState,
  LazyModuleEntry,
  LazyModuleKey,
  LazyModuleRegistry,
  LruEvictionConfig,
  PreloadResult,
  VirtualizationConfig,
  WalCheckpointConfig,
  WarmupConfig,
  WarmupState,
  WarmupStatus,
} from './types'
export {
  DEFAULT_LRU_EVICTION_CONFIG,
  DEFAULT_VIRTUALIZATION_CONFIG,
  DEFAULT_WAL_CHECKPOINT_CONFIG,
  DEFAULT_WARMUP_CONFIG,
} from './types'
