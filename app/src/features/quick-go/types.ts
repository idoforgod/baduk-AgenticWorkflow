// =============================================================================
// features/quick-go/types.ts — Quick Go Type Definitions
// =============================================================================
// All types for the Quick Go game mode.
// These types are internal to the feature module.
// External types come from @core/interfaces.
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  ExplanationOutput,
  GameResult,
  GTPLocation,
  Player,
  Tier,
  TimeControl,
} from '@core/interfaces'

// ---------------------------------------------------------------------------
// Game Configuration
// ---------------------------------------------------------------------------

/** Difficulty preset mapping to the 30-level system */
export type DifficultyPreset = 'beginner' | 'intermediate' | 'advanced'

/**
 * Quick Go game configuration.
 * Designed for one-tap start with sensible defaults.
 */
export interface QuickGoConfig {
  /** Board size (default: 9 for Quick Go) */
  readonly boardSize: BoardSize
  /** Komi (default: 6.5 for 9x9) */
  readonly komi: number
  /** Difficulty preset */
  readonly difficultyPreset: DifficultyPreset
  /** Exact difficulty level (1-30), overrides preset if provided */
  readonly difficultyLevel?: number
  /** Player's color (default: 'B') */
  readonly playerColor: Player
  /** Time control settings */
  readonly timeControl: TimeControl
  /** Explanation tier for post-game analysis */
  readonly explanationTier: Tier
}

/** Default Quick Go configuration — one-tap start */
export const DEFAULT_QUICK_GO_CONFIG: QuickGoConfig = {
  boardSize: 9,
  komi: 6.5,
  difficultyPreset: 'beginner',
  playerColor: 'B',
  timeControl: {
    mainTime: 180, // 3 minutes
    byoyomiPeriods: 3,
    byoyomiTime: 10, // 10 seconds per period
  },
  explanationTier: 'beginner',
} as const

// ---------------------------------------------------------------------------
// Game Phase State Machine
// ---------------------------------------------------------------------------

/**
 * Quick Go game phases.
 * Setup -> Playing -> Scoring -> Analyzing -> Complete
 *
 * Transitions:
 * - Setup -> Playing: startGame()
 * - Playing -> Scoring: two passes, timeout, or resign
 * - Scoring -> Analyzing: score computed, auto-trigger analysis
 * - Analyzing -> Complete: analysis done
 * - Any -> Complete: resign or fatal error
 */
export type QuickGoPhase = 'setup' | 'playing' | 'scoring' | 'analyzing' | 'complete'

// ---------------------------------------------------------------------------
// Timer State
// ---------------------------------------------------------------------------

/** Timer state for a single player in Quick Go */
export interface QuickGoPlayerTimer {
  /** Remaining main time in milliseconds */
  mainTimeMs: number
  /** Remaining byoyomi periods */
  byoyomiPeriodsRemaining: number
  /** Remaining time in current byoyomi period in milliseconds */
  byoyomiTimeMs: number
  /** Whether this player is in byoyomi */
  inByoyomi: boolean
  /** Whether this player has timed out */
  timedOut: boolean
}

/** Combined timer state */
export interface QuickGoTimerState {
  black: QuickGoPlayerTimer
  white: QuickGoPlayerTimer
  /** Which player's clock is running */
  activePlayer: Player | null
  /** Whether the timer is paused (e.g., during AI thinking) */
  isPaused: boolean
  /** Timestamp when the current tick started */
  lastTickTime: number | null
}

// ---------------------------------------------------------------------------
// Move Result
// ---------------------------------------------------------------------------

/** Result of attempting a player move */
export interface QuickGoMoveResult {
  /** Whether the move was successful */
  readonly success: boolean
  /** Error message if move failed */
  readonly error?: string
  /** Whether the game ended as a result */
  readonly gameEnded: boolean
  /** The move that was played (GTP coordinate) */
  readonly coordinate?: GTPLocation
}

// ---------------------------------------------------------------------------
// AI State
// ---------------------------------------------------------------------------

/** AI thinking state */
export interface AIState {
  /** Whether the AI is currently computing a move */
  isThinking: boolean
  /** When the AI started thinking (for timeout tracking) */
  thinkingStartTime: number | null
  /** The AI's chosen move (set when response arrives) */
  lastMove: GTPLocation | null
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/** A single analyzed move from the post-game review */
export interface AnalyzedMove {
  /** Move number in the game */
  readonly moveNumber: number
  /** Player who made the move */
  readonly player: Player
  /** GTP coordinate of the move played */
  readonly coordinate: GTPLocation | null
  /** Winrate before this move (from the player's perspective, 0-100) */
  readonly winrateBefore: number
  /** Winrate after this move (from the player's perspective, 0-100) */
  readonly winrateAfter: number
  /** Winrate delta (negative = blunder) */
  readonly winrateDelta: number
  /** Best move suggested by KataGo */
  readonly bestMove: GTPLocation
  /** Whether the actual move was the best move */
  readonly wasBestMove: boolean
  /** Human-readable explanation from the explanation engine */
  readonly explanation: ExplanationOutput | null
  /** The KataGo analysis response for this position */
  readonly analysisResponse: AnalysisResponse | null
}

/** Post-game analysis result */
export interface QuickGoAnalysisResult {
  /** All analyzed moves sorted by impact */
  readonly analyzedMoves: readonly AnalyzedMove[]
  /** Top 5 most impactful moves (largest winrate swing) */
  readonly topMoves: readonly AnalyzedMove[]
  /** The player's best move in the game */
  readonly bestPlayerMove: AnalyzedMove | null
  /** The player's biggest mistake */
  readonly biggestMistake: AnalyzedMove | null
  /** Overall accuracy: percentage of moves within 5% of best */
  readonly accuracy: number
  /** Whether analysis is still in progress */
  readonly isAnalyzing: boolean
  /** Number of moves analyzed so far */
  readonly analyzedCount: number
  /** Total moves to analyze */
  readonly totalMoves: number
}

// ---------------------------------------------------------------------------
// Quick Go Store State
// ---------------------------------------------------------------------------

/** Complete Quick Go store state */
export interface QuickGoState {
  // --- Game Identity ---
  /** Current game configuration */
  config: QuickGoConfig
  /** Current game phase */
  phase: QuickGoPhase

  // --- Timer ---
  timer: QuickGoTimerState

  // --- AI ---
  ai: AIState

  // --- Game Result ---
  result: GameResult | null

  // --- Analysis ---
  analysis: QuickGoAnalysisResult | null

  // --- Session Stats ---
  session: QuickGoSessionStats

  // --- Move Progress ---
  /** Approximate game progress as percentage (0-100) */
  progressPercent: number
  /** Current move number */
  moveCount: number
}

/** Session statistics across multiple games */
export interface QuickGoSessionStats {
  /** Number of games played in this session */
  gamesPlayed: number
  /** Number of wins */
  wins: number
  /** Number of losses */
  losses: number
  /** Current difficulty level (auto-adjusted) */
  currentDifficultyLevel: number
  /** Time elapsed in session in seconds */
  sessionTimeSeconds: number
}

// ---------------------------------------------------------------------------
// Quick Go Store Actions
// ---------------------------------------------------------------------------

/** Quick Go store actions */
export interface QuickGoActions {
  /** Start a new Quick Go game with the given config */
  startGame(config?: Partial<QuickGoConfig>): void
  /** Handle a player move at the given board index */
  handlePlayerMove(index: number): QuickGoMoveResult
  /** Handle a player pass */
  handlePass(): QuickGoMoveResult
  /** Handle a player resign */
  handleResign(): void
  /** Request an AI move (called after player move) */
  requestAIMove(): Promise<QuickGoMoveResult>
  /** Tick the timer (called by animation frame loop) */
  tickTimer(now: number): void
  /** End the game and compute score */
  endGame(reason: 'scoring' | 'resignation' | 'timeout'): GameResult
  /** Run post-game analysis */
  analyzeGame(): Promise<QuickGoAnalysisResult>
  /** Start a rematch with the same settings */
  rematch(): void
  /** Reset everything */
  reset(): void
  /** Set the phase (for internal state machine transitions) */
  setPhase(phase: QuickGoPhase): void
  /** Update analysis result (progressive) */
  updateAnalysis(result: QuickGoAnalysisResult): void
}

/** Combined Quick Go store type */
export type QuickGoStore = QuickGoState & QuickGoActions
