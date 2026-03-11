// =============================================================================
// Feature: quick-go — Public API Barrel Export
// =============================================================================
// Layer 4 (Feature) — flagship MVP feature
// Purpose: 9x9 board, 3-minute game against AI. "Lunch break" game experience.
//          Composes: rules-engine, katago-bridge, explanation-engine, board-ui.
//
// Implemented by: Step 18 (game-developer)
// State machine: Setup -> Playing -> Scoring -> Analyzing -> Complete
// =============================================================================

// --- Analyzer ---
export {
  analyzeGame,
  BLUNDER_THRESHOLD,
  findBlunders,
  getBestMoveFromAnalysis,
  TOP_MOVES_COUNT,
} from './QuickGoAnalyzer'
export type { QuickGoDependencies } from './QuickGoController'
// --- Controller ---
export { createQuickGoController, QuickGoController } from './QuickGoController'
// --- Difficulty ---
export {
  adjustDifficulty,
  getDefaultLevel,
  getDifficultyForLevel,
  getDifficultyForPreset,
  getDifficultyLabel,
  getPresetForLevel,
  getPresetRange,
} from './QuickGoDifficulty'
// --- Store ---
export { configureQuickGoStore, useQuickGoStore } from './QuickGoStore'
// --- Timer ---
export {
  createPlayerTimer,
  createTimerState,
  formatTime,
  getTimerDisplay,
  getTimerUrgency,
  getTotalRemainingMs,
  pauseTimer,
  startTimer,
  switchTimer,
  tickTimer,
} from './QuickGoTimer'

// --- Types ---
export type {
  AIState,
  AnalyzedMove,
  DifficultyPreset,
  QuickGoActions,
  QuickGoAnalysisResult,
  QuickGoConfig,
  QuickGoMoveResult,
  QuickGoPhase,
  QuickGoPlayerTimer,
  QuickGoSessionStats,
  QuickGoState,
  QuickGoStore,
  QuickGoTimerState,
} from './types'
export { DEFAULT_QUICK_GO_CONFIG } from './types'
