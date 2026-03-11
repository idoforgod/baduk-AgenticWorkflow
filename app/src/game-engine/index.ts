// =============================================================================
// Module: game-engine — Public API Barrel Export
// =============================================================================
// Layer 3 (Application)
// Purpose: GameReducer (Zustand), game flow, timer, move history, AI opponent.
// Dependencies: core, rules-engine, storage
//
// Implemented by: Step 11 (data-engineer)
// Consumers: features/quick-go, gamification
// =============================================================================

export { exportSGF, gtpToSGF, parseSGF, sgfToGTP } from './sgf'
export { configureGameStore, gtpToIndex, indexToGTP, useGameStore } from './store'
export type { GameStore, GameStoreActions, GameStoreState, SGFExportInput } from './types'
