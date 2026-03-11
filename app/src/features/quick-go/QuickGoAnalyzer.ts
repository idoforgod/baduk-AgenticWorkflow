// =============================================================================
// features/quick-go/QuickGoAnalyzer.ts — Post-Game Analysis
// =============================================================================
// Analyzes completed Quick Go games to find blunders and generate explanations.
// Uses IKatagoBridge for position analysis and IExplanationEngine for text.
//
// The analyzer:
// 1. Takes the completed game's move history
// 2. Builds KataGo queries for each position
// 3. Identifies blunder moves (winrate delta > 5%)
// 4. Ranks moves by impact
// 5. Generates explanations for the top 5 moves
// =============================================================================

import type {
  AnalysisResponse,
  BoardSize,
  GTPLocation,
  IExplanationEngine,
  IKatagoBridge,
  MoveRecord,
  Player,
  Tier,
} from '@core/interfaces'
import type { AnalyzedMove, QuickGoAnalysisResult } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum winrate change (percentage points) to consider a move a blunder */
export const BLUNDER_THRESHOLD = 5.0

/** Number of top moves to show in the analysis summary */
export const TOP_MOVES_COUNT = 5

/** Maximum visits for analysis queries (higher = more accurate but slower) */
const ANALYSIS_VISITS = 200

// ---------------------------------------------------------------------------
// Query Builder
// ---------------------------------------------------------------------------

/**
 * Build a KataGo analysis query for a specific game position.
 */
function buildPositionQuery(
  moves: readonly MoveRecord[],
  upToMoveIndex: number,
  boardSize: BoardSize,
  komi: number,
  queryId: string
): import('@core/interfaces').AnalysisQuery {
  const katagoMoves: [Player, GTPLocation][] = []

  for (let i = 0; i <= upToMoveIndex; i++) {
    const move = moves[i]
    if (move === undefined) continue

    const location: GTPLocation = move.coordinate ?? 'pass'
    katagoMoves.push([move.player, location])
  }

  return {
    id: queryId,
    moves: katagoMoves,
    rules: 'chinese',
    boardXSize: boardSize,
    boardYSize: boardSize,
    komi,
    maxVisits: ANALYSIS_VISITS,
    includeOwnership: false,
  }
}

// ---------------------------------------------------------------------------
// Winrate Extraction
// ---------------------------------------------------------------------------

/**
 * Extract winrate from a KataGo response, normalized to Black's perspective.
 * KataGo reports winrate from the perspective of the current player.
 * We normalize everything to Black's perspective for consistent comparison.
 */
function getBlackWinrate(response: AnalysisResponse): number {
  const currentPlayerWinrate = response.rootInfo.winrate * 100
  const currentPlayer = response.rootInfo.currentPlayer

  // If current player is Black, winrate is already from Black's perspective
  // If current player is White, we need to invert
  return currentPlayer === 'B' ? currentPlayerWinrate : 100 - currentPlayerWinrate
}

/**
 * Get the winrate from a specific player's perspective.
 */
function getPlayerWinrate(response: AnalysisResponse, player: Player): number {
  const blackWinrate = getBlackWinrate(response)
  return player === 'B' ? blackWinrate : 100 - blackWinrate
}

// ---------------------------------------------------------------------------
// Analysis Pipeline
// ---------------------------------------------------------------------------

/**
 * Analyze a completed game and return the analysis results.
 *
 * This function:
 * 1. Sends analysis queries for each position in the game
 * 2. Computes winrate deltas between consecutive positions
 * 3. Identifies blunders and key moments
 * 4. Generates explanations for the most impactful moves
 * 5. Calls the progress callback after each move is analyzed
 *
 * @param moves - Complete move history
 * @param boardSize - Board size
 * @param komi - Komi value
 * @param playerColor - The human player's color
 * @param katagoBridge - KataGo bridge for analysis queries
 * @param explanationEngine - Explanation engine for generating text
 * @param explanationTier - Explanation tier for text generation
 * @param onProgress - Callback for progressive results
 */
export async function analyzeGame(
  moves: readonly MoveRecord[],
  boardSize: BoardSize,
  komi: number,
  playerColor: Player,
  katagoBridge: IKatagoBridge,
  explanationEngine: IExplanationEngine,
  explanationTier: Tier,
  onProgress?: (result: QuickGoAnalysisResult) => void
): Promise<QuickGoAnalysisResult> {
  const analysisResponses: (AnalysisResponse | null)[] = []
  const analyzedMoves: AnalyzedMove[] = []

  // Analyze each position (before each move)
  // We need position 0 (initial) through position N (after last move)
  for (let i = -1; i < moves.length; i++) {
    const queryId = `analysis_${String(i)}`
    const query = buildPositionQuery(moves, i, boardSize, komi, queryId)

    const result = await katagoBridge.analyze(query)

    if (result.ok) {
      analysisResponses.push(result.value)
    } else {
      analysisResponses.push(null)
    }

    // After we have at least 2 responses, compute delta for the latest move
    if (i >= 0) {
      const beforeResponse = analysisResponses[i] // Position before move i
      const afterResponse = analysisResponses[i + 1] // Position after move i
      const move = moves[i]

      if (move !== undefined && beforeResponse !== null && afterResponse !== null) {
        const movePlayer = move.player
        const winrateBefore = getPlayerWinrate(beforeResponse, movePlayer)
        const winrateAfter = getPlayerWinrate(afterResponse, movePlayer)
        const winrateDelta = winrateAfter - winrateBefore

        const bestMove = beforeResponse.moveInfos[0]?.move ?? 'pass'
        const actualCoordinate = move.coordinate ?? 'pass'
        const wasBestMove = actualCoordinate === bestMove

        const analyzedMove: AnalyzedMove = {
          moveNumber: move.moveNumber,
          player: movePlayer,
          coordinate: move.coordinate,
          winrateBefore,
          winrateAfter,
          winrateDelta,
          bestMove,
          wasBestMove,
          explanation: null, // Will be filled later for top moves
          analysisResponse: afterResponse,
        }

        analyzedMoves.push(analyzedMove)
      }
    }

    // Report progress
    if (onProgress !== undefined) {
      const partialResult = buildAnalysisResult(
        analyzedMoves,
        playerColor,
        true,
        i + 1,
        moves.length
      )
      onProgress(partialResult)
    }
  }

  // Sort by absolute winrate delta (largest impact first)
  const sortedByImpact = [...analyzedMoves]
    .filter((m) => m.player === playerColor) // Only player's moves
    .sort((a, b) => Math.abs(b.winrateDelta) - Math.abs(a.winrateDelta))

  // Generate explanations for top moves
  const topMoves = sortedByImpact.slice(0, TOP_MOVES_COUNT)
  const enrichedTopMoves: AnalyzedMove[] = []

  for (const move of topMoves) {
    const moveIdx = move.moveNumber
    const beforeResponse = analysisResponses[moveIdx]
    const afterResponse = analysisResponses[moveIdx + 1]

    let explanation = move.explanation
    if (afterResponse !== null) {
      const explResult = explanationEngine.explain(
        afterResponse,
        beforeResponse ?? null,
        move.coordinate,
        explanationTier,
        moveIdx,
        boardSize
      )
      if (explResult.ok) {
        explanation = explResult.value
      }
    }

    enrichedTopMoves.push({ ...move, explanation })
  }

  // Replace top moves in the full list with enriched versions
  const enrichedAnalyzedMoves = analyzedMoves.map((m) => {
    const enriched = enrichedTopMoves.find((e) => e.moveNumber === m.moveNumber)
    return enriched ?? m
  })

  return buildAnalysisResult(
    enrichedAnalyzedMoves,
    playerColor,
    false,
    moves.length,
    moves.length,
    enrichedTopMoves
  )
}

// ---------------------------------------------------------------------------
// Result Builder
// ---------------------------------------------------------------------------

/**
 * Build a QuickGoAnalysisResult from analyzed moves.
 */
function buildAnalysisResult(
  analyzedMoves: readonly AnalyzedMove[],
  playerColor: Player,
  isAnalyzing: boolean,
  analyzedCount: number,
  totalMoves: number,
  topMovesOverride?: readonly AnalyzedMove[]
): QuickGoAnalysisResult {
  // Filter to player's moves
  const playerMoves = analyzedMoves.filter((m) => m.player === playerColor)

  // Sort by absolute impact
  const sortedByImpact = [...playerMoves].sort(
    (a, b) => Math.abs(b.winrateDelta) - Math.abs(a.winrateDelta)
  )

  const topMoves = topMovesOverride ?? sortedByImpact.slice(0, TOP_MOVES_COUNT)

  // Find best move (largest positive delta)
  const bestPlayerMove = [...playerMoves].sort((a, b) => b.winrateDelta - a.winrateDelta)[0] ?? null

  // Find biggest mistake (largest negative delta)
  const biggestMistake =
    [...playerMoves]
      .filter((m) => m.winrateDelta < 0)
      .sort((a, b) => a.winrateDelta - b.winrateDelta)[0] ?? null

  // Compute accuracy: percentage of moves within threshold of best
  const goodMoves = playerMoves.filter((m) => m.winrateDelta >= -BLUNDER_THRESHOLD)
  const accuracy = playerMoves.length > 0 ? (goodMoves.length / playerMoves.length) * 100 : 100

  return {
    analyzedMoves,
    topMoves,
    bestPlayerMove,
    biggestMistake,
    accuracy: Math.round(accuracy),
    isAnalyzing,
    analyzedCount,
    totalMoves,
  }
}

/**
 * Identify blunder moves (winrate drop > threshold).
 */
export function findBlunders(
  analyzedMoves: readonly AnalyzedMove[],
  threshold: number = BLUNDER_THRESHOLD
): readonly AnalyzedMove[] {
  return analyzedMoves.filter((m) => m.winrateDelta < -threshold)
}

/**
 * Get the best move coordinate for a position using the analysis response.
 */
export function getBestMoveFromAnalysis(response: AnalysisResponse): GTPLocation | null {
  return response.moveInfos[0]?.move ?? null
}
