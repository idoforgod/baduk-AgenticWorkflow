// =============================================================================
// features/optimization/types.ts — All optimization-related types
// =============================================================================
// Covers: lazy loading, KataGo warmup, render optimization, DB optimization,
// and bundle configuration types.
// No React imports — pure TypeScript utilities.
// =============================================================================

// ---------------------------------------------------------------------------
// Lazy Loading Types
// ---------------------------------------------------------------------------

/**
 * Named module keys that support lazy loading.
 */
export type LazyModuleKey = 'katago' | 'explanation' | 'analytics' | 'gamification'

/**
 * A lazy module entry defines the dynamic import factory and optional preload behavior.
 */
export interface LazyModuleEntry {
  /** Human-readable name for logging */
  readonly name: string
  /** Whether this module should be preloaded in the background after app init */
  readonly preloadOnAppInit: boolean
  /** Estimated bundle size in KB (for budget tracking) */
  readonly estimatedKb: number
}

/**
 * Result of a preload operation.
 */
export interface PreloadResult {
  readonly key: LazyModuleKey
  readonly success: boolean
  readonly elapsedMs: number
  readonly error?: string
}

/**
 * Registry of all lazy module entries.
 */
export type LazyModuleRegistry = Readonly<Record<LazyModuleKey, LazyModuleEntry>>

// ---------------------------------------------------------------------------
// KataGo Warmup Types
// ---------------------------------------------------------------------------

/**
 * KataGo readiness state machine states.
 * Transitions: cold -> warming -> ready
 *              cold -> warming -> error
 *              error -> warming (retry)
 */
export type WarmupState = 'cold' | 'warming' | 'ready' | 'error'

/**
 * KataGo warmup status with full metadata.
 */
export interface WarmupStatus {
  /** Current state in the readiness machine */
  readonly state: WarmupState
  /** When warmup was last attempted (epoch ms, null if never attempted) */
  readonly warmupStartedAt: number | null
  /** When warmup completed (epoch ms, null if not yet complete) */
  readonly warmupCompletedAt: number | null
  /** Error message if state is 'error' */
  readonly errorMessage: string | null
  /** Number of warmup attempts */
  readonly attemptCount: number
}

/**
 * Configuration for the KataGo warmup strategy.
 */
export interface WarmupConfig {
  /** Maximum time (ms) to wait for KataGo to respond to warmup ping */
  readonly healthCheckTimeoutMs: number
  /** GTP commands to send as warmup ping (in order) */
  readonly warmupCommands: readonly string[]
  /** Whether to start warmup automatically on construction */
  readonly autoStart: boolean
}

/** Default warmup configuration */
export const DEFAULT_WARMUP_CONFIG: WarmupConfig = {
  healthCheckTimeoutMs: 5000,
  warmupCommands: ['boardsize 9', 'clear_board'],
  autoStart: false,
} as const

// ---------------------------------------------------------------------------
// Render Optimization Types
// ---------------------------------------------------------------------------

/**
 * Intersection state for board rendering.
 * Index in the board array corresponds to row * size + col.
 */
export type IntersectionState = 0 | 1 | 2

/**
 * A diff entry describing a single changed intersection.
 */
export interface IntersectionDiff {
  /** Board index (row * size + col) */
  readonly index: number
  /** Previous state */
  readonly from: IntersectionState
  /** New state */
  readonly to: IntersectionState
}

/**
 * Result of comparing two board states for changed intersections.
 */
export interface BoardDiff {
  /** List of intersections that changed */
  readonly changes: readonly IntersectionDiff[]
  /** Whether any intersections changed */
  readonly hasChanges: boolean
  /** Total number of intersections scanned */
  readonly totalIntersections: number
}

/**
 * Configuration for move list virtualization.
 */
export interface VirtualizationConfig {
  /** Minimum item count before virtualization activates */
  readonly activationThreshold: number
  /** Height of each move list item in pixels */
  readonly itemHeightPx: number
  /** Number of items to render outside the visible viewport (overscan) */
  readonly overscanCount: number
}

/** Default virtualization config for move lists */
export const DEFAULT_VIRTUALIZATION_CONFIG: VirtualizationConfig = {
  activationThreshold: 200,
  itemHeightPx: 28,
  overscanCount: 5,
} as const

// ---------------------------------------------------------------------------
// DB Optimization Types
// ---------------------------------------------------------------------------

/**
 * Configuration for WAL checkpoint trigger.
 */
export interface WalCheckpointConfig {
  /** Number of write operations between automatic WAL checkpoints */
  readonly writesPerCheckpoint: number
  /** Checkpoint mode: 'passive' | 'full' | 'restart' | 'truncate' */
  readonly mode: 'passive' | 'full' | 'restart' | 'truncate'
}

/** Default WAL checkpoint configuration */
export const DEFAULT_WAL_CHECKPOINT_CONFIG: WalCheckpointConfig = {
  writesPerCheckpoint: 100,
  mode: 'passive',
} as const

/**
 * An entry in the analysis cache table.
 * Used for LRU eviction tracking.
 */
export interface AnalysisCacheEntry {
  /** Cache key (e.g., hash of board position + query params) */
  readonly key: string
  /** Epoch ms timestamp of last access */
  readonly lastAccessedAt: number
  /** Size in bytes of the cached value */
  readonly sizeBytes: number
}

/**
 * Configuration for LRU cache eviction.
 */
export interface LruEvictionConfig {
  /** Maximum number of entries to retain */
  readonly maxEntries: number
  /** Maximum total size in bytes (0 = no size limit) */
  readonly maxSizeBytes: number
}

/** Default LRU eviction config for analysis_cache */
export const DEFAULT_LRU_EVICTION_CONFIG: LruEvictionConfig = {
  maxEntries: 1000,
  maxSizeBytes: 0,
} as const

/**
 * Result of a cache eviction operation.
 */
export interface EvictionResult {
  /** Number of entries evicted */
  readonly evictedCount: number
  /** Keys of evicted entries */
  readonly evictedKeys: readonly string[]
  /** Entries remaining after eviction */
  readonly remainingCount: number
}

/**
 * Result of a bulk insert operation.
 */
export interface BulkInsertResult {
  /** Number of rows inserted */
  readonly insertedCount: number
  /** Whether the operation succeeded */
  readonly success: boolean
  /** Error message if failed */
  readonly error?: string
}

// ---------------------------------------------------------------------------
// Bundle Config Types
// ---------------------------------------------------------------------------

/**
 * Logical chunk groups for Vite code splitting.
 */
export type ChunkGroup = 'core' | 'board-ui' | 'katago' | 'explanation' | 'analytics'

/**
 * Size budget for a chunk group in KB.
 */
export interface ChunkBudget {
  readonly group: ChunkGroup
  /** Approximate expected size in KB */
  readonly expectedKb: number
  /** Maximum allowed size in KB */
  readonly maxKb: number
}

/**
 * Complete bundle size budget.
 * Total app = JS bundle + KataGo binary + model file.
 */
export interface BundleBudget {
  /** Maximum total JS bundle size in KB */
  readonly maxJsBundleKb: number
  /** KataGo binary size in KB (~50MB) */
  readonly kataGoBinaryKb: number
  /** KataGo model file size in KB (~30MB) */
  readonly kataGoModelKb: number
  /** Maximum total app size in KB (100MB target) */
  readonly maxTotalKb: number
  /** Per-chunk budgets */
  readonly chunks: readonly ChunkBudget[]
}

/**
 * A module path that belongs to a specific chunk group.
 */
export interface ChunkModuleMapping {
  /** Pattern matching the module path (substring match) */
  readonly pattern: string
  /** Target chunk group */
  readonly group: ChunkGroup
}
