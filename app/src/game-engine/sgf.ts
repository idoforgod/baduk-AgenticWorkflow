// =============================================================================
// game-engine/sgf.ts — SGF (Smart Game Format) Export Utility
// =============================================================================
// Converts game state + move history to a valid SGF string.
// SGF spec: https://www.red-bean.com/sgf/sgf4.html
//
// Supported SGF properties:
//   GM[1]      — Game type: Go
//   FF[4]      — SGF format version
//   CA[UTF-8]  — Character set
//   SZ[N]      — Board size
//   KM[komi]   — Komi
//   RU[rules]  — Rules
//   PB[name]   — Black player name
//   PW[name]   — White player name
//   RE[result] — Game result in SGF format
//   DT[date]   — Game date
//   B[coord]   — Black move
//   W[coord]   — White move
//
// Layer: Application (Layer 3)
// Pure function — no side effects, no I/O.
// =============================================================================

import type { BoardSize } from '@core/interfaces'
import type { SGFExportInput } from './types'

// ---------------------------------------------------------------------------
// GTP -> SGF coordinate conversion
// ---------------------------------------------------------------------------

/**
 * Convert GTP column letter to SGF column index (0-based).
 * GTP: A B C D E F G H J K L M N O P Q R S T (skips I)
 * SGF: a b c d e f g h i j k l m n o p q r s (no skip)
 */
function gtpColToSGFIndex(colLetter: string): number {
  const gtpLetters = 'ABCDEFGHJKLMNOPQRST'
  return gtpLetters.indexOf(colLetter.toUpperCase())
}

/**
 * Convert a GTP coordinate string to SGF coordinate notation.
 *
 * GTP uses letter + number (e.g., "C4" = column C, row 4 from bottom).
 * SGF uses two lowercase letters (e.g., "bc" = column b, row c from top).
 *
 * @param gtp - GTP coordinate (e.g., "C4", "Q16") or null for pass.
 * @param boardSize - Board size for row inversion.
 * @returns SGF coordinate string (e.g., "bc") or empty string for pass.
 */
export function gtpToSGF(gtp: string | null, boardSize: BoardSize): string {
  if (!gtp || gtp.toLowerCase() === 'pass') {
    // SGF pass is represented as empty: B[] or W[]
    return ''
  }

  const colLetter = gtp[0]
  const rowNumber = parseInt(gtp.slice(1), 10)

  const colIndex = gtpColToSGFIndex(colLetter)
  if (colIndex === -1) return ''

  // SGF row is 0-based from top; GTP row N means (boardSize - N) from top
  const rowIndex = boardSize - rowNumber

  // SGF uses lowercase letters: a=0, b=1, ..., s=18
  const sgfLetters = 'abcdefghijklmnopqrs'
  const sgfCol = sgfLetters[colIndex]
  const sgfRow = sgfLetters[rowIndex]

  if (!sgfCol || !sgfRow) return ''
  return `${sgfCol}${sgfRow}`
}

/**
 * Convert board index + boardSize to GTP notation.
 * Index 0 = top-left corner = A(boardSize) in GTP.
 */
function indexToGTPCoord(index: number, boardSize: BoardSize): string {
  const col = index % boardSize
  const row = Math.floor(index / boardSize)
  const gtpLetters = 'ABCDEFGHJKLMNOPQRST'
  const colLetter = gtpLetters[col]
  const rowNumber = boardSize - row
  return `${colLetter}${rowNumber}`
}

// ---------------------------------------------------------------------------
// SGF date formatting
// ---------------------------------------------------------------------------

/**
 * Format a Unix timestamp or Date object as SGF DT property value (YYYY-MM-DD).
 */
function formatSGFDate(input: string | number | Date | undefined): string {
  if (!input) {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  }
  if (typeof input === 'string') return input.slice(0, 10)
  if (typeof input === 'number') {
    // Unix timestamp in seconds
    return new Date(input * 1000).toISOString().slice(0, 10)
  }
  return input.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// SGF text escaping
// ---------------------------------------------------------------------------

/**
 * Escape special SGF characters in property values.
 * SGF special chars: ] \ : (inside SimpleText and Text values)
 */
function escapeSGFText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/]/g, '\\]').replace(/:/g, '\\:')
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Export a game as a valid SGF string.
 *
 * The resulting SGF is parseable by standard SGF parsers (e.g., sgfmill, smartgame).
 * Moves with `coordinate` set use that as the GTP location.
 * Moves with `index` set but no `coordinate` derive the GTP location from the index.
 * Null coordinate/index = pass move.
 *
 * @param input - Game metadata and move history.
 * @returns Valid SGF string.
 */
export function exportSGF(input: SGFExportInput): string {
  const {
    boardSize,
    komi,
    rules,
    blackPlayerName = 'Black',
    whitePlayerName = 'KataGo AI',
    result,
    moves,
    date,
  } = input

  // --- Root node properties ---
  const rootProps: string[] = [
    'GM[1]',
    'FF[4]',
    'CA[UTF-8]',
    `SZ[${boardSize}]`,
    `KM[${komi}]`,
    `RU[${escapeSGFText(rules)}]`,
    `PB[${escapeSGFText(blackPlayerName)}]`,
    `PW[${escapeSGFText(whitePlayerName)}]`,
    `DT[${formatSGFDate(date)}]`,
  ]

  if (result) {
    rootProps.push(`RE[${escapeSGFText(result)}]`)
  }

  // --- Move nodes ---
  const moveNodes: string[] = moves.map((move) => {
    const playerTag = move.player === 'B' ? 'B' : 'W'

    // Determine GTP coordinate
    let gtpCoord: string | null = move.coordinate
    if (!gtpCoord && move.index !== null) {
      gtpCoord = indexToGTPCoord(move.index, boardSize)
    }

    const sgfCoord = gtpToSGF(gtpCoord, boardSize)
    return `;${playerTag}[${sgfCoord}]`
  })

  // --- Assemble SGF ---
  const rootNode = `(;${rootProps.join('')}`
  const gameTree = moveNodes.join('')
  return `${rootNode}${gameTree})`
}

// ---------------------------------------------------------------------------
// SGF parsing (for round-trip testing)
// ---------------------------------------------------------------------------

/**
 * Minimal SGF parser for testing exportSGF round-trips.
 * Extracts key properties and move sequence from a single-game SGF.
 * Not a full-featured parser — only handles the properties we export.
 */
export interface ParsedSGF {
  boardSize: number
  komi: number
  blackPlayer: string
  whitePlayer: string
  result: string | null
  date: string | null
  moves: Array<{ player: 'B' | 'W'; coordinate: string }>
}

export function parseSGF(sgf: string): ParsedSGF {
  function extractProp(tag: string): string | null {
    const regex = new RegExp(`${tag}\\[([^\\]]*)\\]`)
    const match = sgf.match(regex)
    return match ? match[1] : null
  }

  const boardSizeStr = extractProp('SZ')
  const komiStr = extractProp('KM')

  // Extract all move tokens: ;B[xx] or ;W[xx]
  const moveRegex = /;([BW])\[([a-s]*)\]/g
  const parsedMoves: Array<{ player: 'B' | 'W'; coordinate: string }> = []
  let m: RegExpExecArray | null
  while (true) {
    m = moveRegex.exec(sgf)
    if (m === null) break
    parsedMoves.push({
      player: m[1] as 'B' | 'W',
      coordinate: m[2], // SGF notation (e.g., "bc")
    })
  }

  return {
    boardSize: boardSizeStr ? parseInt(boardSizeStr, 10) : 19,
    komi: komiStr ? parseFloat(komiStr) : 7.5,
    blackPlayer: extractProp('PB') ?? 'Black',
    whitePlayer: extractProp('PW') ?? 'White',
    result: extractProp('RE'),
    date: extractProp('DT'),
    moves: parsedMoves,
  }
}

/**
 * Convert SGF coordinate back to GTP for testing.
 */
export function sgfToGTP(sgfCoord: string, boardSize: BoardSize): string {
  if (!sgfCoord) return 'pass'
  const gtpLetters = 'ABCDEFGHJKLMNOPQRST'
  const sgfLetters = 'abcdefghijklmnopqrs'

  const colIndex = sgfLetters.indexOf(sgfCoord[0])
  const rowIndex = sgfLetters.indexOf(sgfCoord[1])

  if (colIndex === -1 || rowIndex === -1) return 'pass'

  const colLetter = gtpLetters[colIndex]
  const rowNumber = boardSize - rowIndex
  return `${colLetter}${rowNumber}`
}
