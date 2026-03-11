// =============================================================================
// katago-bridge/types.ts — Internal types for the KataGo bridge module
// =============================================================================
// These types extend the core/interfaces.ts types with implementation-specific
// details that are not part of the public interface contract.
// =============================================================================

import type {
  AnalysisQuery,
  AnalysisResponse,
  BackendInfo,
  CircuitBreakerState,
  KataGoConfig,
  KataGoError,
  KataGoStatusState,
  VisitsTierConfig,
} from '../core/interfaces'

// ---------------------------------------------------------------------------
// Difficulty System Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a single difficulty level.
 * Maps a user-facing difficulty (1-30) to KataGo engine parameters.
 */
export interface DifficultyConfig {
  /** User-facing difficulty level (1 = weakest, 30 = strongest) */
  readonly level: number
  /** Maximum MCTS visits for this level */
  readonly maxVisits: number
  /**
   * Playout doubling advantage to weaken play.
   * Negative values make the engine play as if the opponent has more playouts.
   * Range: [-3, 3]. 0 = neutral.
   */
  readonly playoutDoublingAdvantage: number
  /**
   * Root policy temperature for move randomness.
   * Values > 1 broaden the move distribution.
   * Higher values = more random moves.
   */
  readonly rootPolicyTemperature: number
  /**
   * Human SL profile string for HumanSL model (Phase 2).
   * null if HumanSL is not available.
   */
  readonly humanSLProfile: string | null
  /**
   * Additional overrideSettings for this difficulty level.
   */
  readonly overrideSettings: Readonly<Record<string, string | number | boolean>>
}

// ---------------------------------------------------------------------------
// Rust Tauri Command Payload/Response Types
// ---------------------------------------------------------------------------
// These types match the Rust serde structs in commands/katago.rs.
// Field names use camelCase (Rust structs use #[serde(rename_all = "camelCase")]).

/** Payload for katago_initialize Tauri command */
export interface TauriKataGoConfig {
  readonly configPath: string
  readonly modelPath: string
  readonly humanModelPath?: string
  readonly analysisThreads?: number
}

/** Response from katago_initialize Tauri command */
export interface TauriVersionInfo {
  readonly version: string
  readonly gitHash?: string
}

/** Payload for katago_analyze Tauri command */
export interface TauriAnalysisQuery {
  readonly id: string
  readonly moves: readonly [string, string][]
  readonly rules: string
  readonly boardXSize: number
  readonly boardYSize: number
  readonly komi?: number
  readonly maxVisits?: number
  readonly rootPolicyTemperature?: number
  readonly includeOwnership?: boolean
  readonly analyzeTurns?: readonly number[]
  readonly priority?: number
  readonly overrideSettings?: Readonly<Record<string, string | number | boolean>>
  readonly initialStones?: readonly [string, string][]
}

/** Response from katago_analyze Tauri command */
export interface TauriAnalysisResponse {
  readonly id: string
  readonly turnNumber: number
  readonly moveInfos: readonly Record<string, unknown>[]
  readonly rootInfo: Record<string, unknown>
  readonly isDuringSearch: boolean
  readonly ownership?: readonly number[]
  readonly ownershipStdev?: readonly number[]
  readonly policy?: readonly number[]
  readonly humanPolicy?: readonly number[]
  readonly noResults?: boolean
}

/** Response from katago_detect_backend Tauri command */
export interface TauriBackendInfo {
  readonly backendType: string
  readonly deviceName: string
  readonly binaryName: string
}

/** KataGoStatus as returned from Rust (string enum) */
export type TauriKataGoStatus =
  | 'Idle'
  | 'Starting'
  | 'Ready'
  | 'Analyzing'
  | 'Degraded'
  | 'Failed'
  | 'Restarting'
  | 'Fallback'

// ---------------------------------------------------------------------------
// Circuit Breaker Configuration
// ---------------------------------------------------------------------------

/** Circuit breaker configuration (Step 2 Section 7.5) */
export interface CircuitBreakerConfig {
  /** Maximum failures within the window before circuit opens */
  readonly maxFailures: number
  /** Window size in milliseconds */
  readonly windowMs: number
  /** Base backoff delay in milliseconds */
  readonly backoffBaseMs: number
  /** Maximum backoff delay in milliseconds */
  readonly backoffMaxMs: number
  /** Backoff multiplier */
  readonly backoffMultiplier: number
}

/** Default circuit breaker configuration per Step 2 spec */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  maxFailures: 5,
  windowMs: 600_000, // 10 minutes
  backoffBaseMs: 3_000, // 3 seconds
  backoffMaxMs: 30_000, // 30 seconds
  backoffMultiplier: 2.0,
} as const

// ---------------------------------------------------------------------------
// Visits Tier Defaults
// ---------------------------------------------------------------------------

/** Default visits tier configuration (Step 2 Section 9.1) */
export const DEFAULT_VISITS_TIERS: VisitsTierConfig = {
  fast: 5,
  standard: 50,
  deep: 500,
} as const

// ---------------------------------------------------------------------------
// Re-export core types used throughout the module
// ---------------------------------------------------------------------------

export type {
  AnalysisQuery,
  AnalysisResponse,
  BackendInfo,
  CircuitBreakerState,
  KataGoConfig,
  KataGoError,
  KataGoStatusState,
  VisitsTierConfig,
}
