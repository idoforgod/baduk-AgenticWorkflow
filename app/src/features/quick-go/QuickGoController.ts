// =============================================================================
// features/quick-go/QuickGoController.ts — Main Game Controller
// =============================================================================
// Orchestrates the Quick Go game flow by composing:
// - IRulesEngine (move validation, scoring)
// - IKatagoBridge (AI opponent, post-game analysis)
// - IExplanationEngine (human-readable explanations)
// - useGameStore (game state management)
//
// This is the "brain" of the Quick Go mode. It manages the state machine,
// coordinates AI responses, handles the timer, and triggers analysis.
// =============================================================================

import type {
  GameResult,
  GTPLocation,
  IExplanationEngine,
  IKatagoBridge,
  IRulesEngine,
  Player,
  ScoreResult,
} from '@core/interfaces'
import { indexToGTP, useGameStore } from '@game-engine/store'
import type { KataGoService } from '@katago-bridge/katago-service'
import { analyzeGame } from './QuickGoAnalyzer'
import { adjustDifficulty, getDefaultLevel } from './QuickGoDifficulty'
import {
  createTimerState,
  pauseTimer,
  startTimer,
  switchTimer,
  tickTimer as tickTimerFn,
} from './QuickGoTimer'
import type {
  QuickGoAnalysisResult,
  QuickGoConfig,
  QuickGoMoveResult,
  QuickGoPhase,
  QuickGoSessionStats,
  QuickGoState,
  QuickGoTimerState,
} from './types'
import { DEFAULT_QUICK_GO_CONFIG } from './types'

// ---------------------------------------------------------------------------
// Dependencies (injected)
// ---------------------------------------------------------------------------

export interface QuickGoDependencies {
  rulesEngine: IRulesEngine
  katagoBridge: IKatagoBridge
  explanationEngine: IExplanationEngine
}

// ---------------------------------------------------------------------------
// Quick Go Controller
// ---------------------------------------------------------------------------

/**
 * Quick Go game controller.
 *
 * Manages the complete game lifecycle:
 * Setup -> Playing -> Scoring -> Analyzing -> Complete
 *
 * Usage:
 *   const controller = new QuickGoController(deps)
 *   controller.startGame()
 *   // User taps a board intersection:
 *   const result = controller.handlePlayerMove(42)
 *   // AI responds:
 *   await controller.handleAIResponse()
 *   // Game ends via pass-pass or resign:
 *   const gameResult = controller.endGame('scoring')
 *   // Post-game analysis:
 *   const analysis = await controller.analyzeGame()
 */
export class QuickGoController {
  private deps: QuickGoDependencies
  private config: QuickGoConfig = DEFAULT_QUICK_GO_CONFIG
  private phase: QuickGoPhase = 'setup'
  private timer: QuickGoTimerState = createTimerState(DEFAULT_QUICK_GO_CONFIG.timeControl)
  private isAIThinking = false
  private aiThinkingStart: number | null = null
  private gameResult: GameResult | null = null
  private analysis: QuickGoAnalysisResult | null = null
  private session: QuickGoSessionStats = {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentDifficultyLevel: getDefaultLevel('beginner'),
    sessionTimeSeconds: 0,
  }

  constructor(deps: QuickGoDependencies) {
    this.deps = deps
  }

  // -------------------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------------------

  getPhase(): QuickGoPhase {
    return this.phase
  }

  getConfig(): QuickGoConfig {
    return this.config
  }

  getTimer(): QuickGoTimerState {
    return this.timer
  }

  isAICurrentlyThinking(): boolean {
    return this.isAIThinking
  }

  getGameResult(): GameResult | null {
    return this.gameResult
  }

  getAnalysis(): QuickGoAnalysisResult | null {
    return this.analysis
  }

  getSession(): QuickGoSessionStats {
    return this.session
  }

  getState(): QuickGoState {
    const gameStore = useGameStore.getState()
    return {
      config: this.config,
      phase: this.phase,
      timer: this.timer,
      ai: {
        isThinking: this.isAIThinking,
        thinkingStartTime: this.aiThinkingStart,
        lastMove: null,
      },
      result: this.gameResult,
      analysis: this.analysis,
      session: this.session,
      progressPercent: this.estimateProgress(gameStore.moveHistory.length),
      moveCount: gameStore.moveHistory.length,
    }
  }

  // -------------------------------------------------------------------------
  // Game Lifecycle: Start
  // -------------------------------------------------------------------------

  /**
   * Start a new Quick Go game.
   * Initializes the game store, timer, and transitions to 'playing' phase.
   */
  startGame(configOverride?: Partial<QuickGoConfig>): void {
    this.config = { ...DEFAULT_QUICK_GO_CONFIG, ...configOverride }

    // Resolve the difficulty level
    const difficultyLevel = this.config.difficultyLevel ?? this.session.currentDifficultyLevel

    // Set difficulty on KataGo bridge if it supports setDifficulty
    const bridge = this.deps.katagoBridge as KataGoService
    if (typeof bridge.setDifficulty === 'function') {
      bridge.setDifficulty(difficultyLevel)
    }

    // Initialize the game store
    const gameStore = useGameStore.getState()
    gameStore.createGame(this.config.boardSize, this.config.komi, {
      boardSize: this.config.boardSize,
      komi: this.config.komi,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
      playerColor: this.config.playerColor,
      timeControl: this.config.timeControl,
    })

    // Initialize timer
    this.timer = createTimerState(this.config.timeControl)
    this.timer = startTimer(this.timer, 'B', Date.now())

    // Reset game state
    this.isAIThinking = false
    this.aiThinkingStart = null
    this.gameResult = null
    this.analysis = null

    // Transition to playing phase
    this.phase = 'playing'

    // If AI plays first (player is White), request AI move
    if (this.config.playerColor === 'W') {
      // Do not await — fire and forget, UI will show "thinking" state
      void this.handleAIResponse()
    }
  }

  // -------------------------------------------------------------------------
  // Game Flow: Player Move
  // -------------------------------------------------------------------------

  /**
   * Handle a player move at the given board index.
   * Validates via rules engine, applies to game store, switches timer.
   */
  handlePlayerMove(index: number): QuickGoMoveResult {
    if (this.phase !== 'playing') {
      return { success: false, error: 'Game is not in playing phase', gameEnded: false }
    }

    if (this.isAIThinking) {
      return { success: false, error: 'Wait for AI to finish', gameEnded: false }
    }

    // Check it is the player's turn
    const gameStore = useGameStore.getState()
    if (gameStore.currentPlayer !== this.config.playerColor) {
      return { success: false, error: 'Not your turn', gameEnded: false }
    }

    // Play the move through the game store (which uses the rules engine)
    const result = gameStore.playMove(index)
    if (!result.success) {
      return { success: false, error: result.error, gameEnded: false }
    }

    // Switch timer
    const now = Date.now()
    this.timer = switchTimer(this.timer, this.config.timeControl, now)

    // Check if game ended (double pass)
    const updatedState = useGameStore.getState()
    if (updatedState.status === 'finished') {
      const _gameResult = this.endGame('scoring')
      return {
        success: true,
        gameEnded: true,
        coordinate: indexToGTP(index, this.config.boardSize),
      }
    }

    return {
      success: true,
      gameEnded: false,
      coordinate: indexToGTP(index, this.config.boardSize),
    }
  }

  // -------------------------------------------------------------------------
  // Game Flow: Player Pass
  // -------------------------------------------------------------------------

  /**
   * Handle a player pass.
   */
  handlePass(): QuickGoMoveResult {
    if (this.phase !== 'playing') {
      return { success: false, error: 'Game is not in playing phase', gameEnded: false }
    }

    if (this.isAIThinking) {
      return { success: false, error: 'Wait for AI to finish', gameEnded: false }
    }

    const gameStore = useGameStore.getState()
    if (gameStore.currentPlayer !== this.config.playerColor) {
      return { success: false, error: 'Not your turn', gameEnded: false }
    }

    const result = gameStore.pass()
    if (!result.success) {
      return { success: false, error: result.error, gameEnded: false }
    }

    // Switch timer
    const now = Date.now()
    this.timer = switchTimer(this.timer, this.config.timeControl, now)

    // Check if game ended (double pass)
    const updatedState = useGameStore.getState()
    if (updatedState.status === 'finished') {
      this.endGame('scoring')
      return { success: true, gameEnded: true }
    }

    return { success: true, gameEnded: false }
  }

  // -------------------------------------------------------------------------
  // Game Flow: Player Resign
  // -------------------------------------------------------------------------

  /**
   * Handle player resignation.
   */
  handleResign(): void {
    if (this.phase !== 'playing') return

    const gameStore = useGameStore.getState()
    gameStore.resign(this.config.playerColor)
    this.endGame('resignation')
  }

  // -------------------------------------------------------------------------
  // Game Flow: AI Response
  // -------------------------------------------------------------------------

  /**
   * Request and apply an AI move.
   * Called after the player's move to get the AI's response.
   */
  async handleAIResponse(): Promise<QuickGoMoveResult> {
    if (this.phase !== 'playing') {
      return { success: false, error: 'Game is not in playing phase', gameEnded: false }
    }

    const gameStore = useGameStore.getState()
    const aiColor: Player = this.config.playerColor === 'B' ? 'W' : 'B'

    // Verify it is AI's turn
    if (gameStore.currentPlayer !== aiColor) {
      return { success: false, error: 'Not AI turn', gameEnded: false }
    }

    this.isAIThinking = true
    this.aiThinkingStart = Date.now()

    try {
      // Build the move sequence for KataGo
      const katagoMoves: [Player, GTPLocation][] = gameStore.moveHistory.map((m) => [
        m.player,
        m.coordinate ?? 'pass',
      ])

      const query: import('@core/interfaces').AnalysisQuery = {
        id: `quick_go_${String(Date.now())}`,
        moves: katagoMoves,
        rules: 'chinese',
        boardXSize: this.config.boardSize,
        boardYSize: this.config.boardSize,
        komi: this.config.komi,
      }

      const result = await this.deps.katagoBridge.analyze(query)

      this.isAIThinking = false
      this.aiThinkingStart = null

      if (!result.ok) {
        return {
          success: false,
          error: `AI error: ${result.error.message}`,
          gameEnded: false,
        }
      }

      // Extract the best move
      const bestMoveInfo = result.value.moveInfos[0]
      if (bestMoveInfo === undefined) {
        // AI passes
        const _passResult = gameStore.pass()
        const now = Date.now()
        this.timer = switchTimer(this.timer, this.config.timeControl, now)

        const updatedState = useGameStore.getState()
        if (updatedState.status === 'finished') {
          this.endGame('scoring')
          return { success: true, gameEnded: true }
        }
        return { success: true, gameEnded: false }
      }

      const bestMove = bestMoveInfo.move
      if (bestMove === 'pass') {
        const _passResult = gameStore.pass()
        const now = Date.now()
        this.timer = switchTimer(this.timer, this.config.timeControl, now)

        const updatedState = useGameStore.getState()
        if (updatedState.status === 'finished') {
          this.endGame('scoring')
          return { success: true, gameEnded: true }
        }
        return { success: true, gameEnded: false }
      }

      // Convert GTP to board index
      const { gtpToIndex } = await import('@game-engine/store')
      const moveIndex = gtpToIndex(bestMove, this.config.boardSize)

      if (moveIndex < 0) {
        return { success: false, error: 'Invalid AI move coordinate', gameEnded: false }
      }

      const moveResult = gameStore.playMove(moveIndex)
      if (!moveResult.success) {
        // AI suggested an illegal move — try passing as fallback
        gameStore.pass()
      }

      // Switch timer back to player
      const now = Date.now()
      this.timer = switchTimer(this.timer, this.config.timeControl, now)

      const updatedState = useGameStore.getState()
      if (updatedState.status === 'finished') {
        this.endGame('scoring')
        return { success: true, gameEnded: true, coordinate: bestMove }
      }

      return { success: true, gameEnded: false, coordinate: bestMove }
    } catch (error) {
      this.isAIThinking = false
      this.aiThinkingStart = null
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: `AI error: ${message}`, gameEnded: false }
    }
  }

  // -------------------------------------------------------------------------
  // Timer
  // -------------------------------------------------------------------------

  /**
   * Tick the timer. Should be called every frame.
   * Returns the player who timed out, or null.
   */
  tickTimer(now: number): Player | null {
    if (this.phase !== 'playing') return null

    const result = tickTimerFn(this.timer, now)
    this.timer = result.state

    if (result.timedOut !== null) {
      this.handleTimeout(result.timedOut)
    }

    return result.timedOut
  }

  /**
   * Handle a timeout event.
   */
  private handleTimeout(timedOutPlayer: Player): void {
    // The player who ran out of time loses
    const winner: Player = timedOutPlayer === 'B' ? 'W' : 'B'

    const gameStore = useGameStore.getState()
    const gameResult: GameResult = {
      winner,
      resultString: `${winner}+T`,
      score: null,
      endReason: 'timeout',
    }

    gameStore.setResult(gameResult)
    this.gameResult = gameResult
    this.phase = 'scoring'
    this.timer = pauseTimer(this.timer)

    // Transition to analyzing
    this.phase = 'analyzing'
  }

  // -------------------------------------------------------------------------
  // Game End
  // -------------------------------------------------------------------------

  /**
   * End the game and compute the result.
   */
  endGame(reason: 'scoring' | 'resignation' | 'timeout'): GameResult {
    this.timer = pauseTimer(this.timer)

    const gameStore = useGameStore.getState()

    if (reason === 'scoring') {
      // Compute score via rules engine
      const score = this.deps.rulesEngine.computeScore(
        {
          size: gameStore.boardSize,
          grid: gameStore.board,
          hash: 0n, // Hash not needed for scoring
        },
        this.config.komi
      )

      const gameResult: GameResult = {
        winner: score.winner,
        resultString: this.formatScoreResult(score),
        score,
        endReason: 'scoring',
      }

      gameStore.setResult(gameResult)
      this.gameResult = gameResult
    } else if (reason === 'resignation') {
      // Already handled by resign()
      this.gameResult = gameStore.result
    } else if (reason === 'timeout') {
      // Already handled by handleTimeout()
    }

    // Update session stats
    this.updateSessionStats()

    // Transition phases
    this.phase = 'analyzing'

    return this.gameResult!
  }

  /**
   * Format score result as SGF RE string.
   */
  private formatScoreResult(score: ScoreResult): string {
    if (score.winner === null) return '0' // Draw
    const diff = Math.abs(score.scoreDifferential)
    return `${score.winner}+${String(diff)}`
  }

  /**
   * Update session statistics after a game.
   */
  private updateSessionStats(): void {
    this.session = {
      ...this.session,
      gamesPlayed: this.session.gamesPlayed + 1,
    }

    if (this.gameResult !== null) {
      const playerWon = this.gameResult.winner === this.config.playerColor

      if (playerWon) {
        this.session = { ...this.session, wins: this.session.wins + 1 }
      } else {
        this.session = { ...this.session, losses: this.session.losses + 1 }
      }

      // Auto-adjust difficulty
      const gameStore = useGameStore.getState()
      const scoreDiff = this.gameResult.score?.scoreDifferential ?? null
      const newLevel = adjustDifficulty(
        this.session.currentDifficultyLevel,
        this.config.difficultyPreset,
        playerWon,
        scoreDiff,
        gameStore.moveHistory.length
      )
      this.session = { ...this.session, currentDifficultyLevel: newLevel }
    }
  }

  // -------------------------------------------------------------------------
  // Post-Game Analysis
  // -------------------------------------------------------------------------

  /**
   * Run post-game analysis.
   * Analyzes key positions and generates explanations.
   */
  async analyzeGame(): Promise<QuickGoAnalysisResult> {
    if (this.phase !== 'analyzing' && this.phase !== 'complete') {
      return {
        analyzedMoves: [],
        topMoves: [],
        bestPlayerMove: null,
        biggestMistake: null,
        accuracy: 100,
        isAnalyzing: false,
        analyzedCount: 0,
        totalMoves: 0,
      }
    }

    const gameStore = useGameStore.getState()

    this.analysis = await analyzeGame(
      gameStore.moveHistory,
      this.config.boardSize,
      this.config.komi,
      this.config.playerColor,
      this.deps.katagoBridge,
      this.deps.explanationEngine,
      this.config.explanationTier,
      (partialResult) => {
        this.analysis = partialResult
      }
    )

    // Transition to complete
    this.phase = 'complete'

    return this.analysis
  }

  // -------------------------------------------------------------------------
  // Rematch & Reset
  // -------------------------------------------------------------------------

  /**
   * Start a rematch with the same settings.
   * Preserves session stats and difficulty level.
   */
  rematch(): void {
    const gameStore = useGameStore.getState()
    gameStore.reset()
    this.startGame({
      ...this.config,
      difficultyLevel: this.session.currentDifficultyLevel,
    })
  }

  /**
   * Full reset — clear everything including session.
   */
  reset(): void {
    const gameStore = useGameStore.getState()
    gameStore.reset()
    this.phase = 'setup'
    this.config = DEFAULT_QUICK_GO_CONFIG
    this.timer = createTimerState(DEFAULT_QUICK_GO_CONFIG.timeControl)
    this.isAIThinking = false
    this.aiThinkingStart = null
    this.gameResult = null
    this.analysis = null
    this.session = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      currentDifficultyLevel: getDefaultLevel('beginner'),
      sessionTimeSeconds: 0,
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Estimate game progress as a percentage.
   * A 9x9 game typically lasts 40-60 moves.
   */
  private estimateProgress(moveCount: number): number {
    const expectedMoves =
      this.config.boardSize === 9 ? 50 : this.config.boardSize === 13 ? 100 : 200
    return Math.min(100, Math.round((moveCount / expectedMoves) * 100))
  }
}

// ---------------------------------------------------------------------------
// Factory Function
// ---------------------------------------------------------------------------

/**
 * Create a new QuickGoController with the given dependencies.
 */
export function createQuickGoController(deps: QuickGoDependencies): QuickGoController {
  return new QuickGoController(deps)
}
