// =============================================================================
// Board Representation and Manipulation — Tromp-Taylor Rules Engine
// =============================================================================
// Layer 2 (Domain) — Pure functions, no side effects.
// Implements: DKS Section 3 (Board Representation), Rules TT-01 through TT-04.
// =============================================================================

import type {
  BoardGrid,
  BoardSize,
  BoardState,
  CellState,
  Group,
  PlayerColor,
} from '@core/interfaces'

// =============================================================================
// Constants
// =============================================================================

export const EMPTY: CellState = 0
export const BLACK: PlayerColor = 1
export const WHITE: PlayerColor = 2

/** Returns the opponent color. Black -> White, White -> Black. */
export function opponentColor(color: PlayerColor): PlayerColor {
  return color === BLACK ? WHITE : BLACK
}

// =============================================================================
// Pre-computed Adjacency Tables
// =============================================================================

/**
 * Cache of adjacency tables keyed by board size.
 * Each table maps a board index to an array of valid neighbor indices.
 */
const adjacencyCache = new Map<BoardSize, ReadonlyArray<readonly number[]>>()

/**
 * Build or retrieve the adjacency table for a given board size.
 * DKS Section 3.2: Pre-computed neighbor table for O(1) adjacency lookup.
 *
 * @param size - Board size (9, 13, or 19).
 * @returns Array of neighbor index arrays, one per board intersection.
 */
export function getAdjacencyTable(size: BoardSize): ReadonlyArray<readonly number[]> {
  const cached = adjacencyCache.get(size)
  if (cached !== undefined) return cached

  const total = size * size
  const table: number[][] = new Array(total)

  for (let i = 0; i < total; i++) {
    const row = Math.floor(i / size)
    const col = i % size
    const neighbors: number[] = []

    if (row > 0) neighbors.push(i - size) // up
    if (row < size - 1) neighbors.push(i + size) // down
    if (col > 0) neighbors.push(i - 1) // left
    if (col < size - 1) neighbors.push(i + 1) // right

    table[i] = neighbors
  }

  adjacencyCache.set(size, table)
  return table
}

// =============================================================================
// Board Creation
// =============================================================================

/**
 * Create a new empty board of the given size.
 * DKS C13: All intersections initialized to 0 (Empty).
 *
 * @param size - Board size (9, 13, or 19).
 * @returns A new empty BoardState with hash 0n.
 */
export function createEmptyBoard(size: BoardSize): BoardState {
  return {
    size,
    grid: new Uint8Array(size * size),
    hash: 0n,
  }
}

/**
 * Clone a board state (deep copy of the grid).
 * The grid Uint8Array is copied; all other fields are immutable primitives or bigint.
 */
export function cloneBoard(board: BoardState): BoardState {
  return {
    size: board.size,
    grid: new Uint8Array(board.grid),
    hash: board.hash,
  }
}

/**
 * Create a new BoardState with a modified grid and hash.
 * Used internally after move application.
 */
export function boardWith(board: BoardState, grid: BoardGrid, hash: bigint): BoardState {
  return {
    size: board.size,
    grid,
    hash,
  }
}

// =============================================================================
// Group Finding (BFS)
// =============================================================================

/**
 * Find the group (connected component) that contains the stone at the given index.
 * DKS E15: Maximal connected set of same-color stones.
 * Uses BFS through orthogonally adjacent same-color stones.
 *
 * @param grid - The board grid.
 * @param size - Board size.
 * @param index - Starting board index (must be occupied).
 * @returns Group with color, stones set, and liberties set. Null if empty intersection.
 */
export function findGroup(grid: BoardGrid, size: BoardSize, index: number): Group | null {
  const color = grid[index] as CellState
  if (color === EMPTY) return null

  const adj = getAdjacencyTable(size)
  const stones = new Set<number>()
  const liberties = new Set<number>()
  const queue: number[] = [index]
  stones.add(index)

  while (queue.length > 0) {
    const current = queue.pop()!
    const neighbors = adj[current]!

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i]!
      const nColor = grid[n] as CellState

      if (nColor === EMPTY) {
        liberties.add(n)
      } else if (nColor === color && !stones.has(n)) {
        stones.add(n)
        queue.push(n)
      }
    }
  }

  return {
    color: color as PlayerColor,
    stones,
    liberties,
  }
}

/**
 * Check if the group containing the stone at index has any liberties.
 * Optimized: stops BFS as soon as a liberty is found.
 *
 * @param grid - The board grid.
 * @param size - Board size.
 * @param index - Starting board index (must be occupied).
 * @returns true if the group has at least one liberty.
 */
export function hasLiberties(grid: BoardGrid, size: BoardSize, index: number): boolean {
  const color = grid[index] as CellState
  if (color === EMPTY) return true

  const adj = getAdjacencyTable(size)
  const visited = new Set<number>()
  const queue: number[] = [index]
  visited.add(index)

  while (queue.length > 0) {
    const current = queue.pop()!
    const neighbors = adj[current]!

    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i]!
      const nColor = grid[n] as CellState

      if (nColor === EMPTY) return true
      if (nColor === color && !visited.has(n)) {
        visited.add(n)
        queue.push(n)
      }
    }
  }

  return false
}

// =============================================================================
// Capture Logic
// =============================================================================

/**
 * Find all stones of the given color that have zero liberties.
 * TT-04 (Clearing): Remove all stones of color C that do not reach empty.
 *
 * @param grid - The board grid.
 * @param size - Board size.
 * @param color - The color to check for captures.
 * @returns Array of board indices of stones to be captured (removed).
 */
export function findCaptures(grid: BoardGrid, size: BoardSize, color: PlayerColor): number[] {
  const total = size * size
  const visited = new Uint8Array(total)
  const captured: number[] = []

  for (let i = 0; i < total; i++) {
    if (grid[i] !== color || visited[i]) continue

    // BFS to find the group and check liberties
    const group: number[] = [i]
    let hasLiberty = false
    const queue: number[] = [i]
    visited[i] = 1

    const adj = getAdjacencyTable(size)

    while (queue.length > 0) {
      const current = queue.pop()!
      const neighbors = adj[current]!

      for (let j = 0; j < neighbors.length; j++) {
        const n = neighbors[j]!
        const nColor = grid[n] as CellState

        if (nColor === EMPTY) {
          hasLiberty = true
        } else if (nColor === color && !visited[n]) {
          visited[n] = 1
          queue.push(n)
          group.push(n)
        }
      }
    }

    if (!hasLiberty) {
      for (const stone of group) {
        captured.push(stone)
      }
    }
  }

  return captured
}

/**
 * Find captures that would occur around a specific placed stone.
 * More efficient than scanning the entire board: only checks opponent groups
 * adjacent to the placed stone.
 *
 * @param grid - The board grid (AFTER the stone has been placed).
 * @param size - Board size.
 * @param index - The index where a stone was just placed.
 * @param opponentColor - The opponent's color.
 * @returns Array of board indices of captured opponent stones.
 */
export function findCapturesAround(
  grid: BoardGrid,
  size: BoardSize,
  index: number,
  opponent: PlayerColor
): number[] {
  const adj = getAdjacencyTable(size)
  const neighbors = adj[index]!
  const captured: number[] = []
  const checked = new Set<number>()

  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i]!
    if (grid[n] !== opponent || checked.has(n)) continue

    const group = findGroup(grid, size, n)
    if (group === null) continue

    // Mark all stones in this group as checked to avoid re-examining
    for (const s of group.stones) {
      checked.add(s)
    }

    if (group.liberties.size === 0) {
      for (const s of group.stones) {
        captured.push(s)
      }
    }
  }

  return captured
}

// =============================================================================
// Coordinate Conversion
// =============================================================================

/**
 * Convert a board index to (row, col) coordinates.
 */
export function indexToCoord(index: number, size: BoardSize): { row: number; col: number } {
  return {
    row: Math.floor(index / size),
    col: index % size,
  }
}

/**
 * Convert (row, col) coordinates to a board index.
 */
export function coordToIndex(row: number, col: number, size: BoardSize): number {
  return row * size + col
}

/**
 * Convert a board index to GTP coordinate string (e.g., "C4", "Q16").
 * GTP columns skip 'I' (A-H, J-T for 19x19).
 * GTP rows are 1-based from bottom.
 */
export function indexToGTP(index: number, size: BoardSize): string {
  const row = Math.floor(index / size)
  const col = index % size

  // GTP columns: A=0, B=1, ..., H=7, J=8 (skip I), K=9, ...
  const gtpCol = col >= 8 ? String.fromCharCode(65 + col + 1) : String.fromCharCode(65 + col)
  // GTP rows: 1-based from bottom
  const gtpRow = size - row

  return `${gtpCol}${gtpRow}`
}

/**
 * Convert a GTP coordinate string to a board index.
 * Returns -1 for invalid coordinates.
 */
export function gtpToIndex(gtp: string, size: BoardSize): number {
  if (gtp.length < 2) return -1

  const colChar = gtp.charAt(0).toUpperCase()
  const rowStr = gtp.slice(1)

  // GTP columns: A=0, B=1, ..., H=7, J=8 (skip I)
  let col = colChar.charCodeAt(0) - 65 // 'A' = 0
  if (col < 0 || col >= 25) return -1
  if (colChar > 'I') col-- // Adjust for skipped 'I'
  if (col < 0 || col >= size) return -1

  const gtpRow = parseInt(rowStr, 10)
  if (Number.isNaN(gtpRow) || gtpRow < 1 || gtpRow > size) return -1

  const row = size - gtpRow

  return row * size + col
}

/**
 * Check if a board index is within valid bounds.
 */
export function isValidIndex(index: number, size: BoardSize): boolean {
  return Number.isInteger(index) && index >= 0 && index < size * size
}
