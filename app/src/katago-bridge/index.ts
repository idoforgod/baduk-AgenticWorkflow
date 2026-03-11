// =============================================================================
// Module: katago-bridge — Public API Barrel Export
// =============================================================================
// Layer 2 (Domain)
// Purpose: KataGo sidecar lifecycle, IPC, GPU detection, circuit breaker.
//          Implements IKatagoBridge interface from core/interfaces.ts.
// Dependencies: core
//
// Implemented by: Step 12 (katago-integrator)
// Consumers: game-engine, explanation-engine
// =============================================================================

// --- Difficulty System ---
export {
  DIFFICULTY_RANGE,
  getAllDifficultyConfigs,
  getDifficultyConfig,
  getDifficultyDescription,
  getDifficultyRank,
  isValidDifficultyLevel,
} from './difficulty'
// --- GPU Detection ---
export {
  clearBackendCache,
  detectBackend,
  getBackendSpeedMultiplier,
  getCachedBackend,
  isGPUBackend,
  mapTauriBackendInfo,
} from './gpu-detection'
export type { InvokeFn } from './katago-service'
// --- Main Service ---
export { createKatagoBridge, KataGoService } from './katago-service'
// --- Query Builder ---
export {
  buildClearCache,
  buildQueryModels,
  buildQueryVersion,
  buildTauriAnalysisQuery,
  buildTerminate,
  buildTerminateAll,
  generateQueryId,
  serializeAnalysisQuery,
  serializeQuery,
  validateAnalysisQuery,
} from './query-builder'
// --- Response Parser ---
export {
  detectResponseType,
  extractBestMove,
  extractTopMoves,
  isAnalysisResponse,
  isErrorResponse,
  isNoResultResponse,
  isVersionResponse,
  makeKataGoError,
  parseAnalysisResponse,
  parseMoveInfoArray,
  parseResponseLine,
  parseResponseObject,
} from './response-parser'
// --- Types ---
export type { DifficultyConfig } from './types'
export { DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_VISITS_TIERS } from './types'
// --- Visits Management ---
export {
  calibrateTiersFromVPS,
  estimateResponseTime,
  getCachedVisitsPerSecond,
  getHangTimeout,
  getHardwareClass,
  getVisitsTiers,
  isHardwareSufficient,
  resetVisitsTiers,
  setVisitsTiers,
} from './visits'
