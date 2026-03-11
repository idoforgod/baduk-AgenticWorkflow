// =============================================================================
// features/optimization/DbOptimization.ts — SQLite performance utilities
// =============================================================================
// Utilities for optimizing SQLite operations through Tauri's single connection.
//
// Key strategies:
// 1. WAL checkpoint trigger — controls when WAL file is checkpointed.
// 2. Batch insert via transaction — wraps multiple INSERTs in one transaction.
// 3. Analysis cache LRU eviction — keep cache table at most 1000 entries.
//
// DB pragmas already set at connection open (in src/db/):
//   PRAGMA journal_mode = WAL;
//   PRAGMA cache_size = -20000;
//   PRAGMA synchronous = NORMAL;
//
// These utilities compose with those pragmas — they do not re-set them.
// =============================================================================

import type {
  AnalysisCacheEntry,
  BulkInsertResult,
  EvictionResult,
  LruEvictionConfig,
  WalCheckpointConfig,
} from './types'
import { DEFAULT_LRU_EVICTION_CONFIG, DEFAULT_WAL_CHECKPOINT_CONFIG } from './types'

// ---------------------------------------------------------------------------
// WAL Checkpoint Tracker
// ---------------------------------------------------------------------------

/**
 * Tracks write operation count and triggers WAL checkpoints at configured intervals.
 *
 * Tauri's SQLite connection is single — all reads and writes go through the same
 * connection. WAL mode allows reads to proceed concurrently with writes, but the
 * WAL file grows unbounded until a checkpoint is run. This tracker ensures
 * checkpoints happen periodically without manual intervention.
 *
 * Usage:
 *   const tracker = createWalCheckpointTracker(invoke)
 *   // After each write:
 *   await tracker.recordWrite()
 */
export class WalCheckpointTracker {
  private writeCount = 0
  private readonly config: WalCheckpointConfig
  private readonly invokeCheckpoint: (mode: string) => Promise<void>

  constructor(
    invokeCheckpoint: (mode: string) => Promise<void>,
    config: WalCheckpointConfig = DEFAULT_WAL_CHECKPOINT_CONFIG
  ) {
    this.invokeCheckpoint = invokeCheckpoint
    this.config = config
  }

  /**
   * Record a write operation. If the write count reaches the threshold,
   * triggers a WAL checkpoint.
   *
   * @returns true if a checkpoint was triggered, false otherwise.
   */
  async recordWrite(): Promise<boolean> {
    this.writeCount += 1

    if (this.writeCount >= this.config.writesPerCheckpoint) {
      this.writeCount = 0
      await this.invokeCheckpoint(this.config.mode)
      return true
    }

    return false
  }

  /**
   * Force a checkpoint immediately regardless of write count.
   */
  async forceCheckpoint(): Promise<void> {
    this.writeCount = 0
    await this.invokeCheckpoint(this.config.mode)
  }

  /**
   * Get the current write count since last checkpoint.
   */
  getWriteCount(): number {
    return this.writeCount
  }

  /**
   * Reset the write counter (e.g., after manual checkpoint).
   */
  resetCounter(): void {
    this.writeCount = 0
  }
}

/**
 * Create a WAL checkpoint tracker.
 *
 * @param invokeCheckpoint - Function that executes the actual checkpoint SQL.
 *   In production: `(mode) => invoke('storage_wal_checkpoint', { mode })`
 *   In tests: mock function.
 * @param config - Optional configuration overrides.
 */
export function createWalCheckpointTracker(
  invokeCheckpoint: (mode: string) => Promise<void>,
  config?: Partial<WalCheckpointConfig>
): WalCheckpointTracker {
  return new WalCheckpointTracker(
    invokeCheckpoint,
    config !== undefined
      ? { ...DEFAULT_WAL_CHECKPOINT_CONFIG, ...config }
      : DEFAULT_WAL_CHECKPOINT_CONFIG
  )
}

// ---------------------------------------------------------------------------
// Bulk Insert Optimization
// ---------------------------------------------------------------------------

/**
 * A single row to be inserted in a bulk operation.
 * Generic — the shape depends on the target table.
 */
export type InsertRow = Readonly<Record<string, unknown>>

/**
 * Wrap multiple insert operations in a single transaction.
 *
 * In SQLite, committing each INSERT individually (auto-commit) is dramatically
 * slower than wrapping all inserts in a single explicit transaction. For games
 * with many moves, this can be 10-100x faster.
 *
 * This utility delegates the actual SQL to the provided `executeBatch` function,
 * which should call the Tauri `storage_batch_insert_moves` command (or similar).
 *
 * @param rows - Array of rows to insert.
 * @param executeBatch - Function that performs the actual batch insert.
 * @returns BulkInsertResult with count and success status.
 */
export async function optimizeForBulkInsert(
  rows: readonly InsertRow[],
  executeBatch: (rows: readonly InsertRow[]) => Promise<void>
): Promise<BulkInsertResult> {
  if (rows.length === 0) {
    return { insertedCount: 0, success: true }
  }

  try {
    await executeBatch(rows)
    return { insertedCount: rows.length, success: true }
  } catch (error) {
    return {
      insertedCount: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ---------------------------------------------------------------------------
// Analysis Cache LRU Eviction
// ---------------------------------------------------------------------------

/**
 * Determine which cache entries should be evicted using LRU (Least Recently Used).
 *
 * This function is a pure computation — it does not touch the database.
 * The caller is responsible for executing the resulting DELETE operations.
 *
 * LRU policy:
 * - Sort entries by `lastAccessedAt` ascending (oldest first).
 * - Keep only the `maxEntries` most-recently-used entries.
 * - If `maxSizeBytes > 0`, also evict until total size is within budget.
 *
 * @param entries - All current cache entries.
 * @param config - Eviction configuration.
 * @returns EvictionResult with the keys to delete and remaining count.
 */
export function computeLruEviction(
  entries: readonly AnalysisCacheEntry[],
  config: LruEvictionConfig = DEFAULT_LRU_EVICTION_CONFIG
): EvictionResult {
  if (entries.length <= config.maxEntries) {
    // Check size budget if configured
    if (config.maxSizeBytes === 0) {
      return { evictedCount: 0, evictedKeys: [], remainingCount: entries.length }
    }

    const totalSize = entries.reduce((sum, e) => sum + e.sizeBytes, 0)
    if (totalSize <= config.maxSizeBytes) {
      return { evictedCount: 0, evictedKeys: [], remainingCount: entries.length }
    }
  }

  // Sort by lastAccessedAt ascending (oldest = LRU = evict first)
  const sorted = [...entries].sort((a, b) => a.lastAccessedAt - b.lastAccessedAt)

  const evictedKeys: string[] = []

  // Phase 1: evict to enforce entry count limit
  while (sorted.length > config.maxEntries) {
    const evicted = sorted.shift()
    if (evicted !== undefined) {
      evictedKeys.push(evicted.key)
    }
  }

  // Phase 2: evict to enforce size budget (if configured)
  if (config.maxSizeBytes > 0) {
    let totalSize = sorted.reduce((sum, e) => sum + e.sizeBytes, 0)

    while (totalSize > config.maxSizeBytes && sorted.length > 0) {
      const evicted = sorted.shift()
      if (evicted !== undefined) {
        evictedKeys.push(evicted.key)
        totalSize -= evicted.sizeBytes
      }
    }
  }

  return {
    evictedCount: evictedKeys.length,
    evictedKeys,
    remainingCount: sorted.length,
  }
}

// ---------------------------------------------------------------------------
// Query Optimization Utilities
// ---------------------------------------------------------------------------

/**
 * Build an indexed lookup key for the analysis cache.
 * Format: `{boardHash}:{rules}:{komi}:{maxVisits}`
 *
 * Using a deterministic key ensures cache hits for identical positions
 * regardless of how the query was constructed.
 *
 * @param boardHash - Zobrist hash of the board position (as hex string or bigint).
 * @param rules - Rules string (e.g., 'chinese').
 * @param komi - Komi value.
 * @param maxVisits - Max visits for the query.
 */
export function buildAnalysisCacheKey(
  boardHash: string | bigint,
  rules: string,
  komi: number,
  maxVisits: number
): string {
  const hash = typeof boardHash === 'bigint' ? boardHash.toString(16) : boardHash
  return `${hash}:${rules}:${komi.toFixed(1)}:${String(maxVisits)}`
}

/**
 * Estimate whether a query result is worth caching.
 * Small queries (very few visits) have low reuse value.
 *
 * @param maxVisits - Number of visits in the query.
 * @param minVisitsForCache - Minimum visits to consider caching (default 10).
 */
export function shouldCacheAnalysis(maxVisits: number, minVisitsForCache = 10): boolean {
  return maxVisits >= minVisitsForCache
}

// ---------------------------------------------------------------------------
// Connection Pool Recommendations
// ---------------------------------------------------------------------------

/**
 * SQLite connection configuration recommendations for Tauri.
 *
 * Tauri's SQLite plugin typically uses a single read-write connection.
 * These are advisory values — actual connection setup is in Rust.
 *
 * Read-only connections CAN be opened in parallel (WAL mode allows this),
 * but the Tauri plugin may abstract this away.
 */
export const SQLITE_CONNECTION_RECOMMENDATIONS = {
  /**
   * Recommended connection pool size for read-write connection.
   * Single connection is fine for Tauri (serialized through Rust).
   */
  readWriteConnections: 1,

  /**
   * Recommended connection pool size for read-only connections.
   * WAL mode allows multiple readers in parallel.
   * Increase if analysis queries block game writes.
   */
  readOnlyConnections: 2,

  /**
   * Recommended busy timeout in milliseconds.
   * SQLite will retry locked operations for this long before failing.
   */
  busyTimeoutMs: 5000,

  /**
   * Recommended statement cache size.
   * Prepared statements are cached to avoid re-parsing SQL.
   */
  statementCacheSize: 50,
} as const
