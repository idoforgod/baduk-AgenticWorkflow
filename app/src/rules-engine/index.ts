// =============================================================================
// Module: rules-engine — Public API Barrel Export
// =============================================================================
// Layer 2 (Domain)
// Purpose: Tromp-Taylor rules, capture, ko, scoring, Zobrist hashing.
//          Pure functions — no I/O, no side effects.
// Dependencies: core
//
// Implemented by: Step 11 (rules-engineer)
// Consumers: game-engine
// =============================================================================

// --- Board representation and manipulation ---
export {
  BLACK,
  cloneBoard,
  coordToIndex,
  createEmptyBoard,
  EMPTY,
  findCapturesAround,
  findGroup,
  getAdjacencyTable,
  gtpToIndex,
  hasLiberties,
  indexToCoord,
  indexToGTP,
  isValidIndex,
  opponentColor,
  WHITE,
} from './board'
// --- Core rules engine (IRulesEngine implementation) ---
export { createGameState, createRulesEngine, TrompTaylorRulesEngine } from './rules'
// --- Chinese scoring ---
export { chineseScore, computeTerritory } from './scoring'
export type { ZobristTable } from './zobrist'
// --- Zobrist hashing ---
export {
  computeFullHash,
  getZobristTable,
  hashPlaceStone,
  hashRemoveStone,
} from './zobrist'
