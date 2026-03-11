// =============================================================================
// katago-bridge/response-parser.ts — Parse KataGo Analysis Engine JSON responses
// =============================================================================
// Parses raw JSON responses from KataGo into typed TypeScript objects.
// Handles all response types: analysis, error, warning, version, models,
// no-results, and malformed responses.
//
// Design decisions:
// - Uses Zod schemas from core/interfaces.ts for validation at the boundary.
// - Unknown fields are tolerated (Step 2 Section 2.3 guarantee 4).
// - Returns discriminated Result types — never throws.
// =============================================================================

import type {
  AnalysisResponse,
  KataGoError,
  KataGoErrorResponse,
  KataGoResponse,
  KataGoWarningResponse,
  MoveInfo,
  NoResultResponse,
  RootInfo,
  VersionResponse,
} from '../core/interfaces'
import { Err, Ok, type Result } from '../core/interfaces'

// ---------------------------------------------------------------------------
// Response Type Detection
// ---------------------------------------------------------------------------

/**
 * Determine the type of a raw KataGo response object.
 * Uses field presence to discriminate (Step 2 Section 4.7-4.9).
 *
 * Detection order:
 * 1. "error" field -> error response
 * 2. "warning" field -> warning response
 * 3. "action" === "query_version" -> version response
 * 4. "action" === "query_models" -> models response
 * 5. "noResults" === true -> no-result response
 * 6. "moveInfos" present -> analysis response
 * 7. Otherwise -> unknown response (treated as error)
 */
export type ResponseType =
  | 'analysis'
  | 'no-result'
  | 'error'
  | 'warning'
  | 'version'
  | 'models'
  | 'clear-cache'
  | 'terminate'
  | 'unknown'

export function detectResponseType(raw: Record<string, unknown>): ResponseType {
  if (typeof raw.error === 'string') return 'error'
  if (typeof raw.warning === 'string') return 'warning'
  if (raw.action === 'query_version') return 'version'
  if (raw.action === 'query_models') return 'models'
  if (raw.action === 'clear_cache') return 'clear-cache'
  if (raw.action === 'terminate' || raw.action === 'terminate_all') return 'terminate'
  if (raw.noResults === true) return 'no-result'
  if (Array.isArray(raw.moveInfos)) return 'analysis'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// JSON Line Parser
// ---------------------------------------------------------------------------

/**
 * Parse a single JSON line from KataGo's stdout into a typed response.
 *
 * @param line - Raw string line from stdout (may include trailing newline)
 * @returns Parsed KataGoResponse or error
 */
export function parseResponseLine(line: string): Result<KataGoResponse, KataGoError> {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return Err(makeKataGoError('INVALID_RESPONSE', 'Empty response line from KataGo'))
  }

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    return Err(
      makeKataGoError(
        'INVALID_RESPONSE',
        `Failed to parse KataGo response as JSON: ${trimmed.substring(0, 200)}`
      )
    )
  }

  if (typeof raw !== 'object' || raw === null) {
    return Err(makeKataGoError('INVALID_RESPONSE', 'KataGo response is not a JSON object'))
  }

  return parseResponseObject(raw)
}

/**
 * Parse a pre-parsed JSON object into a typed KataGoResponse.
 */
export function parseResponseObject(
  raw: Record<string, unknown>
): Result<KataGoResponse, KataGoError> {
  const type = detectResponseType(raw)

  switch (type) {
    case 'analysis':
      return parseAnalysisResponse(raw)
    case 'no-result':
      return parseNoResultResponse(raw)
    case 'error':
      return parseErrorResponse(raw)
    case 'warning':
      return parseWarningResponse(raw)
    case 'version':
      return parseVersionResponse(raw)
    case 'models':
      // Pass through models response as-is (not frequently used)
      return Ok(raw as unknown as KataGoResponse)
    case 'clear-cache':
    case 'terminate':
      // Action echoes — pass through
      return Ok(raw as unknown as KataGoResponse)
    case 'unknown':
      return Err(
        makeKataGoError(
          'INVALID_RESPONSE',
          `Unknown KataGo response type: ${JSON.stringify(raw).substring(0, 200)}`
        )
      )
  }
}

// ---------------------------------------------------------------------------
// Analysis Response Parser
// ---------------------------------------------------------------------------

/**
 * Parse a standard analysis response from KataGo.
 * Extracts moveInfos, rootInfo, and optional ownership/policy data.
 */
export function parseAnalysisResponse(
  raw: Record<string, unknown>
): Result<AnalysisResponse, KataGoError> {
  const id = typeof raw.id === 'string' ? raw.id : ''
  const isDuringSearch = typeof raw.isDuringSearch === 'boolean' ? raw.isDuringSearch : false
  const turnNumber = typeof raw.turnNumber === 'number' ? raw.turnNumber : 0

  // Parse moveInfos
  if (!Array.isArray(raw.moveInfos)) {
    return Err(
      makeKataGoError('INVALID_RESPONSE', `Missing or invalid moveInfos in response ${id}`)
    )
  }
  const moveInfos = parseMoveInfoArray(raw.moveInfos as Record<string, unknown>[])

  // Parse rootInfo
  if (typeof raw.rootInfo !== 'object' || raw.rootInfo === null) {
    return Err(makeKataGoError('INVALID_RESPONSE', `Missing or invalid rootInfo in response ${id}`))
  }
  const rootInfoResult = parseRootInfo(raw.rootInfo as Record<string, unknown>)
  if (!rootInfoResult.ok) return rootInfoResult

  const response: AnalysisResponse = {
    id,
    isDuringSearch,
    turnNumber,
    moveInfos,
    rootInfo: rootInfoResult.value,
    // Optional fields
    ...(Array.isArray(raw.ownership) ? { ownership: raw.ownership as number[] } : {}),
    ...(Array.isArray(raw.ownershipStdev)
      ? { ownershipStdev: raw.ownershipStdev as number[] }
      : {}),
    ...(Array.isArray(raw.policy) ? { policy: raw.policy as number[] } : {}),
    ...(Array.isArray(raw.humanPolicy) ? { humanPolicy: raw.humanPolicy as number[] } : {}),
  }

  return Ok(response)
}

// ---------------------------------------------------------------------------
// MoveInfo Parser
// ---------------------------------------------------------------------------

/**
 * Parse an array of raw moveInfo objects into typed MoveInfo[].
 * Tolerates missing optional fields and unknown extra fields.
 */
export function parseMoveInfoArray(rawMoves: readonly Record<string, unknown>[]): MoveInfo[] {
  return rawMoves.map(parseSingleMoveInfo)
}

function parseSingleMoveInfo(raw: Record<string, unknown>): MoveInfo {
  const result: MoveInfo = {
    move: asString(raw.move, 'pass'),
    visits: asNumber(raw.visits, 0),
    edgeVisits: asNumber(raw.edgeVisits, 0),
    winrate: asNumber(raw.winrate, 0.5),
    scoreMean: asNumber(raw.scoreMean, 0),
    scoreLead: asNumber(raw.scoreLead, 0),
    scoreStdev: asNumber(raw.scoreStdev, 0),
    scoreSelfplay: asNumber(raw.scoreSelfplay, 0),
    prior: asNumber(raw.prior, 0),
    utility: asNumber(raw.utility, 0),
    utilityLcb: asNumber(raw.utilityLcb, 0),
    lcb: asNumber(raw.lcb, 0),
    weight: asNumber(raw.weight, 0),
    edgeWeight: asNumber(raw.edgeWeight, 0),
    order: asNumber(raw.order, 0),
    playSelectionValue: asNumber(raw.playSelectionValue, 0),
    pv: Array.isArray(raw.pv) ? (raw.pv as string[]) : [],

    // Conditional fields — only include when present
    ...(Array.isArray(raw.pvVisits) ? { pvVisits: raw.pvVisits as number[] } : {}),
    ...(Array.isArray(raw.pvEdgeVisits) ? { pvEdgeVisits: raw.pvEdgeVisits as number[] } : {}),
    ...(typeof raw.noResultValue === 'number' ? { noResultValue: raw.noResultValue } : {}),
    ...(typeof raw.humanPrior === 'number' ? { humanPrior: raw.humanPrior } : {}),
    ...(typeof raw.isSymmetryOf === 'string' ? { isSymmetryOf: raw.isSymmetryOf } : {}),
    ...(Array.isArray(raw.ownership) ? { ownership: raw.ownership as number[] } : {}),
    ...(Array.isArray(raw.ownershipStdev)
      ? { ownershipStdev: raw.ownershipStdev as number[] }
      : {}),
  }
  return result
}

// ---------------------------------------------------------------------------
// RootInfo Parser
// ---------------------------------------------------------------------------

function parseRootInfo(raw: Record<string, unknown>): Result<RootInfo, KataGoError> {
  const rootInfo: RootInfo = {
    winrate: asNumber(raw.winrate, 0.5),
    scoreLead: asNumber(raw.scoreLead, 0),
    scoreSelfplay: asNumber(raw.scoreSelfplay, 0),
    scoreStdev: asNumber(raw.scoreStdev, 0),
    utility: asNumber(raw.utility, 0),
    visits: asNumber(raw.visits, 0),
    currentPlayer: asString(raw.currentPlayer, 'B') as 'B' | 'W',
    thisHash: asString(raw.thisHash, ''),
    symHash: asString(raw.symHash, ''),
    lcb: asNumber(raw.lcb, 0),
    utilityLcb: asNumber(raw.utilityLcb, 0),
    rawWinrate: asNumber(raw.rawWinrate, 0.5),
    rawLead: asNumber(raw.rawLead, 0),
    rawScoreSelfplay: asNumber(raw.rawScoreSelfplay, 0),
    rawScoreSelfplayStdev: asNumber(raw.rawScoreSelfplayStdev, 0),
    rawNoResultProb: asNumber(raw.rawNoResultProb, 0),
    rawStWrError: asNumber(raw.rawStWrError, 0),
    rawStScoreError: asNumber(raw.rawStScoreError, 0),
    rawVarTimeLeft: asNumber(raw.rawVarTimeLeft, 0),

    // Conditional human model fields
    ...(typeof raw.humanWinrate === 'number' ? { humanWinrate: raw.humanWinrate } : {}),
    ...(typeof raw.humanScoreMean === 'number' ? { humanScoreMean: raw.humanScoreMean } : {}),
    ...(typeof raw.humanScoreStdev === 'number' ? { humanScoreStdev: raw.humanScoreStdev } : {}),
    ...(typeof raw.humanStWrError === 'number' ? { humanStWrError: raw.humanStWrError } : {}),
    ...(typeof raw.humanStScoreError === 'number'
      ? { humanStScoreError: raw.humanStScoreError }
      : {}),
  }
  return Ok(rootInfo)
}

// ---------------------------------------------------------------------------
// Special Response Parsers
// ---------------------------------------------------------------------------

function parseNoResultResponse(
  raw: Record<string, unknown>
): Result<NoResultResponse, KataGoError> {
  return Ok({
    id: asString(raw.id, ''),
    isDuringSearch: false as const,
    turnNumber: asNumber(raw.turnNumber, 0),
    noResults: true as const,
  })
}

function parseErrorResponse(
  raw: Record<string, unknown>
): Result<KataGoErrorResponse, KataGoError> {
  return Ok({
    error: asString(raw.error, 'Unknown error'),
    ...(typeof raw.id === 'string' ? { id: raw.id } : {}),
    ...(typeof raw.field === 'string' ? { field: raw.field } : {}),
  })
}

function parseWarningResponse(
  raw: Record<string, unknown>
): Result<KataGoWarningResponse, KataGoError> {
  return Ok({
    warning: asString(raw.warning, 'Unknown warning'),
    id: asString(raw.id, ''),
    field: asString(raw.field, ''),
  })
}

function parseVersionResponse(raw: Record<string, unknown>): Result<VersionResponse, KataGoError> {
  return Ok({
    id: asString(raw.id, ''),
    action: 'query_version' as const,
    version: asString(raw.version, 'unknown'),
    git_hash: asString(raw.git_hash, ''),
  })
}

// ---------------------------------------------------------------------------
// Response Extraction Utilities
// ---------------------------------------------------------------------------

/**
 * Extract the best move from an AnalysisResponse.
 * Returns the move with order === 0 (highest-ranked move).
 */
export function extractBestMove(response: AnalysisResponse): MoveInfo | null {
  if (response.moveInfos.length === 0) return null
  // moveInfos should be sorted by order, but find explicitly for safety
  const best = response.moveInfos.find((m) => m.order === 0)
  return best ?? response.moveInfos[0] ?? null
}

/**
 * Extract the top N moves from an AnalysisResponse, sorted by order.
 */
export function extractTopMoves(response: AnalysisResponse, n: number): readonly MoveInfo[] {
  const sorted = [...response.moveInfos].sort((a, b) => a.order - b.order)
  return sorted.slice(0, n)
}

/**
 * Check if a KataGoResponse is an AnalysisResponse (not error/warning/etc).
 */
export function isAnalysisResponse(response: KataGoResponse): response is AnalysisResponse {
  return 'moveInfos' in response && 'rootInfo' in response
}

/**
 * Check if a KataGoResponse is an error response.
 */
export function isErrorResponse(response: KataGoResponse): response is KataGoErrorResponse {
  return 'error' in response
}

/**
 * Check if a KataGoResponse is a no-result response (terminated query).
 */
export function isNoResultResponse(response: KataGoResponse): response is NoResultResponse {
  return 'noResults' in response && (response as NoResultResponse).noResults === true
}

/**
 * Check if a KataGoResponse is a version response.
 */
export function isVersionResponse(response: KataGoResponse): response is VersionResponse {
  return 'action' in response && (response as VersionResponse).action === 'query_version'
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Create a KataGoError object.
 */
export function makeKataGoError(
  code: KataGoError['code'],
  message: string,
  details?: Record<string, string | number | boolean>
): KataGoError {
  return {
    module: 'katago',
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  }
}
