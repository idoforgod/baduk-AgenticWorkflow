// =============================================================================
// Zobrist Hashing — Tromp-Taylor Rules Engine
// =============================================================================
// Layer 2 (Domain) — Pure functions after initialization.
// Implements: DKS Section 4 (Zobrist Hashing Specification).
// Used for O(1) incremental superko detection (TT-06).
// =============================================================================

import type { BoardGrid, BoardSize, PlayerColor } from '@core/interfaces'
import { BLACK, WHITE } from './board'

// =============================================================================
// Seeded PRNG (xoshiro256**)
// =============================================================================
// Deterministic PRNG to generate the Zobrist hash table.
// Fixed seed ensures reproducible hashes across sessions.

/**
 * xoshiro256** state (4 x 64-bit values, stored as BigInt).
 */
interface Xoshiro256State {
  s0: bigint
  s1: bigint
  s2: bigint
  s3: bigint
}

const MASK64 = (1n << 64n) - 1n

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64
}

/**
 * Generate the next 64-bit random value from xoshiro256** state.
 * Mutates the state in place.
 */
function xoshiro256Next(state: Xoshiro256State): bigint {
  const result = (rotl((state.s1 * 5n) & MASK64, 7n) * 9n) & MASK64

  const t = (state.s1 << 17n) & MASK64

  state.s2 ^= state.s0
  state.s3 ^= state.s1
  state.s1 ^= state.s2
  state.s0 ^= state.s3

  state.s2 ^= t
  state.s3 = rotl(state.s3, 45n)

  return result
}

/**
 * Initialize xoshiro256** state from a 64-bit seed using SplitMix64.
 */
function seedXoshiro256(seed: bigint): Xoshiro256State {
  // SplitMix64 to expand seed into 4 state values
  function splitmix64(s: bigint): [bigint, bigint] {
    s = (s + 0x9e3779b97f4a7c15n) & MASK64
    let z = s
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64
    z = (z ^ (z >> 31n)) & MASK64
    return [s, z]
  }

  let s = seed
  let v: bigint
  ;[s, v] = splitmix64(s)
  const s0 = v
  ;[s, v] = splitmix64(s)
  const s1 = v
  ;[s, v] = splitmix64(s)
  const s2 = v
  ;[, v] = splitmix64(s)
  const s3 = v

  return { s0, s1, s2, s3 }
}

// =============================================================================
// Zobrist Hash Table
// =============================================================================

/**
 * Zobrist hash table for a specific board size.
 * table[0][i] = random value for Black stone at index i.
 * table[1][i] = random value for White stone at index i.
 */
export interface ZobristTable {
  readonly size: BoardSize
  readonly table: readonly [readonly bigint[], readonly bigint[]]
}

/** Cache of Zobrist tables keyed by board size. */
const zobristCache = new Map<BoardSize, ZobristTable>()

/** Fixed seed for reproducible hashes (DKS Section 4.3). */
const ZOBRIST_SEED = 0x4bad_0c_60_2026n

/**
 * Get or create the Zobrist hash table for a given board size.
 * DKS Section 4.2-4.3: 2 * N*N random 64-bit values from seeded PRNG.
 *
 * @param size - Board size (9, 13, or 19).
 * @returns ZobristTable with pre-computed random values.
 */
export function getZobristTable(size: BoardSize): ZobristTable {
  const cached = zobristCache.get(size)
  if (cached !== undefined) return cached

  const total = size * size
  const state = seedXoshiro256(ZOBRIST_SEED)

  const blackTable: bigint[] = new Array(total)
  const whiteTable: bigint[] = new Array(total)

  for (let i = 0; i < total; i++) {
    blackTable[i] = xoshiro256Next(state)
  }
  for (let i = 0; i < total; i++) {
    whiteTable[i] = xoshiro256Next(state)
  }

  const table: ZobristTable = {
    size,
    table: [blackTable, whiteTable],
  }

  zobristCache.set(size, table)
  return table
}

// =============================================================================
// Hash Computation
// =============================================================================

/**
 * Compute the full Zobrist hash of a board position from scratch.
 * DKS Section 4.4: hash = XOR of zobristTable[color-1][i] for all occupied positions.
 *
 * @param grid - The board grid.
 * @param size - Board size.
 * @returns 64-bit Zobrist hash as BigInt.
 */
export function computeFullHash(grid: BoardGrid, size: BoardSize): bigint {
  const zt = getZobristTable(size)
  const total = size * size
  let hash = 0n

  for (let i = 0; i < total; i++) {
    const cell = grid[i]!
    if (cell === BLACK) {
      hash ^= zt.table[0][i]!
    } else if (cell === WHITE) {
      hash ^= zt.table[1][i]!
    }
  }

  return hash
}

/**
 * Incrementally update a Zobrist hash when placing a stone.
 * DKS Section 4.5: hash ^= zobristTable[color-1][index].
 *
 * @param hash - Current hash value.
 * @param size - Board size.
 * @param index - Board index where stone is placed.
 * @param color - Color of the stone being placed.
 * @returns Updated hash value.
 */
export function hashPlaceStone(
  hash: bigint,
  size: BoardSize,
  index: number,
  color: PlayerColor
): bigint {
  const zt = getZobristTable(size)
  return hash ^ zt.table[color - 1][index]!
}

/**
 * Incrementally update a Zobrist hash when removing (capturing) a stone.
 * XOR is its own inverse, so removing uses the same operation as placing.
 *
 * @param hash - Current hash value.
 * @param size - Board size.
 * @param index - Board index of the stone being removed.
 * @param color - Color of the stone being removed.
 * @returns Updated hash value.
 */
export function hashRemoveStone(
  hash: bigint,
  size: BoardSize,
  index: number,
  color: PlayerColor
): bigint {
  const zt = getZobristTable(size)
  return hash ^ zt.table[color - 1][index]!
}
