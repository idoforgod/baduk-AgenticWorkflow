// =============================================================================
// katago-bridge/query-builder.ts — Build KataGo Analysis Engine JSON queries
// =============================================================================
// Converts board state + analysis parameters into the KataGo Analysis Engine
// JSON query format (Step 2 Section 3).
//
// Design decisions:
// - All optional fields are omitted from output when undefined (KataGo uses
//   its defaults for missing fields).
// - Rules can be a string shorthand or a JSON object. We pass through as-is.
// - The query builder is a pure function — no side effects, no state.
// =============================================================================

import type {
  AnalysisQuery,
  ClearCacheAction,
  KataGoMove,
  KataGoQuery,
  Player,
  QueryModelsAction,
  QueryVersionAction,
  TerminateAction,
  TerminateAllAction,
} from '../core/interfaces'
import type { DifficultyConfig, TauriAnalysisQuery } from './types'

// ---------------------------------------------------------------------------
// Query ID Generation
// ---------------------------------------------------------------------------

let queryCounter = 0

/**
 * Generate a unique query ID for KataGo request/response correlation.
 * Format: "q-{counter}-{timestamp}" to ensure uniqueness across sessions.
 */
export function generateQueryId(prefix = 'q'): string {
  queryCounter += 1
  return `${prefix}-${queryCounter}-${Date.now()}`
}

/**
 * Reset the query counter (for testing only).
 */
export function resetQueryCounter(): void {
  queryCounter = 0
}

// ---------------------------------------------------------------------------
// Tauri Command Payload Builder
// ---------------------------------------------------------------------------

/**
 * Convert an AnalysisQuery (from interfaces.ts) into the Tauri command payload
 * format expected by the Rust katago_analyze command.
 *
 * Key transformations:
 * - Rules: If object, serialize to string (Rust side expects string)
 * - Moves: Ensure [player, location] tuples are plain arrays
 * - Optional fields: Only include when defined
 */
export function buildTauriAnalysisQuery(
  query: AnalysisQuery,
  difficultyConfig?: DifficultyConfig
): TauriAnalysisQuery {
  const result: Record<string, unknown> = {
    id: query.id,
    moves: serializeMoves(query.moves),
    rules: typeof query.rules === 'string' ? query.rules : JSON.stringify(query.rules),
    boardXSize: query.boardXSize,
    boardYSize: query.boardYSize,
  }

  // Apply difficulty overrides first (query-specific values take precedence)
  if (difficultyConfig !== undefined) {
    if (query.maxVisits === undefined) {
      result.maxVisits = difficultyConfig.maxVisits
    }
    if (query.rootPolicyTemperature === undefined) {
      result.rootPolicyTemperature = difficultyConfig.rootPolicyTemperature
    }
    // Merge override settings: difficulty defaults + query overrides
    const mergedOverrides: Record<string, string | number | boolean> = {
      ...difficultyConfig.overrideSettings,
      ...(query.overrideSettings ?? {}),
    }
    if (difficultyConfig.playoutDoublingAdvantage !== 0) {
      mergedOverrides.playoutDoublingAdvantage = difficultyConfig.playoutDoublingAdvantage
    }
    if (Object.keys(mergedOverrides).length > 0) {
      result.overrideSettings = mergedOverrides
    }
  }

  // Apply query-level optional fields (override difficulty if set)
  if (query.komi !== undefined) result.komi = query.komi
  if (query.maxVisits !== undefined) result.maxVisits = query.maxVisits
  if (query.rootPolicyTemperature !== undefined) {
    result.rootPolicyTemperature = query.rootPolicyTemperature
  }
  if (query.includeOwnership !== undefined) result.includeOwnership = query.includeOwnership
  if (query.analyzeTurns !== undefined) result.analyzeTurns = query.analyzeTurns
  if (query.priority !== undefined) result.priority = query.priority
  if (query.initialStones !== undefined) {
    result.initialStones = serializeMoves(query.initialStones)
  }
  // Pass through overrideSettings from query if no difficulty
  if (difficultyConfig === undefined && query.overrideSettings !== undefined) {
    result.overrideSettings = query.overrideSettings
  }

  return result as TauriAnalysisQuery
}

// ---------------------------------------------------------------------------
// KataGo JSON-line Query Builders (for direct stdin communication)
// ---------------------------------------------------------------------------

/**
 * Serialize an AnalysisQuery into a KataGo JSON-line string.
 * This is the format written directly to KataGo's stdin.
 *
 * @returns Single-line JSON string (no trailing newline — caller adds that)
 */
export function serializeAnalysisQuery(
  query: AnalysisQuery,
  difficultyConfig?: DifficultyConfig
): string {
  const obj: Record<string, unknown> = {
    id: query.id,
    moves: serializeMoves(query.moves),
    rules: query.rules,
    boardXSize: query.boardXSize,
    boardYSize: query.boardYSize,
  }

  // Optional fields — only include when defined
  if (query.komi !== undefined) obj.komi = query.komi
  if (query.initialStones !== undefined) {
    obj.initialStones = serializeMoves(query.initialStones)
  }
  if (query.initialPlayer !== undefined) obj.initialPlayer = query.initialPlayer
  if (query.whiteHandicapBonus !== undefined) obj.whiteHandicapBonus = query.whiteHandicapBonus
  if (query.analyzeTurns !== undefined) obj.analyzeTurns = query.analyzeTurns
  if (query.rootFpuReductionMax !== undefined) obj.rootFpuReductionMax = query.rootFpuReductionMax
  if (query.analysisPVLen !== undefined) obj.analysisPVLen = query.analysisPVLen
  if (query.includeOwnership !== undefined) obj.includeOwnership = query.includeOwnership
  if (query.includeOwnershipStdev !== undefined) {
    obj.includeOwnershipStdev = query.includeOwnershipStdev
  }
  if (query.includeMovesOwnership !== undefined) {
    obj.includeMovesOwnership = query.includeMovesOwnership
  }
  if (query.includeMovesOwnershipStdev !== undefined) {
    obj.includeMovesOwnershipStdev = query.includeMovesOwnershipStdev
  }
  if (query.includePolicy !== undefined) obj.includePolicy = query.includePolicy
  if (query.includePVVisits !== undefined) obj.includePVVisits = query.includePVVisits
  if (query.includeNoResultValue !== undefined) {
    obj.includeNoResultValue = query.includeNoResultValue
  }
  if (query.avoidMoves !== undefined) obj.avoidMoves = query.avoidMoves
  if (query.allowMoves !== undefined) obj.allowMoves = query.allowMoves
  if (query.reportDuringSearchEvery !== undefined) {
    obj.reportDuringSearchEvery = query.reportDuringSearchEvery
  }
  if (query.priority !== undefined) obj.priority = query.priority
  if (query.priorities !== undefined) obj.priorities = query.priorities

  // Apply difficulty config
  if (difficultyConfig !== undefined) {
    if (query.maxVisits === undefined) {
      obj.maxVisits = difficultyConfig.maxVisits
    } else {
      obj.maxVisits = query.maxVisits
    }
    if (query.rootPolicyTemperature === undefined) {
      obj.rootPolicyTemperature = difficultyConfig.rootPolicyTemperature
    } else {
      obj.rootPolicyTemperature = query.rootPolicyTemperature
    }

    const mergedOverrides: Record<string, string | number | boolean> = {
      ...difficultyConfig.overrideSettings,
      ...(query.overrideSettings ?? {}),
    }
    if (difficultyConfig.playoutDoublingAdvantage !== 0) {
      mergedOverrides.playoutDoublingAdvantage = difficultyConfig.playoutDoublingAdvantage
    }
    if (Object.keys(mergedOverrides).length > 0) {
      obj.overrideSettings = mergedOverrides
    }
  } else {
    if (query.maxVisits !== undefined) obj.maxVisits = query.maxVisits
    if (query.rootPolicyTemperature !== undefined) {
      obj.rootPolicyTemperature = query.rootPolicyTemperature
    }
    if (query.overrideSettings !== undefined) obj.overrideSettings = query.overrideSettings
  }

  return JSON.stringify(obj)
}

/**
 * Build a query_version action query.
 */
export function buildQueryVersion(id?: string): QueryVersionAction {
  return { id: id ?? generateQueryId('ver'), action: 'query_version' }
}

/**
 * Build a query_models action query.
 */
export function buildQueryModels(id?: string): QueryModelsAction {
  return { id: id ?? generateQueryId('mod'), action: 'query_models' }
}

/**
 * Build a clear_cache action query.
 */
export function buildClearCache(id?: string): ClearCacheAction {
  return { id: id ?? generateQueryId('clr'), action: 'clear_cache' }
}

/**
 * Build a terminate action query for a specific analysis.
 */
export function buildTerminate(
  terminateId: string,
  id?: string,
  turnNumbers?: readonly number[]
): TerminateAction {
  const query: TerminateAction = {
    id: id ?? generateQueryId('term'),
    action: 'terminate',
    terminateId,
    ...(turnNumbers !== undefined ? { turnNumbers } : {}),
  }
  return query
}

/**
 * Build a terminate_all action query.
 */
export function buildTerminateAll(
  id?: string,
  turnNumbers?: readonly number[]
): TerminateAllAction {
  const query: TerminateAllAction = {
    id: id ?? generateQueryId('term-all'),
    action: 'terminate_all',
    ...(turnNumbers !== undefined ? { turnNumbers } : {}),
  }
  return query
}

/**
 * Serialize any KataGoQuery into a JSON-line string.
 */
export function serializeQuery(query: KataGoQuery): string {
  return JSON.stringify(query)
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an AnalysisQuery before sending to KataGo.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateAnalysisQuery(query: AnalysisQuery): string | null {
  if (!query.id || query.id.trim().length === 0) {
    return 'Query id must be a non-empty string'
  }

  if (query.boardXSize < 2 || query.boardXSize > 19) {
    return `boardXSize must be between 2 and 19, got ${String(query.boardXSize)}`
  }

  if (query.boardYSize < 2 || query.boardYSize > 19) {
    return `boardYSize must be between 2 and 19, got ${String(query.boardYSize)}`
  }

  if (query.komi !== undefined && (query.komi < -150 || query.komi > 150)) {
    return `komi must be between -150 and 150, got ${String(query.komi)}`
  }

  if (query.maxVisits !== undefined && query.maxVisits < 1) {
    return `maxVisits must be >= 1, got ${String(query.maxVisits)}`
  }

  // Validate moves: each must be [Player, Location]
  for (const [i, move] of query.moves.entries()) {
    if (!isValidPlayer(move[0])) {
      return `moves[${String(i)}] has invalid player "${move[0]}", expected "B" or "W"`
    }
  }

  if (query.initialStones !== undefined) {
    for (const [i, stone] of query.initialStones.entries()) {
      if (!isValidPlayer(stone[0])) {
        return `initialStones[${String(i)}] has invalid player "${stone[0]}", expected "B" or "W"`
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function isValidPlayer(player: string): player is Player {
  return player === 'B' || player === 'W'
}

/**
 * Serialize KataGoMove[] to plain [string, string][] arrays.
 * Readonly tuples become writable arrays for JSON serialization.
 */
function serializeMoves(moves: readonly KataGoMove[]): [string, string][] {
  return moves.map((m) => [m[0], m[1]])
}
