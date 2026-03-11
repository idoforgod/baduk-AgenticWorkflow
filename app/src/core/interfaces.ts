// =============================================================================
// Step 7: Module Interface Contracts — Baduk Platform
// =============================================================================
// Version: 1.0.0
// Author: @schema-designer (Step 7)
// Date: 2026-03-11
// Consumers: ALL implementation steps (10-20)
// Inputs: Step 2 (KataGo IPC), Step 3 (DKS), Step 4 (Template Engine),
//         Step 6 (Architecture)
// =============================================================================
//
// FILE ORGANIZATION:
//   Part 1: Foundational Types (board, game, player)
//   Part 2: KataGo IPC Types (matching Step 2 spec exactly)
//   Part 3: Explanation Engine Types (matching Step 4 design)
//   Part 4: Gamification Types
//   Part 5: Error Types (discriminated union hierarchy)
//   Part 6: Module Interface Contracts (5 interfaces)
//   Part 7: Tauri Command Payload Types
//   Part 8: Zod Validation Schemas
//
// ABSOLUTE RULES:
//   - No `any` type anywhere. Every field is explicitly typed.
//   - Every interface method has JSDoc with @param, @returns, @throws.
//   - Zod schemas exist for every external boundary (Tauri commands, KataGo).
//   - Types are read-only where mutation is not intended.
// =============================================================================

import { z } from 'zod'

// =============================================================================
// PART 1: FOUNDATIONAL TYPES
// =============================================================================
// These types map directly to DKS entities (Step 3).
// They live in `src/core/types/` and are imported by every module.
// =============================================================================

// --- Board Geometry (DKS E01-E08) ---

/**
 * Valid board sizes per DKS C01 (ValidBoardSize).
 * 9x9 (beginner), 13x13 (intermediate), 19x19 (standard).
 */
export type BoardSize = 9 | 13 | 19

/**
 * Cell state on the board per DKS E09 (CellState).
 * 0 = Empty, 1 = Black, 2 = White.
 */
export type CellState = 0 | 1 | 2

/** Player color identifiers */
export type Player = 'B' | 'W'

/** Numeric player representation for board operations */
export type PlayerColor = 1 | 2

/**
 * GTP location string. Examples: "C4", "Q16", "pass".
 * Matches KataGo's GTPLocation type (Step 2 Section 5).
 */
export type GTPLocation = string

/**
 * Board state as a flat 1D array (DKS E09b).
 * Index = row * size + col. Length = size * size.
 * Using Uint8Array for memory efficiency (Step 3 Section 3.1).
 */
export type BoardGrid = Uint8Array

/**
 * Complete board state snapshot (DKS E09b + related entities).
 * Immutable: every move creates a new BoardState.
 */
export interface BoardState {
  /** Board dimensions */
  readonly size: BoardSize
  /** Flat grid array. grid[row * size + col] = CellState */
  readonly grid: BoardGrid
  /** Zobrist hash of the current position (DKS R31, R38) */
  readonly hash: bigint
}

/**
 * A group of connected same-color stones (DKS E15).
 */
export interface Group {
  /** Color of all stones in this group */
  readonly color: PlayerColor
  /** Set of board indices occupied by this group's stones */
  readonly stones: ReadonlySet<number>
  /** Set of board indices that are liberties of this group */
  readonly liberties: ReadonlySet<number>
}

/**
 * Territory map for scoring (DKS E26-E30, R19-R24).
 * Each intersection is classified as Black territory, White territory, or dame.
 */
export interface TerritoryMap {
  /** Board indices classified as Black territory */
  readonly black: ReadonlySet<number>
  /** Board indices classified as White territory */
  readonly white: ReadonlySet<number>
  /** Board indices classified as dame (neutral) */
  readonly dame: ReadonlySet<number>
}

/**
 * Score result from Chinese (area) scoring (DKS Section 5).
 * DKS C18: blackScore + whiteScore + dame = size * size (before komi).
 */
export interface ScoreResult {
  /** Black's area score (stones on board + territory) */
  readonly blackScore: number
  /** White's area score (stones on board + territory) */
  readonly whiteScore: number
  /** Komi value applied to White's score */
  readonly komi: number
  /** Final score differential: black - (white + komi). Positive = Black leads. */
  readonly scoreDifferential: number
  /** Winner: "B", "W", or null (draw — only possible with integer komi) */
  readonly winner: Player | null
  /** Territory breakdown */
  readonly territory: TerritoryMap
  /** Number of dame points */
  readonly dameCount: number
}

// --- Game Flow Types (DKS C13-C17) ---

/** Game phases matching DKS game flow constraints */
export type GamePhase = 'setup' | 'playing' | 'scoring' | 'finished'

/** Game mode matching Step 6 game-engine spec */
export type GameMode = 'vs-ai' | 'review' | 'tutorial'

/**
 * A single move record in the game history (DKS MoveRecord).
 * Maps to the `moves` table in the schema.
 */
export interface MoveRecord {
  /** Sequential move number (0-based) */
  readonly moveNumber: number
  /** Player who made this move */
  readonly player: Player
  /**
   * Board index where stone was placed, or null for pass.
   * Index = row * size + col. Range: [0, size*size).
   */
  readonly index: number | null
  /** GTP coordinate string (e.g., "C4") or null for pass */
  readonly coordinate: GTPLocation | null
  /** Timestamp of when the move was played (Unix epoch seconds) */
  readonly timestamp: number
  /** Stones captured by this move (board indices) */
  readonly captures: readonly number[]
}

/** Time control configuration */
export interface TimeControl {
  /** Main time in seconds */
  readonly mainTime: number
  /** Byoyomi periods */
  readonly byoyomiPeriods: number
  /** Seconds per byoyomi period */
  readonly byoyomiTime: number
}

/** Timer state for a single player */
export interface PlayerTimerState {
  /** Remaining main time in seconds */
  readonly mainTimeRemaining: number
  /** Remaining byoyomi periods */
  readonly byoyomiPeriodsRemaining: number
  /** Remaining time in current byoyomi period */
  readonly byoyomiTimeRemaining: number
  /** Whether this player is currently in byoyomi */
  readonly inByoyomi: boolean
}

/** Combined timer state */
export interface TimerState {
  readonly black: PlayerTimerState
  readonly white: PlayerTimerState
  /** Which player's clock is running, or null if paused */
  readonly activePlayer: Player | null
}

/** Game configuration for creating a new game */
export interface GameConfig {
  /** Board size: 9, 13, or 19 */
  readonly boardSize: BoardSize
  /** Komi value. Default: 7.5 for 19x19, 5.5 for 9/13 */
  readonly komi: number
  /** Ruleset string matching KataGo's RulesetString */
  readonly rules: RulesetString
  /** Game mode */
  readonly mode: GameMode
  /** Time control settings (optional for tutorial mode) */
  readonly timeControl?: TimeControl
  /** AI difficulty level (1-9, mapped to KataGo visits tiers) */
  readonly aiLevel?: number
  /** Player's color when playing vs AI */
  readonly playerColor?: Player
}

/**
 * Complete game state.
 * This is the Zustand store shape managed by GameReducer (Step 6 Module 7).
 */
export interface GameState {
  /** Unique game identifier */
  readonly gameId: string
  /** Game configuration */
  readonly config: GameConfig
  /** Current board state */
  readonly board: BoardState
  /** Current player to move (DKS C07, C14) */
  readonly currentPlayer: Player
  /** Complete move history (append-only) */
  readonly moves: readonly MoveRecord[]
  /** Current move index for review mode navigation */
  readonly currentMoveIndex: number
  /** Current game phase */
  readonly phase: GamePhase
  /** Number of consecutive passes (DKS C15: 2 = game ends) */
  readonly consecutivePasses: number
  /** Set of all position hashes seen (DKS C08: superko detection) */
  readonly positionHashes: ReadonlySet<bigint>
  /** Simple ko point — board index forbidden for next move, or null */
  readonly koPoint: number | null
  /** Captured stone counts */
  readonly captures: { readonly black: number; readonly white: number }
  /** Timer state (null if no time control) */
  readonly timer: TimerState | null
}

/** Game session — the full game context including metadata */
export interface GameSession {
  /** Game state */
  readonly state: GameState
  /** When the game was created */
  readonly createdAt: number
  /** When the game was last updated */
  readonly updatedAt: number
}

/**
 * Result of playing a move.
 * Returned by IGameEngine.playMove() and IGameEngine.playPass().
 */
export interface PlayMoveResult {
  /** Whether the move was successfully applied */
  readonly success: boolean
  /** Updated game state (only if success = true) */
  readonly state: GameState | null
  /** Error message (only if success = false) */
  readonly error: string | null
  /** Stones captured by this move */
  readonly captures: readonly number[]
  /** Whether the game ended as a result of this move */
  readonly gameEnded: boolean
}

/** Game result after completion */
export interface GameResult {
  /** Winner: "B", "W", or null (draw) */
  readonly winner: Player | null
  /** Result string in SGF RE format: "B+R", "W+3.5", "B+T", etc. */
  readonly resultString: string
  /** Score details (only for games ending by scoring, not resignation) */
  readonly score: ScoreResult | null
  /** How the game ended */
  readonly endReason: 'scoring' | 'resignation' | 'timeout' | 'forfeit'
}

/** Game summary for list views (subset of full game data) */
export interface GameSummary {
  readonly gameId: string
  readonly boardSize: BoardSize
  readonly mode: GameMode
  readonly result: string | null
  readonly moveCount: number
  readonly startedAt: number
  readonly endedAt: number | null
}

/** Filter for listing games */
export interface GameFilter {
  readonly mode?: GameMode
  readonly boardSize?: BoardSize
  readonly completed?: boolean
  readonly limit?: number
  readonly offset?: number
}

// =============================================================================
// PART 2: KATAGO IPC TYPES
// =============================================================================
// These types match the Step 2 IPC spec EXACTLY.
// They are the TypeScript representation of KataGo's JSON protocol.
// Source: Step 2 Section 5 (TypeScript Type Definitions).
// =============================================================================

// --- Rules Types ---

export type KoRule = 'SIMPLE' | 'POSITIONAL' | 'SITUATIONAL'
export type ScoringRule = 'AREA' | 'TERRITORY'
export type TaxRule = 'NONE' | 'SEKI' | 'ALL'
export type WhiteHandicapBonus = '0' | 'N-1' | 'N'

export type RulesetString =
  | 'tromp-taylor'
  | 'chinese'
  | 'chinese-ogs'
  | 'chinese-kgs'
  | 'japanese'
  | 'korean'
  | 'stone-scoring'
  | 'aga'
  | 'bga'
  | 'new-zealand'
  | 'aga-button'

export interface RulesObject {
  readonly ko: KoRule
  readonly scoring: ScoringRule
  readonly suicide: boolean
  readonly tax: TaxRule
  readonly whiteHandicapBonus: WhiteHandicapBonus
  readonly hasButton?: boolean
  readonly friendlyPassOk?: boolean
}

export type Rules = RulesetString | RulesObject

// --- Move Types ---

/** A move is a [player, location] tuple (Step 2) */
export type KataGoMove = readonly [Player, GTPLocation]

/** Move restriction for avoidMoves/allowMoves */
export interface MoveRestriction {
  readonly player: Player
  readonly moves: readonly GTPLocation[]
  readonly untilDepth: number
}

// --- Query Types ---

/**
 * KataGo Analysis Query.
 * Matches Step 2 Section 3 (Query Format Specification) exactly.
 * Sent to KataGo's stdin as a single JSON line.
 */
export interface AnalysisQuery {
  /** Unique query identifier for response correlation */
  readonly id: string
  /** Move sequence leading to the position to analyze */
  readonly moves: readonly KataGoMove[]
  /** Ruleset (string shorthand or detailed object) */
  readonly rules: Rules
  /** Board width. Range: 2-19 (default), up to 50 with +bs50 build */
  readonly boardXSize: number
  /** Board height. Range: 2-19 (default), up to 50 with +bs50 build */
  readonly boardYSize: number

  // --- Optional fields ---

  /** Komi value. Range: [-150, 150]. Default: guessed from rules. */
  readonly komi?: number
  /** Initial stones placed before the move sequence (e.g., handicap) */
  readonly initialStones?: readonly KataGoMove[]
  /** Override whose turn it is at the start */
  readonly initialPlayer?: Player
  /** White handicap bonus rule override */
  readonly whiteHandicapBonus?: WhiteHandicapBonus
  /** Which turn numbers to analyze. Default: last turn only. */
  readonly analyzeTurns?: readonly number[]
  /** Maximum MCTS visits for this query */
  readonly maxVisits?: number
  /** Root policy temperature. Default: 1.0 */
  readonly rootPolicyTemperature?: number
  /** Root FPU reduction max */
  readonly rootFpuReductionMax?: number
  /** Length of principal variation to report */
  readonly analysisPVLen?: number
  /** Include per-intersection ownership values */
  readonly includeOwnership?: boolean
  /** Include ownership standard deviation */
  readonly includeOwnershipStdev?: boolean
  /** Include per-move ownership values */
  readonly includeMovesOwnership?: boolean
  /** Include per-move ownership standard deviation */
  readonly includeMovesOwnershipStdev?: boolean
  /** Include raw policy output */
  readonly includePolicy?: boolean
  /** Include visit counts per PV move */
  readonly includePVVisits?: boolean
  /** Include no-result probability */
  readonly includeNoResultValue?: boolean
  /** Moves to avoid for analysis */
  readonly avoidMoves?: readonly MoveRestriction[]
  /** Moves to restrict analysis to (must be length 1) */
  readonly allowMoves?: readonly [MoveRestriction]
  /** Override KataGo config settings */
  readonly overrideSettings?: Readonly<Record<string, string | number | boolean>>
  /** Report intermediate results every N seconds */
  readonly reportDuringSearchEvery?: number
  /** Query priority (higher = processed first). Default: 0 */
  readonly priority?: number
  /** Per-turn priorities (must match analyzeTurns length) */
  readonly priorities?: readonly number[]
}

/** Query to check KataGo version */
export interface QueryVersionAction {
  readonly id: string
  readonly action: 'query_version'
}

/** Query to list loaded models */
export interface QueryModelsAction {
  readonly id: string
  readonly action: 'query_models'
}

/** Query to clear neural network cache */
export interface ClearCacheAction {
  readonly id: string
  readonly action: 'clear_cache'
}

/** Query to terminate a specific analysis */
export interface TerminateAction {
  readonly id: string
  readonly action: 'terminate'
  readonly terminateId: string
  readonly turnNumbers?: readonly number[]
}

/** Query to terminate all pending analyses */
export interface TerminateAllAction {
  readonly id: string
  readonly action: 'terminate_all'
  readonly turnNumbers?: readonly number[]
}

/** Union of all possible queries sent to KataGo */
export type KataGoQuery =
  | AnalysisQuery
  | QueryVersionAction
  | QueryModelsAction
  | ClearCacheAction
  | TerminateAction
  | TerminateAllAction

// --- Response Types ---

/**
 * Per-move analysis information.
 * Each entry represents a candidate move evaluated by KataGo's MCTS.
 * Matches Step 2 Section 4.2 (MoveInfo fields).
 */
export interface MoveInfo {
  // --- Always present ---

  /** GTP coordinate of the candidate move */
  readonly move: GTPLocation
  /** Number of MCTS visits for this move */
  readonly visits: number
  /** Edge visits (visits via this move's edge in the search tree) */
  readonly edgeVisits: number
  /** Win probability if this move is played. Range: [0, 1] */
  readonly winrate: number
  /** Predicted score mean (alias for scoreLead) */
  readonly scoreMean: number
  /** Predicted score lead (positive = good for current player) */
  readonly scoreLead: number
  /** Standard deviation of score prediction */
  readonly scoreStdev: number
  /** Score in selfplay evaluation */
  readonly scoreSelfplay: number
  /** Neural network policy prior. Range: [0, 1] */
  readonly prior: number
  /** Combined utility value (win + score + other factors) */
  readonly utility: number
  /** Lower confidence bound of utility */
  readonly utilityLcb: number
  /** Lower confidence bound of winrate (may exceed [0,1] bounds) */
  readonly lcb: number
  /** Search weight accumulated */
  readonly weight: number
  /** Edge weight */
  readonly edgeWeight: number
  /** Move ranking: 0 = best, 1 = second best, etc. */
  readonly order: number
  /** Play selection value (v1.16+) */
  readonly playSelectionValue: number
  /** Principal variation — best follow-up sequence */
  readonly pv: readonly GTPLocation[]

  // --- Conditional fields ---

  /** Visit counts per PV move (when includePVVisits=true) */
  readonly pvVisits?: readonly number[]
  /** Edge visit counts per PV move (when includePVVisits=true) */
  readonly pvEdgeVisits?: readonly number[]
  /** No-result probability (when includeNoResultValue=true) */
  readonly noResultValue?: number
  /** Human model prior (when human model is loaded) */
  readonly humanPrior?: number
  /** Symmetry deduplication reference (when symmetry pruning active) */
  readonly isSymmetryOf?: GTPLocation
  /** Per-intersection ownership after this move (when includeMovesOwnership=true) */
  readonly ownership?: readonly number[]
  /** Ownership standard deviation (when includeMovesOwnershipStdev=true) */
  readonly ownershipStdev?: readonly number[]
}

/**
 * Root-level position analysis information.
 * Represents the overall assessment of the current board position.
 * Matches Step 2 Section 4.3 (RootInfo fields).
 */
export interface RootInfo {
  // --- Always present ---

  /** Overall win probability for the current player. Range: [0, 1] */
  readonly winrate: number
  /** Predicted score lead (positive = current player ahead) */
  readonly scoreLead: number
  /** Score in selfplay evaluation */
  readonly scoreSelfplay: number
  /** Standard deviation of score prediction */
  readonly scoreStdev: number
  /** Combined utility value */
  readonly utility: number
  /** Total MCTS visits for this position */
  readonly visits: number
  /** Current player to move */
  readonly currentPlayer: Player
  /** Position hash */
  readonly thisHash: string
  /** Symmetry-normalized hash */
  readonly symHash: string
  /** Lower confidence bound of winrate */
  readonly lcb: number
  /** Lower confidence bound of utility */
  readonly utilityLcb: number
  /** Raw neural network winrate (before search) */
  readonly rawWinrate: number
  /** Raw neural network score lead */
  readonly rawLead: number
  /** Raw selfplay score */
  readonly rawScoreSelfplay: number
  /** Raw selfplay score standard deviation */
  readonly rawScoreSelfplayStdev: number
  /** Raw no-result probability */
  readonly rawNoResultProb: number
  /** Raw short-term winrate error estimate */
  readonly rawStWrError: number
  /** Raw short-term score error estimate */
  readonly rawStScoreError: number
  /** Estimated meaningful moves remaining (game phase indicator) */
  readonly rawVarTimeLeft: number

  // --- Conditional fields (human model) ---

  readonly humanWinrate?: number
  readonly humanScoreMean?: number
  readonly humanScoreStdev?: number
  readonly humanStWrError?: number
  readonly humanStScoreError?: number
}

/**
 * Complete KataGo analysis response for a single position.
 * Matches Step 2 Section 4.1 (Response Format).
 */
export interface AnalysisResponse {
  /** Query ID for correlation */
  readonly id: string
  /** Whether this is an intermediate result during search */
  readonly isDuringSearch: boolean
  /** Turn number of the analyzed position */
  readonly turnNumber: number
  /** Ranked list of candidate moves with analysis */
  readonly moveInfos: readonly MoveInfo[]
  /** Overall position assessment */
  readonly rootInfo: RootInfo

  // --- Conditional fields ---

  /**
   * Per-intersection ownership values. Length: boardYSize * boardXSize.
   * Values in [-1, 1]: -1 = White owns, +1 = Black owns, 0 = contested.
   * Present when includeOwnership=true in query.
   */
  readonly ownership?: readonly number[]
  /** Ownership standard deviation. Same length as ownership. */
  readonly ownershipStdev?: readonly number[]
  /**
   * Raw policy output. Length: boardYSize * boardXSize + 1.
   * Last element is the pass probability.
   * Present when includePolicy=true in query.
   */
  readonly policy?: readonly number[]
  /** Human model policy (when human model loaded) */
  readonly humanPolicy?: readonly number[]
}

/** Response for a terminated query with no results */
export interface NoResultResponse {
  readonly id: string
  readonly isDuringSearch: false
  readonly turnNumber: number
  readonly noResults: true
}

/** Error response from KataGo */
export interface KataGoErrorResponse {
  readonly error: string
  readonly id?: string
  readonly field?: string
}

/** Warning response from KataGo */
export interface KataGoWarningResponse {
  readonly warning: string
  readonly id: string
  readonly field: string
}

/** Version information response */
export interface VersionResponse {
  readonly id: string
  readonly action: 'query_version'
  readonly version: string
  readonly git_hash: string
}

/** Neural network model information */
export interface ModelInfo {
  readonly name: string
  readonly internalName: string
  readonly maxBatchSize: number
  readonly usesHumanSLProfile: boolean
  readonly version: number
  readonly usingFP16: string
}

/** Models list response */
export interface ModelsResponse {
  readonly id: string
  readonly action: 'query_models'
  readonly models: readonly ModelInfo[]
}

/** Union of all possible KataGo responses */
export type KataGoResponse =
  | AnalysisResponse
  | NoResultResponse
  | KataGoErrorResponse
  | KataGoWarningResponse
  | VersionResponse
  | ModelsResponse

// --- KataGo Lifecycle Types (Step 6 Module 6) ---

/** KataGo process lifecycle states (Step 6 Section 2.2, Module 6) */
export type KataGoStatusState =
  | 'idle'
  | 'starting'
  | 'ready'
  | 'analyzing'
  | 'degraded'
  | 'failed'
  | 'restarting'
  | 'fallback'

/** KataGo process status */
export interface KataGoStatus {
  readonly state: KataGoStatusState
  readonly message: string
  /** Number of pending analysis queries */
  readonly pendingQueries: number
  /** Uptime in seconds (0 if not running) */
  readonly uptimeSeconds: number
}

/** KataGo initialization configuration */
export interface KataGoConfig {
  /** Path to KataGo binary (resolved by GPU detection) */
  readonly binaryPath: string
  /** Path to neural network model file */
  readonly modelPath: string
  /** Path to KataGo configuration file */
  readonly configPath: string
  /** Maximum number of concurrent analysis queries */
  readonly maxConcurrentQueries?: number
  /** Default max visits per query */
  readonly defaultMaxVisits?: number
}

/** GPU backend detection result */
export interface BackendInfo {
  /** Detected GPU backend name */
  readonly backend: 'metal' | 'cuda' | 'tensorrt' | 'opencl' | 'eigenavx2' | 'eigen'
  /** Human-readable GPU name */
  readonly gpuName: string
  /** Resolved binary path for the detected backend */
  readonly binaryPath: string
  /** Whether first-run tuning is needed (OpenCL only) */
  readonly needsTuning: boolean
}

/** Visits tier configuration (Step 2 Section 9) */
export interface VisitsTierConfig {
  /** Quick analysis (real-time feedback) */
  readonly fast: number
  /** Standard analysis */
  readonly standard: number
  /** Deep analysis (full review) */
  readonly deep: number
}

/** Circuit breaker state */
export interface CircuitBreakerState {
  /** Current circuit state */
  readonly state: 'closed' | 'open' | 'half-open'
  /** Number of consecutive failures */
  readonly failureCount: number
  /** When the circuit last opened (Unix timestamp, or null) */
  readonly lastFailure: number | null
  /** When the circuit will next attempt half-open (Unix timestamp, or null) */
  readonly nextRetry: number | null
}

/** KataGo version info */
export interface VersionInfo {
  readonly version: string
  readonly gitHash: string
}

// =============================================================================
// PART 3: EXPLANATION ENGINE TYPES
// =============================================================================
// These types support the template explanation engine designed in Step 4.
// They map to Step 4's pattern matching pipeline and 3-tier system.
// =============================================================================

/** Explanation audience tier (Step 4 Section 5.1) */
export type Tier = 'beginner' | 'intermediate' | 'advanced'

/**
 * Position category determined by the pattern classifier.
 * Step 4 Section 4.2 (Position Category Detection).
 */
export type PositionCategory =
  | 'life_death'
  | 'ko'
  | 'seki'
  | 'move_quality'
  | 'position'
  | 'opening'
  | 'middle_game'
  | 'endgame'
  | 'alternative'
  | 'generic'

/**
 * Pattern ID following Step 4 Section 10.1 convention.
 * Format: P-T{tier}-{category_code}-{sequence}
 */
export type PatternId = string

/** Move quality classification based on winrate delta */
export type MoveQuality =
  | 'blunder'
  | 'mistake'
  | 'inaccuracy'
  | 'acceptable'
  | 'good'
  | 'excellent'
  | 'brilliant'

/**
 * Computed fields derived from KataGo analysis.
 * Step 4 Section 3.1.3 (Computed Fields).
 */
export interface ComputedFields {
  /** Winrate change from previous position (current-player perspective) */
  readonly winrateDelta: number | null
  /** Score lead change from previous position */
  readonly scoreLeadDelta: number | null
  /** Whether the actual move matched the best move */
  readonly bestMovePlayed: boolean
  /** Rank of the actual move in moveInfos (null if not found) */
  readonly moveRank: number | null
  /** Winrate gap between best and second-best move */
  readonly topMoveGap: number
  /** Current game phase */
  readonly movePhase: 'opening' | 'middle_game' | 'endgame'
  /** Analysis confidence level */
  readonly confidenceLevel: 'high' | 'medium' | 'low'
}

/**
 * Template output from the explanation engine.
 * This is what the UI receives and displays.
 */
export interface ExplanationOutput {
  /** Primary explanation text (rendered from template) */
  readonly text: string
  /** Which pattern(s) matched */
  readonly matchedPatterns: readonly PatternId[]
  /** Position category determined by classifier */
  readonly category: PositionCategory
  /** Move quality assessment (null for position-only analysis) */
  readonly moveQuality: MoveQuality | null
  /** Tier used for this explanation */
  readonly tier: Tier
  /** Computed fields used in the explanation */
  readonly computed: ComputedFields
  /** Whether this explanation used a mandatory template (L/D, Ko, Seki) */
  readonly isMandatoryTemplate: boolean
  /** Whether LLM fallback was used (no template matched) */
  readonly usedLLMFallback: boolean
}

/** Pattern catalog entry (Step 4 Section 5.2) */
export interface PatternEntry {
  readonly id: PatternId
  readonly tier: Tier
  readonly category: PositionCategory
  readonly trigger: {
    readonly conditions: readonly TriggerCondition[]
    readonly requiresOptional?: readonly string[]
    readonly requiresDelta: boolean
  }
  readonly template: {
    readonly text: string
    readonly slots: Readonly<Record<string, string>>
  }
  readonly fallbackId: PatternId | null
  readonly mandatory: boolean
}

/** Trigger condition for pattern matching */
export interface TriggerCondition {
  readonly field: string
  readonly operator: '<' | '>' | '<=' | '>=' | '==' | '!=' | 'in' | 'between'
  readonly value: number | string | readonly number[]
}

/** Full pattern catalog */
export interface PatternCatalog {
  readonly patterns: readonly PatternEntry[]
  readonly version: string
  readonly totalCount: number
  readonly countByTier: Readonly<Record<Tier, number>>
  readonly countByCategory: Readonly<Record<PositionCategory, number>>
}

/** Coverage statistics for the template engine */
export interface CoverageStats {
  readonly totalAnalyzed: number
  readonly templateHits: number
  readonly templatePartials: number
  readonly mandatoryHits: number
  readonly llmRequired: number
  readonly coveragePercent: number
  readonly byCategory: Readonly<
    Record<
      PositionCategory,
      {
        readonly total: number
        readonly covered: number
        readonly percent: number
      }
    >
  >
}

// =============================================================================
// PART 4: GAMIFICATION TYPES
// =============================================================================
// These types support Step 6 Module 10 (gamification).
// =============================================================================

/** Quest definition */
export interface Quest {
  readonly id: string
  readonly type: 'play_game' | 'win_game' | 'complete_review' | 'daily_login' | 'play_moves'
  readonly title: string
  readonly description: string
  readonly target: number
  readonly progress: number
  readonly completed: boolean
  /** Date this quest is for (ISO YYYY-MM-DD) */
  readonly date: string
  readonly reward: QuestReward
}

/** Reward for completing a quest */
export interface QuestReward {
  readonly xp: number
  readonly badgeId?: string
}

/** Badge/achievement definition */
export interface Achievement {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly icon: string
  /** Whether the user has earned this badge */
  readonly earned: boolean
  /** When the badge was earned (Unix timestamp, null if not earned) */
  readonly earnedAt: number | null
  /** Unlock condition description */
  readonly condition: string
}

/** Player level information */
export interface PlayerLevel {
  readonly level: number
  readonly currentXP: number
  readonly xpForNextLevel: number
  readonly totalXP: number
}

/** Level-up result (null if no level-up occurred) */
export interface LevelUpResult {
  readonly previousLevel: number
  readonly newLevel: number
  readonly xpGained: number
}

/** Streak data */
export interface StreakData {
  readonly currentStreak: number
  readonly longestStreak: number
  readonly lastActivityDate: string | null
}

/** XP source for tracking */
export type XPSource = 'game_complete' | 'quest_complete' | 'daily_login' | 'achievement'

/** Game event that may trigger achievement checks */
export interface GameEvent {
  readonly type: 'game_completed' | 'move_played' | 'quest_completed' | 'daily_login'
  readonly data: Readonly<Record<string, string | number | boolean>>
}

/** Player progress summary (returned by gamification_get_progress) */
export interface PlayerProgress {
  readonly level: PlayerLevel
  readonly streak: StreakData
  readonly badges: readonly Achievement[]
  readonly quests: readonly Quest[]
}

// =============================================================================
// PART 5: ERROR TYPES
// =============================================================================
// Discriminated union error hierarchy.
// Each module has its own error type, all extending a base pattern.
// =============================================================================

/** Base error structure for all application errors */
export interface AppErrorBase {
  /** Error code for programmatic handling */
  readonly code: string
  /** Human-readable error message */
  readonly message: string
  /** Optional details for debugging */
  readonly details?: Readonly<Record<string, string | number | boolean>>
}

/** Rules engine errors (Step 6 Module 5) */
export interface RulesError extends AppErrorBase {
  readonly module: 'rules'
  readonly code:
    | 'INVALID_BOARD_SIZE'
    | 'INVALID_INDEX'
    | 'OCCUPIED_INTERSECTION'
    | 'SUICIDE_FORBIDDEN'
    | 'KO_VIOLATION'
    | 'SUPERKO_VIOLATION'
    | 'GAME_ALREADY_ENDED'
}

/** KataGo bridge errors (Step 6 Module 6) */
export interface KataGoError extends AppErrorBase {
  readonly module: 'katago'
  readonly code:
    | 'BINARY_NOT_FOUND'
    | 'MODEL_NOT_FOUND'
    | 'STARTUP_FAILED'
    | 'STARTUP_TIMEOUT'
    | 'PROCESS_CRASHED'
    | 'ANALYSIS_TIMEOUT'
    | 'ANALYSIS_ERROR'
    | 'CIRCUIT_BREAKER_OPEN'
    | 'INVALID_QUERY'
    | 'INVALID_RESPONSE'
    | 'SHUTDOWN_ERROR'
    | 'TUNING_REQUIRED'
}

/** Game engine errors (Step 6 Module 7) */
export interface GameError extends AppErrorBase {
  readonly module: 'game'
  readonly code:
    | 'NO_ACTIVE_GAME'
    | 'GAME_ALREADY_ACTIVE'
    | 'INVALID_CONFIG'
    | 'NOT_PLAYERS_TURN'
    | 'GAME_ENDED'
    | 'REVIEW_MODE_ONLY'
    | 'TIMER_EXPIRED'
}

/** Explanation engine errors (Step 6 Module 8) */
export interface ExplanationError extends AppErrorBase {
  readonly module: 'explanation'
  readonly code:
    | 'INVALID_ANALYSIS_DATA'
    | 'TEMPLATE_RENDER_ERROR'
    | 'L3_VALIDATION_FAILED'
    | 'NO_PATTERN_MATCH'
}

/** Storage errors (Step 6 Module 2) */
export interface StorageError extends AppErrorBase {
  readonly module: 'storage'
  readonly code:
    | 'DB_CONNECTION_FAILED'
    | 'MIGRATION_FAILED'
    | 'WRITE_FAILED'
    | 'READ_FAILED'
    | 'NOT_FOUND'
    | 'CONSTRAINT_VIOLATION'
    | 'SERIALIZATION_ERROR'
}

/** Gamification errors (Step 6 Module 10) */
export interface GamificationError extends AppErrorBase {
  readonly module: 'gamification'
  readonly code:
    | 'QUEST_NOT_FOUND'
    | 'QUEST_ALREADY_COMPLETED'
    | 'INVALID_XP_AMOUNT'
    | 'ACHIEVEMENT_ALREADY_EARNED'
}

/** Union of all application errors */
export type AppError =
  | RulesError
  | KataGoError
  | GameError
  | ExplanationError
  | StorageError
  | GamificationError

/**
 * Result type for operations that may fail.
 * Inspired by Rust's Result<T, E> — forces callers to handle errors explicitly.
 */
export type Result<T, E extends AppErrorBase = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

/** Convenience constructors for Result type */
export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function Err<E extends AppErrorBase>(error: E): Result<never, E> {
  return { ok: false, error }
}

// =============================================================================
// PART 6: MODULE INTERFACE CONTRACTS
// =============================================================================
// These are the binding contracts between modules.
// Step 11+ teams MUST implement these interfaces exactly.
// No deviation without Step 7 amendment.
// =============================================================================

// ---------------------------------------------------------------------------
// Interface 1: IRulesEngine (Step 6 Module 5: rules-engine)
// ---------------------------------------------------------------------------
// Pure functions implementing Tromp-Taylor rules.
// No side effects, no I/O, no state. All methods are synchronous.
// DKS coverage: Rules TT-01 through TT-10, Constraints C01-C12.
// ---------------------------------------------------------------------------

export interface IRulesEngine {
  /**
   * Create a new empty board of the given size.
   * DKS C13: All intersections initialized to 0 (Empty).
   *
   * @param size - Board size (9, 13, or 19). DKS C01.
   * @returns A new empty BoardState.
   * @throws RulesError with code INVALID_BOARD_SIZE if size is not 9, 13, or 19.
   */
  createBoard(size: BoardSize): BoardState

  /**
   * Check if placing a stone at the given index is legal.
   * Validates: occupied check (C06), suicide (C10), ko (C09), superko (C08).
   *
   * @param state - Current game state (includes board, ko point, position history).
   * @param index - Board index where the stone would be placed. Range: [0, size*size).
   * @returns true if the move is legal, false otherwise.
   * @throws RulesError with code INVALID_INDEX if index is out of bounds (C02).
   */
  isLegalMove(state: GameState, index: number): boolean

  /**
   * Get all legal move indices for the current player.
   * Includes all intersections where isLegalMove returns true.
   * Pass is always legal and is NOT included in the returned array.
   *
   * @param state - Current game state.
   * @returns Array of board indices where the current player can legally play.
   */
  getLegalMoves(state: GameState): number[]

  /**
   * Apply a stone placement at the given index and return the new game state.
   * Executes the full Tromp-Taylor move sequence:
   *   1. Place stone (TT-07 step 1)
   *   2. Remove opponent's zero-liberty groups (TT-07 step 2, C11)
   *   3. Remove own zero-liberty groups if suicide is allowed (TT-07 step 3)
   *   4. Update Zobrist hash (DKS R31)
   *   5. Update position history (DKS R39)
   *   6. Update ko point (DKS R29)
   *
   * The original state is NOT modified (immutable operation).
   *
   * @param state - Current game state.
   * @param index - Board index where the stone is placed.
   * @returns Result containing the new GameState, or a RulesError.
   * @throws RulesError if the move is illegal (codes: INVALID_INDEX,
   *         OCCUPIED_INTERSECTION, SUICIDE_FORBIDDEN, KO_VIOLATION,
   *         SUPERKO_VIOLATION, GAME_ALREADY_ENDED).
   */
  applyMove(state: GameState, index: number): Result<GameState, RulesError>

  /**
   * Apply a pass move and return the new game state.
   * DKS TT-05: A pass is a move where no stone is placed.
   * DKS C15: If this is the second consecutive pass, the game ends.
   *
   * @param state - Current game state.
   * @returns Result containing the new GameState (with incremented consecutivePasses).
   * @throws RulesError with code GAME_ALREADY_ENDED if game is finished (C17).
   */
  applyPass(state: GameState): Result<GameState, RulesError>

  /**
   * Compute the Chinese (area) score for the current board position.
   * DKS Section 5 (Chinese Scoring Algorithm).
   * DKS C18: All points accounted for.
   *
   * @param board - Board state to score.
   * @param komi - Komi value to apply.
   * @returns ScoreResult with full breakdown.
   */
  computeScore(board: BoardState, komi: number): ScoreResult

  /**
   * Check if the game has ended (DKS C15 or C16).
   *
   * @param state - Current game state.
   * @returns true if consecutivePasses >= 2 or phase is "finished".
   */
  isGameOver(state: GameState): boolean

  /**
   * Find the group that contains the stone at the given index.
   * DKS E15: Maximal connected set of same-color stones.
   *
   * @param board - Board state.
   * @param index - Board index of a stone. Must be occupied.
   * @returns Group containing the stone, or null if the intersection is empty.
   */
  getGroup(board: BoardState, index: number): Group | null

  /**
   * Get the territory map for the current board position.
   * Used for scoring visualization and territory counting.
   * DKS R19-R22.
   *
   * @param board - Board state.
   * @returns TerritoryMap classifying each empty intersection.
   */
  getTerritory(board: BoardState): TerritoryMap
}

// ---------------------------------------------------------------------------
// Interface 2: IKatagoBridge (Step 6 Module 6: katago-bridge)
// ---------------------------------------------------------------------------
// Manages the KataGo sidecar process lifecycle and analysis requests.
// All methods are async (Tauri command boundary involves IPC).
// Step 2 IPC spec governs the query/response protocol.
// ---------------------------------------------------------------------------

export interface IKatagoBridge {
  /**
   * Initialize the KataGo sidecar process.
   * Step 2 Section 7.2: Spawn process, verify with query_version.
   *
   * @param config - KataGo binary, model, and config paths.
   * @returns Version info on successful initialization.
   * @throws KataGoError with code BINARY_NOT_FOUND, MODEL_NOT_FOUND,
   *         STARTUP_FAILED, or STARTUP_TIMEOUT.
   */
  initialize(config: KataGoConfig): Promise<Result<VersionInfo, KataGoError>>

  /**
   * Gracefully shut down the KataGo process.
   * Step 2 Section 7.6: Close stdin, wait for exit, kill if timeout.
   *
   * @returns void on success.
   * @throws KataGoError with code SHUTDOWN_ERROR if process does not exit cleanly.
   */
  shutdown(): Promise<Result<void, KataGoError>>

  /**
   * Get the current KataGo process status.
   *
   * @returns Current lifecycle state, pending query count, and uptime.
   */
  getStatus(): KataGoStatus

  /**
   * Send an analysis query to KataGo and wait for the response.
   * Step 2 Sections 3-4: JSON-line protocol.
   *
   * @param query - Analysis query matching the AnalysisQuery type.
   * @returns The analysis response for the requested position.
   * @throws KataGoError with code ANALYSIS_TIMEOUT, ANALYSIS_ERROR,
   *         CIRCUIT_BREAKER_OPEN, INVALID_QUERY, or INVALID_RESPONSE.
   */
  analyze(query: AnalysisQuery): Promise<Result<AnalysisResponse, KataGoError>>

  /**
   * Send multiple analysis queries (batch analysis).
   * Used for full-game review where all positions are analyzed.
   *
   * @param queries - Array of analysis queries.
   * @returns Array of responses in the same order as queries.
   * @throws KataGoError if any query fails.
   */
  analyzeMultiple(
    queries: readonly AnalysisQuery[]
  ): Promise<Result<readonly AnalysisResponse[], KataGoError>>

  /**
   * Cancel a specific pending analysis query.
   * Step 2: Uses the "terminate" action.
   *
   * @param queryId - ID of the query to cancel.
   * @returns void on success.
   * @throws KataGoError if the query is not found or already completed.
   */
  cancelAnalysis(queryId: string): Promise<Result<void, KataGoError>>

  /**
   * Cancel all pending analysis queries.
   * Step 2: Uses the "terminate_all" action.
   *
   * @returns void on success.
   */
  cancelAll(): Promise<Result<void, KataGoError>>

  /**
   * Get the configured visits tier settings.
   * Step 2 Section 9.3: fast/standard/deep tiers.
   *
   * @returns Current visits tier configuration.
   */
  getVisitsTiers(): VisitsTierConfig

  /**
   * Run hardware benchmark to calibrate visits tiers.
   * Step 2 Section 10: Benchmark procedure.
   *
   * @returns Calibrated visits tier configuration.
   * @throws KataGoError if KataGo is not in Ready state.
   */
  calibrateVisitsTiers(): Promise<Result<VisitsTierConfig, KataGoError>>

  /**
   * Get GPU backend detection results.
   * Step 2 Section 6.3: Backend detection algorithm.
   *
   * @returns Detected backend information.
   */
  getBackendInfo(): Promise<Result<BackendInfo, KataGoError>>

  /**
   * Check if KataGo is healthy and able to process queries.
   *
   * @returns true if state is "ready" or "analyzing".
   */
  isHealthy(): boolean

  /**
   * Get the circuit breaker state.
   * Step 2 Section 7.5: 5 failures / 10 min window.
   *
   * @returns Current circuit breaker state.
   */
  getCircuitBreakerState(): CircuitBreakerState
}

// ---------------------------------------------------------------------------
// Interface 3: IExplanationEngine (Step 6 Module 8: explanation-engine)
// ---------------------------------------------------------------------------
// Transforms KataGo analysis into human-readable explanations.
// Pure transformation function: AnalysisResponse -> ExplanationOutput.
// All methods are synchronous (no I/O needed).
// Step 4 design governs the template matching pipeline.
// ---------------------------------------------------------------------------

export interface IExplanationEngine {
  /**
   * Generate an explanation for a position based on KataGo analysis.
   * This is the core method implementing Step 4's processing pipeline:
   *   1. Extract KataGo fields (Section 3)
   *   2. Compute deltas if previous analysis available (Section 3.1.3)
   *   3. Classify position category (Section 4.2)
   *   4. Select template via priority chain (Section 4.1)
   *   5. Bind slots and render text (Section 5.2-5.3)
   *   6. Validate output (Section 9.3 — L3 validator)
   *
   * MANDATORY: Life/death, ko, seki positions ALWAYS use pre-authored
   * templates. The LLM is NEVER invoked for these categories (Step 4 Section 6).
   *
   * @param current - KataGo analysis for the current position.
   * @param previous - KataGo analysis for the previous position, or null.
   * @param actualMove - The move that was actually played, or null for position-only analysis.
   * @param tier - Explanation tier (beginner, intermediate, advanced).
   * @param turnNumber - Current turn number (for game phase detection).
   * @param boardSize - Board size (for game phase threshold adjustment).
   * @returns ExplanationOutput with rendered text and metadata.
   * @throws ExplanationError with code INVALID_ANALYSIS_DATA if the
   *         analysis data is malformed.
   */
  explain(
    current: AnalysisResponse,
    previous: AnalysisResponse | null,
    actualMove: GTPLocation | null,
    tier: Tier,
    turnNumber: number,
    boardSize: BoardSize
  ): Result<ExplanationOutput, ExplanationError>

  /**
   * Get the full pattern catalog.
   * Returns all 90 patterns (30 per tier) for inspection and testing.
   *
   * @returns The complete pattern catalog with metadata.
   */
  getPatternCatalog(): PatternCatalog

  /**
   * Get coverage statistics from analyzed positions.
   * Used to measure template coverage per Step 4 Section 8.
   *
   * @returns Coverage breakdown by category and overall percentage.
   */
  getCoverageStats(): CoverageStats

  /**
   * Set the default explanation tier.
   * This is stored as a user preference.
   *
   * @param tier - The new default tier.
   */
  setDefaultTier(tier: Tier): void

  /**
   * Get the current default explanation tier.
   *
   * @returns The current default tier.
   */
  getDefaultTier(): Tier
}

// ---------------------------------------------------------------------------
// Interface 4: IGameEngine (Step 6 Module 7: game-engine)
// ---------------------------------------------------------------------------
// Game session orchestration. Manages Zustand store (GameReducer).
// Coordinates between IRulesEngine (validation) and IStoragePort (persistence).
// ---------------------------------------------------------------------------

export interface IGameEngine {
  /**
   * Create a new game session.
   * DKS C13: Board starts empty. DKS C14: Black moves first.
   *
   * @param config - Game configuration (board size, komi, rules, mode).
   * @returns New game session.
   * @throws GameError with code GAME_ALREADY_ACTIVE if a game is in progress,
   *         or INVALID_CONFIG if config is invalid.
   */
  createGame(config: GameConfig): Promise<Result<GameSession, GameError>>

  /**
   * Play a stone at the given board index.
   * Delegates to IRulesEngine for validation and state update.
   * Persists the move via IStoragePort.
   *
   * @param index - Board index where the stone is placed.
   * @returns PlayMoveResult with the updated state.
   * @throws GameError with code NO_ACTIVE_GAME if no game is in progress.
   * @throws RulesError if the move is illegal.
   */
  playMove(index: number): Result<PlayMoveResult, GameError | RulesError>

  /**
   * Play a pass move.
   * DKS TT-05, C15: Two consecutive passes end the game.
   *
   * @returns PlayMoveResult with the updated state.
   * @throws GameError with code NO_ACTIVE_GAME or GAME_ENDED.
   */
  playPass(): Result<PlayMoveResult, GameError | RulesError>

  /**
   * Resign the current game.
   * DKS C16: The resigning player loses immediately.
   *
   * @param player - The player who is resigning.
   * @returns GameResult with winner and result string.
   * @throws GameError with code NO_ACTIVE_GAME or GAME_ENDED.
   */
  resignGame(player: Player): Result<GameResult, GameError>

  /**
   * Request an AI move from KataGo.
   * The feature layer calls this, which internally uses IKatagoBridge.
   * The AI move is then applied via playMove().
   *
   * @returns PlayMoveResult after the AI's move is applied.
   * @throws GameError with code NO_ACTIVE_GAME.
   * @throws KataGoError if analysis fails.
   */
  requestAIMove(): Promise<Result<PlayMoveResult, GameError | KataGoError>>

  /**
   * End the current game (triggers scoring if applicable).
   *
   * @returns GameResult with final score.
   * @throws GameError with code NO_ACTIVE_GAME.
   */
  endGame(): Promise<Result<GameResult, GameError>>

  /**
   * Navigate to a specific move number in review mode.
   *
   * @param moveNumber - The move number to navigate to.
   * @throws GameError with code REVIEW_MODE_ONLY if not in review mode.
   */
  goToMove(moveNumber: number): Result<GameState, GameError>

  /**
   * Navigate forward one move in review mode.
   *
   * @throws GameError with code REVIEW_MODE_ONLY.
   */
  goForward(): Result<GameState, GameError>

  /**
   * Navigate backward one move in review mode.
   *
   * @throws GameError with code REVIEW_MODE_ONLY.
   */
  goBack(): Result<GameState, GameError>

  /**
   * Get the current game state.
   *
   * @returns Current GameState, or null if no game is active.
   */
  getGameState(): GameState | null

  /**
   * Get the timer state.
   *
   * @returns TimerState, or null if no time control or no active game.
   */
  getTimerState(): TimerState | null

  /**
   * Pause the game timer.
   *
   * @throws GameError if no active game or no time control.
   */
  pauseTimer(): Result<void, GameError>

  /**
   * Resume the game timer.
   *
   * @throws GameError if no active game or no time control.
   */
  resumeTimer(): Result<void, GameError>
}

// ---------------------------------------------------------------------------
// Interface 5: IGamificationService (Step 6 Module 10: gamification)
// ---------------------------------------------------------------------------
// Quest system, XP/levels, streaks, badges.
// Depends on IStoragePort for persistence and IGameEngine for events.
// ---------------------------------------------------------------------------

export interface IGamificationService {
  /**
   * Get the daily quests for the given date.
   * If no quests exist for the date, generates new ones.
   *
   * @param date - ISO date string (YYYY-MM-DD). Defaults to today.
   * @returns Array of quests with progress and completion state.
   * @throws StorageError if persistence fails.
   */
  getDailyQuests(date?: string): Promise<Result<readonly Quest[], StorageError>>

  /**
   * Mark a quest as completed and distribute its reward.
   *
   * @param questId - ID of the quest to complete.
   * @returns The quest reward (XP, optional badge).
   * @throws GamificationError with code QUEST_NOT_FOUND or QUEST_ALREADY_COMPLETED.
   */
  completeQuest(questId: string): Promise<Result<QuestReward, GamificationError>>

  /**
   * Refresh daily quests (generate new ones).
   * Used when the date changes or quests need to be regenerated.
   *
   * @returns New array of quests.
   */
  refreshQuests(): Promise<Result<readonly Quest[], StorageError>>

  /**
   * Get the player's current level information.
   *
   * @returns Player level with XP details.
   */
  getPlayerLevel(): Promise<Result<PlayerLevel, StorageError>>

  /**
   * Award XP to the player from a specific source.
   *
   * @param amount - Amount of XP to award. Must be positive.
   * @param source - Source of the XP (game_complete, quest_complete, etc.).
   * @returns LevelUpResult if the player leveled up, or null.
   * @throws GamificationError with code INVALID_XP_AMOUNT if amount <= 0.
   */
  addXP(amount: number, source: XPSource): Promise<Result<LevelUpResult | null, GamificationError>>

  /**
   * Get the player's streak data.
   *
   * @returns Current streak, longest streak, and last activity date.
   */
  getStreak(): Promise<Result<StreakData, StorageError>>

  /**
   * Record daily activity for streak tracking.
   * If called on a new day, increments the streak. If a day was missed,
   * resets the streak to 1.
   *
   * @returns Updated streak data.
   */
  recordDailyActivity(): Promise<Result<StreakData, StorageError>>

  /**
   * Get all achievements with their earned/unearned status.
   *
   * @returns Array of all defined achievements.
   */
  getAchievements(): Promise<Result<readonly Achievement[], StorageError>>

  /**
   * Check if any achievements should be unlocked based on a game event.
   *
   * @param event - The game event to check against achievement conditions.
   * @returns Array of newly unlocked achievements (empty if none).
   */
  checkAndUnlockAchievements(
    event: GameEvent
  ): Promise<Result<readonly Achievement[], StorageError>>

  /**
   * Get the complete player progress summary.
   *
   * @returns Combined level, streak, badge, and quest data.
   */
  getProgress(): Promise<Result<PlayerProgress, StorageError>>
}

// ---------------------------------------------------------------------------
// Interface 6: IStoragePort (Step 6 Module 2: storage)
// ---------------------------------------------------------------------------
// All database access goes through this port.
// Production adapter: TauriStorageAdapter (calls Rust-side SQLite commands).
// Test adapter: MemoryStorageAdapter (in-memory Map-based).
// ---------------------------------------------------------------------------

export interface IStoragePort {
  /**
   * Save a new game record.
   *
   * @param game - Game data to persist.
   * @returns The generated game ID.
   * @throws StorageError with code WRITE_FAILED or CONSTRAINT_VIOLATION.
   */
  saveGame(game: NewGamePayload): Promise<Result<string, StorageError>>

  /**
   * Load a game record by ID.
   *
   * @param gameId - ID of the game to load.
   * @returns Game record, or null if not found.
   * @throws StorageError with code READ_FAILED.
   */
  loadGame(gameId: string): Promise<Result<GameRecord | null, StorageError>>

  /**
   * List game summaries with optional filtering.
   *
   * @param filter - Optional filter criteria.
   * @returns Array of game summaries.
   */
  listGames(filter?: GameFilter): Promise<Result<readonly GameSummary[], StorageError>>

  /**
   * Delete a game and all associated data (moves, analysis).
   * Cascading delete via FK constraints.
   *
   * @param gameId - ID of the game to delete.
   * @throws StorageError with code NOT_FOUND or WRITE_FAILED.
   */
  deleteGame(gameId: string): Promise<Result<void, StorageError>>

  /**
   * Append a move to a game's move log.
   * Append-only: moves are never updated or deleted during a game.
   *
   * @param gameId - ID of the game.
   * @param move - Move data to append.
   * @throws StorageError with code WRITE_FAILED or CONSTRAINT_VIOLATION.
   */
  appendMove(gameId: string, move: MoveRecord): Promise<Result<void, StorageError>>

  /**
   * Get all moves for a game, ordered by move number.
   *
   * @param gameId - ID of the game.
   * @returns Ordered array of move records.
   */
  getMoves(gameId: string): Promise<Result<readonly MoveRecord[], StorageError>>

  /**
   * Get a setting value by key.
   *
   * @param key - Setting key.
   * @returns Parsed setting value, or null if not set.
   */
  getSetting(key: string): Promise<Result<string | null, StorageError>>

  /**
   * Set a setting value.
   *
   * @param key - Setting key.
   * @param value - Setting value (will be JSON-serialized).
   */
  setSetting(key: string, value: string): Promise<Result<void, StorageError>>

  /**
   * Export a game as SGF format string.
   *
   * @param gameId - ID of the game to export.
   * @returns SGF formatted string.
   */
  exportSGF(gameId: string): Promise<Result<string, StorageError>>
}

/** Payload for creating a new game in storage */
export interface NewGamePayload {
  readonly userId: string
  readonly boardSize: BoardSize
  readonly rules: RulesetString
  readonly komi: number
  readonly mode: GameMode
}

/** Full game record from storage (includes moves) */
export interface GameRecord {
  readonly gameId: string
  readonly userId: string
  readonly boardSize: BoardSize
  readonly rules: RulesetString
  readonly komi: number
  readonly mode: GameMode
  readonly result: string | null
  readonly startedAt: number
  readonly endedAt: number | null
  readonly moves: readonly MoveRecord[]
}

// =============================================================================
// PART 7: TAURI COMMAND PAYLOAD TYPES
// =============================================================================
// These are the exact shapes sent over the Tauri IPC boundary.
// Every payload has a corresponding Zod schema in Part 8.
// Command names match Step 6 Section 5.2 catalog.
// =============================================================================

// --- Storage Commands ---

export interface StorageSaveGamePayload {
  readonly userId: string
  readonly boardSize: number
  readonly rules: string
  readonly komi: number
  readonly mode: string
}

export interface StorageLoadGamePayload {
  readonly gameId: string
}

export interface StorageListGamesPayload {
  readonly mode?: string
  readonly boardSize?: number
  readonly completed?: boolean
  readonly limit?: number
  readonly offset?: number
}

export interface StorageDeleteGamePayload {
  readonly gameId: string
}

export interface StorageGetSettingPayload {
  readonly key: string
}

export interface StorageSetSettingPayload {
  readonly key: string
  readonly value: string
}

// --- KataGo Commands ---

export interface KataGoInitializePayload {
  readonly binaryPath: string
  readonly modelPath: string
  readonly configPath: string
  readonly maxConcurrentQueries?: number
  readonly defaultMaxVisits?: number
}

export interface KataGoAnalyzePayload {
  readonly id: string
  readonly moves: readonly [string, string][]
  readonly rules: string | Record<string, string | boolean>
  readonly boardXSize: number
  readonly boardYSize: number
  readonly komi?: number
  readonly initialStones?: readonly [string, string][]
  readonly analyzeTurns?: readonly number[]
  readonly maxVisits?: number
  readonly includeOwnership?: boolean
  readonly includeOwnershipStdev?: boolean
  readonly includeMovesOwnership?: boolean
  readonly includePolicy?: boolean
  readonly includePVVisits?: boolean
}

export interface KataGoCancelPayload {
  readonly queryId: string
}

// --- Game Commands ---

export interface GameCreatePayload {
  readonly boardSize: number
  readonly komi: number
  readonly rules: string
  readonly mode: string
  readonly aiLevel?: number
  readonly playerColor?: string
}

export interface GamePlayMovePayload {
  readonly gameId: string
  readonly index: number
}

export interface GamePlayPassPayload {
  readonly gameId: string
}

export interface GameResignPayload {
  readonly gameId: string
  readonly player: string
}

export interface GameLoadPayload {
  readonly gameId: string
}

export interface GameExportSGFPayload {
  readonly gameId: string
}

// --- Explanation Commands ---

export interface ExplanationGeneratePayload {
  /** The current analysis data (validated against AnalysisResponseSchema) */
  readonly currentAnalysis: AnalysisResponse
  /** The previous analysis data, if available */
  readonly previousAnalysis?: AnalysisResponse
  /** The actual move played (GTP notation) */
  readonly actualMove?: string
  /** Explanation tier */
  readonly tier: string
  /** Turn number for game phase detection */
  readonly turnNumber: number
  /** Board size for threshold adjustment */
  readonly boardSize: number
}

export interface ExplanationSetTierPayload {
  readonly tier: string
}

// --- Gamification Commands ---

export interface GamificationGetQuestsPayload {
  readonly date?: string
}

export interface GamificationCompleteQuestPayload {
  readonly questId: string
}

export interface GamificationCheckAchievementsPayload {
  readonly type: string
  readonly data: Record<string, string | number | boolean>
}

// =============================================================================
// PART 8: ZOD VALIDATION SCHEMAS
// =============================================================================
// Every external boundary has a Zod schema.
// Boundaries: (1) Tauri command inputs, (2) KataGo responses, (3) Settings.
// =============================================================================

// ---------------------------------------------------------------------------
// 8.1: Foundational Schemas
// ---------------------------------------------------------------------------

export const BoardSizeSchema = z.union([z.literal(9), z.literal(13), z.literal(19)])

export const PlayerSchema = z.union([z.literal('B'), z.literal('W')])

export const GTPLocationSchema = z.string().min(1).max(5)

export const TierSchema = z.union([
  z.literal('beginner'),
  z.literal('intermediate'),
  z.literal('advanced'),
])

export const GameModeSchema = z.union([
  z.literal('vs-ai'),
  z.literal('review'),
  z.literal('tutorial'),
])

export const RulesetStringSchema = z.union([
  z.literal('tromp-taylor'),
  z.literal('chinese'),
  z.literal('chinese-ogs'),
  z.literal('chinese-kgs'),
  z.literal('japanese'),
  z.literal('korean'),
  z.literal('stone-scoring'),
  z.literal('aga'),
  z.literal('bga'),
  z.literal('new-zealand'),
  z.literal('aga-button'),
])

// ---------------------------------------------------------------------------
// 8.2: KataGo Response Validation Schemas
// ---------------------------------------------------------------------------
// These schemas validate the JSON responses from KataGo's stdout.
// Used by the response parser in katago-bridge module.
// ---------------------------------------------------------------------------

export const MoveInfoSchema = z.object({
  move: z.string(),
  visits: z.number().int().nonnegative(),
  edgeVisits: z.number().int().nonnegative(),
  winrate: z.number().min(0).max(1),
  scoreMean: z.number(),
  scoreLead: z.number(),
  scoreStdev: z.number().nonnegative(),
  scoreSelfplay: z.number(),
  prior: z.number().min(0).max(1),
  utility: z.number(),
  utilityLcb: z.number(),
  lcb: z.number(),
  weight: z.number().nonnegative(),
  edgeWeight: z.number().nonnegative(),
  order: z.number().int().nonnegative(),
  playSelectionValue: z.number().nonnegative(),
  pv: z.array(z.string()),
  // Conditional fields
  pvVisits: z.array(z.number().int().nonnegative()).optional(),
  pvEdgeVisits: z.array(z.number().int().nonnegative()).optional(),
  noResultValue: z.number().optional(),
  humanPrior: z.number().optional(),
  isSymmetryOf: z.string().optional(),
  ownership: z.array(z.number()).optional(),
  ownershipStdev: z.array(z.number().nonnegative()).optional(),
})

export const RootInfoSchema = z.object({
  winrate: z.number().min(0).max(1),
  scoreLead: z.number(),
  scoreSelfplay: z.number(),
  scoreStdev: z.number().nonnegative(),
  utility: z.number(),
  visits: z.number().int().nonnegative(),
  currentPlayer: PlayerSchema,
  thisHash: z.string(),
  symHash: z.string(),
  lcb: z.number(),
  utilityLcb: z.number(),
  rawWinrate: z.number().min(0).max(1),
  rawLead: z.number(),
  rawScoreSelfplay: z.number(),
  rawScoreSelfplayStdev: z.number().nonnegative(),
  rawNoResultProb: z.number(),
  rawStWrError: z.number().nonnegative(),
  rawStScoreError: z.number().nonnegative(),
  rawVarTimeLeft: z.number(),
  // Conditional human model fields
  humanWinrate: z.number().optional(),
  humanScoreMean: z.number().optional(),
  humanScoreStdev: z.number().optional(),
  humanStWrError: z.number().optional(),
  humanStScoreError: z.number().optional(),
})

export const AnalysisResponseSchema = z.object({
  id: z.string(),
  isDuringSearch: z.boolean(),
  turnNumber: z.number().int().nonnegative(),
  moveInfos: z.array(MoveInfoSchema),
  rootInfo: RootInfoSchema,
  ownership: z.array(z.number()).optional(),
  ownershipStdev: z.array(z.number()).optional(),
  policy: z.array(z.number()).optional(),
  humanPolicy: z.array(z.number()).optional(),
})

export const NoResultResponseSchema = z.object({
  id: z.string(),
  isDuringSearch: z.literal(false),
  turnNumber: z.number().int().nonnegative(),
  noResults: z.literal(true),
})

export const KataGoErrorResponseSchema = z.object({
  error: z.string(),
  id: z.string().optional(),
  field: z.string().optional(),
})

export const KataGoWarningResponseSchema = z.object({
  warning: z.string(),
  id: z.string(),
  field: z.string(),
})

export const VersionResponseSchema = z.object({
  id: z.string(),
  action: z.literal('query_version'),
  version: z.string(),
  git_hash: z.string(),
})

export const ModelInfoSchema = z.object({
  name: z.string(),
  internalName: z.string(),
  maxBatchSize: z.number().int().positive(),
  usesHumanSLProfile: z.boolean(),
  version: z.number().int(),
  usingFP16: z.string(),
})

export const ModelsResponseSchema = z.object({
  id: z.string(),
  action: z.literal('query_models'),
  models: z.array(ModelInfoSchema),
})

/**
 * Discriminated union schema for all KataGo responses.
 * The parser should attempt each variant in order:
 * 1. Check for "error" field -> KataGoErrorResponse
 * 2. Check for "warning" field -> KataGoWarningResponse
 * 3. Check for "noResults" field -> NoResultResponse
 * 4. Check for "action" field -> VersionResponse or ModelsResponse
 * 5. Default -> AnalysisResponse
 */
export const KataGoResponseSchema = z.union([
  KataGoErrorResponseSchema,
  KataGoWarningResponseSchema,
  NoResultResponseSchema,
  VersionResponseSchema,
  ModelsResponseSchema,
  AnalysisResponseSchema,
])

// ---------------------------------------------------------------------------
// 8.3: Tauri Command Input Validation Schemas
// ---------------------------------------------------------------------------

// --- Storage Command Schemas ---

export const StorageSaveGameSchema = z.object({
  userId: z.string().uuid(),
  boardSize: BoardSizeSchema,
  rules: RulesetStringSchema,
  komi: z.number().min(-150).max(150),
  mode: GameModeSchema,
})

export const StorageLoadGameSchema = z.object({
  gameId: z.string().uuid(),
})

export const StorageListGamesSchema = z.object({
  mode: GameModeSchema.optional(),
  boardSize: BoardSizeSchema.optional(),
  completed: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
})

export const StorageDeleteGameSchema = z.object({
  gameId: z.string().uuid(),
})

export const StorageGetSettingSchema = z.object({
  key: z.string().min(1).max(100),
})

export const StorageSetSettingSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.string(),
})

// --- KataGo Command Schemas ---

export const KataGoInitializeSchema = z.object({
  binaryPath: z.string().min(1),
  modelPath: z.string().min(1),
  configPath: z.string().min(1),
  maxConcurrentQueries: z.number().int().positive().max(64).optional(),
  defaultMaxVisits: z.number().int().positive().max(100000).optional(),
})

const MoveRestrictionSchema = z.object({
  player: PlayerSchema,
  moves: z.array(GTPLocationSchema),
  untilDepth: z.number().int().positive(),
})

const RulesObjectSchema = z.object({
  ko: z.union([z.literal('SIMPLE'), z.literal('POSITIONAL'), z.literal('SITUATIONAL')]),
  scoring: z.union([z.literal('AREA'), z.literal('TERRITORY')]),
  suicide: z.boolean(),
  tax: z.union([z.literal('NONE'), z.literal('SEKI'), z.literal('ALL')]),
  whiteHandicapBonus: z.union([z.literal('0'), z.literal('N-1'), z.literal('N')]),
  hasButton: z.boolean().optional(),
  friendlyPassOk: z.boolean().optional(),
})

const RulesSchema = z.union([RulesetStringSchema, RulesObjectSchema])

export const KataGoAnalyzeSchema = z.object({
  id: z.string().min(1),
  moves: z.array(z.tuple([PlayerSchema, z.string()])),
  rules: RulesSchema,
  boardXSize: z.number().int().min(2).max(50),
  boardYSize: z.number().int().min(2).max(50),
  komi: z.number().min(-150).max(150).optional(),
  initialStones: z.array(z.tuple([PlayerSchema, z.string()])).optional(),
  initialPlayer: PlayerSchema.optional(),
  whiteHandicapBonus: z.union([z.literal('0'), z.literal('N-1'), z.literal('N')]).optional(),
  analyzeTurns: z.array(z.number().int().nonnegative()).optional(),
  maxVisits: z.number().int().positive().max(100000).optional(),
  rootPolicyTemperature: z.number().positive().optional(),
  rootFpuReductionMax: z.number().optional(),
  analysisPVLen: z.number().int().positive().optional(),
  includeOwnership: z.boolean().optional(),
  includeOwnershipStdev: z.boolean().optional(),
  includeMovesOwnership: z.boolean().optional(),
  includeMovesOwnershipStdev: z.boolean().optional(),
  includePolicy: z.boolean().optional(),
  includePVVisits: z.boolean().optional(),
  includeNoResultValue: z.boolean().optional(),
  avoidMoves: z.array(MoveRestrictionSchema).optional(),
  allowMoves: z.tuple([MoveRestrictionSchema]).optional(),
  overrideSettings: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  reportDuringSearchEvery: z.number().positive().optional(),
  priority: z.number().int().optional(),
  priorities: z.array(z.number().int()).optional(),
})

export const KataGoCancelSchema = z.object({
  queryId: z.string().min(1),
})

// --- Game Command Schemas ---

export const GameCreateSchema = z.object({
  boardSize: BoardSizeSchema,
  komi: z.number().min(-150).max(150),
  rules: RulesetStringSchema,
  mode: GameModeSchema,
  aiLevel: z.number().int().min(1).max(9).optional(),
  playerColor: PlayerSchema.optional(),
})

export const GamePlayMoveSchema = z.object({
  gameId: z.string().uuid(),
  index: z.number().int().nonnegative(),
})

export const GamePlayPassSchema = z.object({
  gameId: z.string().uuid(),
})

export const GameResignSchema = z.object({
  gameId: z.string().uuid(),
  player: PlayerSchema,
})

export const GameLoadSchema = z.object({
  gameId: z.string().uuid(),
})

export const GameExportSGFSchema = z.object({
  gameId: z.string().uuid(),
})

// --- Explanation Command Schemas ---

export const ExplanationGenerateSchema = z.object({
  currentAnalysis: AnalysisResponseSchema,
  previousAnalysis: AnalysisResponseSchema.optional(),
  actualMove: GTPLocationSchema.optional(),
  tier: TierSchema,
  turnNumber: z.number().int().nonnegative(),
  boardSize: BoardSizeSchema,
})

export const ExplanationSetTierSchema = z.object({
  tier: TierSchema,
})

// --- i18n Command Schemas ---

export const I18nGetSystemLocaleResponseSchema = z.object({
  locale: z.string().min(2).max(10),
})

// --- Analytics Command Schemas ---

export const AnalyticsSetConsentSchema = z.object({
  granted: z.boolean(),
})

// --- Gamification Command Schemas ---

export const GamificationGetQuestsSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const GamificationCompleteQuestSchema = z.object({
  questId: z.string().min(1),
})

export const GamificationCheckAchievementsSchema = z.object({
  type: z.union([
    z.literal('game_completed'),
    z.literal('move_played'),
    z.literal('quest_completed'),
    z.literal('daily_login'),
  ]),
  data: z.record(z.union([z.string(), z.number(), z.boolean()])),
})

// ---------------------------------------------------------------------------
// 8.4: Settings Validation Schemas
// ---------------------------------------------------------------------------

/** All valid setting keys with their value schemas */
export const SettingsSchemaMap = {
  theme: z.union([z.literal('light'), z.literal('dark'), z.literal('system')]),
  defaultBoardSize: BoardSizeSchema,
  defaultKomi: z.number().min(-150).max(150),
  explanationTier: TierSchema,
  locale: z.union([z.literal('en'), z.literal('ko'), z.literal('ja')]),
  analyticsConsent: z.boolean(),
  katagoBackend: z.union([
    z.literal('metal'),
    z.literal('cuda'),
    z.literal('tensorrt'),
    z.literal('opencl'),
    z.literal('eigenavx2'),
    z.literal('eigen'),
    z.literal('auto'),
  ]),
  katagoModelPath: z.string(),
  aiDifficulty: z.number().int().min(1).max(9),
  soundEnabled: z.boolean(),
  boardTheme: z.union([z.literal('classic'), z.literal('modern'), z.literal('paper')]),
} as const

export type SettingsKey = keyof typeof SettingsSchemaMap

// ---------------------------------------------------------------------------
// 8.5: Gamification Data Validation Schemas (for JSON columns)
// ---------------------------------------------------------------------------

export const QuestSchema = z.object({
  id: z.string(),
  type: z.union([
    z.literal('play_game'),
    z.literal('win_game'),
    z.literal('complete_review'),
    z.literal('daily_login'),
    z.literal('play_moves'),
  ]),
  title: z.string(),
  description: z.string(),
  target: z.number().int().positive(),
  progress: z.number().int().nonnegative(),
  completed: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reward: z.object({
    xp: z.number().int().nonnegative(),
    badgeId: z.string().optional(),
  }),
})

export const DailyQuestsSchema = z.array(QuestSchema)

export const BadgeEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  earnedAt: z.number().int().positive(),
})

export const BadgesSchema = z.array(BadgeEntrySchema)

// =============================================================================
// PART 9: THRESHOLD CONSTANTS
// =============================================================================
// These match Step 4 Section 3.4 (Threshold Definitions).
// Used by the explanation engine for pattern classification.
// =============================================================================

export const THRESHOLDS = {
  /** Winrate drop > 10% triggers "blunder" pattern */
  BLUNDER_WINRATE_DROP: 0.1,
  /** Winrate drop > 5% triggers "mistake" pattern */
  MISTAKE_WINRATE_DROP: 0.05,
  /** Winrate drop > 2% triggers "inaccuracy" pattern */
  INACCURACY_WINRATE_DROP: 0.02,
  /** Actual move is order 0 */
  GOOD_MOVE: 0,
  /** Order 0 AND topMoveGap > 3% */
  EXCELLENT_MOVE_GAP: 0.03,
  /** Order 0, prior < 5%, visits > 100 */
  BRILLIANT_PRIOR_THRESHOLD: 0.05,
  BRILLIANT_VISITS_THRESHOLD: 100,
  /** |winrate - 0.50| < 5% */
  CLOSE_GAME_THRESHOLD: 0.05,
  /** Winrate > 65% */
  WINNING_THRESHOLD: 0.65,
  /** Winrate < 35% */
  LOSING_THRESHOLD: 0.35,
  /** Winrate > 85% or < 15% */
  DECISIVE_THRESHOLD: 0.85,
  /** |scoreLeadDelta| > 2.0 */
  SCORE_SIGNIFICANT: 2.0,
  /** rootInfo.visits >= 400 */
  HIGH_CONFIDENCE_VISITS: 400,
  /** rootInfo.visits < 50 */
  LOW_CONFIDENCE_VISITS: 50,
  /** |ownership[i]| > 0.9 for group region */
  LIFE_DEATH_OWNERSHIP: 0.9,
  /** |ownership[i]| < 0.3 */
  CONTESTED_OWNERSHIP: 0.3,
  /** Ko stake threshold in points */
  KO_SIGNIFICANT_STAKE: 5.0,
} as const

/** Game phase detection thresholds per board size (Step 4 Section 4.2.4) */
export const PHASE_THRESHOLDS = {
  9: { opening: 15, middleGame: 40, rawVarTimeLeft: 15 },
  13: { opening: 25, middleGame: 90, rawVarTimeLeft: 25 },
  19: { opening: 40, middleGame: 150, rawVarTimeLeft: 40 },
} as const

/** Default komi values per board size (DKS metadata) */
export const DEFAULT_KOMI = {
  9: 5.5,
  13: 5.5,
  19: 7.5,
} as const

/** Valid board sizes array */
export const BOARD_SIZES: readonly BoardSize[] = [9, 13, 19] as const
