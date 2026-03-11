// =============================================================================
// sgf.test.ts — SGF Export/Parse Tests
// =============================================================================
// Tests for exportSGF, gtpToSGF, sgfToGTP, parseSGF.
// All pure functions — no mocks needed.
//
// Test count target: 10+
// =============================================================================

import type { MoveRecord } from '@core/interfaces'
import { describe, expect, it } from 'vitest'
import { exportSGF, gtpToSGF, parseSGF, sgfToGTP } from './sgf'

// ---------------------------------------------------------------------------
// gtpToSGF tests
// ---------------------------------------------------------------------------

describe('gtpToSGF', () => {
  it('converts A9 to aa on 9x9 (top-left corner)', () => {
    // A=col0, 9=row0 from top → a,a
    expect(gtpToSGF('A9', 9)).toBe('aa')
  })

  it('converts J1 to ii on 9x9 (bottom-right, skipping I)', () => {
    // J=col8 (GTP skips I), 1=row8 from top → i,i
    expect(gtpToSGF('J1', 9)).toBe('ii')
  })

  it('converts pass (null) to empty string', () => {
    expect(gtpToSGF(null, 9)).toBe('')
  })

  it('converts "pass" string to empty string', () => {
    expect(gtpToSGF('pass', 9)).toBe('')
  })

  it('converts D4 correctly on 9x9', () => {
    // D=col3, 4=row5 from top (9-4=5 → index 5) → d, f
    expect(gtpToSGF('D4', 9)).toBe('df')
  })

  it('converts Q16 correctly on 19x19', () => {
    // Q=col15, 16=row3 from top (19-16=3) → p, d
    expect(gtpToSGF('Q16', 19)).toBe('pd')
  })

  it('handles single-digit rows', () => {
    // A1 on 9x9: col0, row8 from top → a, i
    expect(gtpToSGF('A1', 9)).toBe('ai')
  })
})

// ---------------------------------------------------------------------------
// sgfToGTP tests
// ---------------------------------------------------------------------------

describe('sgfToGTP', () => {
  it('converts aa back to A9 on 9x9', () => {
    expect(sgfToGTP('aa', 9)).toBe('A9')
  })

  it('converts ii back to J1 on 9x9', () => {
    expect(sgfToGTP('ii', 9)).toBe('J1')
  })

  it('returns pass for empty string', () => {
    expect(sgfToGTP('', 9)).toBe('pass')
  })

  it('round-trips GTP -> SGF -> GTP for common coordinates', () => {
    const coords = ['A9', 'D4', 'E5', 'F6', 'J1']
    for (const gtp of coords) {
      const sgf = gtpToSGF(gtp, 9)
      const recovered = sgfToGTP(sgf, 9)
      expect(recovered).toBe(gtp)
    }
  })

  it('round-trips 19x19 coordinates', () => {
    const coords = ['A19', 'Q16', 'D4', 'R3', 'T1']
    for (const gtp of coords) {
      const sgf = gtpToSGF(gtp, 19)
      const recovered = sgfToGTP(sgf, 19)
      expect(recovered).toBe(gtp)
    }
  })
})

// ---------------------------------------------------------------------------
// exportSGF tests
// ---------------------------------------------------------------------------

type Player = 'B' | 'W'
function makeMoves(pairs: Array<[Player, string | null]>): MoveRecord[] {
  return pairs.map(([player, coord], i) => ({
    moveNumber: i,
    player,
    index: coord ? 40 + i : null,
    coordinate: coord,
    timestamp: 1700000000 + i * 10,
    captures: [],
  }))
}

describe('exportSGF', () => {
  it('produces a string starting with the SGF header', () => {
    const sgf = exportSGF({
      gameId: 'test-game',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).toMatch(/^\(;GM\[1\]/)
  })

  it('includes the board size', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).toContain('SZ[9]')
  })

  it('includes the komi value', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 7.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).toContain('KM[7.5]')
  })

  it('includes player names when provided', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      blackPlayerName: 'Alice',
      whitePlayerName: 'KataGo',
      moves: [],
    })
    expect(sgf).toContain('PB[Alice]')
    expect(sgf).toContain('PW[KataGo]')
  })

  it('includes default player names when not provided', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).toContain('PB[Black]')
    expect(sgf).toContain('PW[KataGo AI]')
  })

  it('includes the result when provided', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      result: 'B+R',
      moves: [],
    })
    expect(sgf).toContain('RE[B+R]')
  })

  it('omits RE property when no result', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).not.toContain('RE[')
  })

  it('encodes move sequence correctly', () => {
    const moves = makeMoves([
      ['B', 'E5'], // center of 9x9
      ['W', 'D4'],
    ])
    const sgf = exportSGF({ gameId: 'g', boardSize: 9, komi: 6.5, rules: 'tromp-taylor', moves })
    expect(sgf).toContain(';B[')
    expect(sgf).toContain(';W[')
  })

  it('encodes pass moves as empty coordinates ;B[] or ;W[]', () => {
    const moves = makeMoves([
      ['B', null],
      ['W', null],
    ])
    const sgf = exportSGF({ gameId: 'g', boardSize: 9, komi: 6.5, rules: 'tromp-taylor', moves })
    expect(sgf).toContain(';B[]')
    expect(sgf).toContain(';W[]')
  })

  it('closes the SGF tree with )', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf.endsWith(')')).toBe(true)
  })

  it("includes DT property with today's date", () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    expect(sgf).toMatch(/DT\[\d{4}-\d{2}-\d{2}\]/)
  })
})

// ---------------------------------------------------------------------------
// parseSGF tests (round-trip)
// ---------------------------------------------------------------------------

describe('parseSGF round-trip', () => {
  it('parses board size correctly from exported SGF', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    const parsed = parseSGF(sgf)
    expect(parsed.boardSize).toBe(9)
  })

  it('parses komi correctly', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 7.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    const parsed = parseSGF(sgf)
    expect(parsed.komi).toBe(7.5)
  })

  it('parses player names', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      blackPlayerName: 'Player1',
      whitePlayerName: 'Bot',
      moves: [],
    })
    const parsed = parseSGF(sgf)
    expect(parsed.blackPlayer).toBe('Player1')
    expect(parsed.whitePlayer).toBe('Bot')
  })

  it('parses result', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      result: 'W+4.5',
      moves: [],
    })
    const parsed = parseSGF(sgf)
    expect(parsed.result).toBe('W+4.5')
  })

  it('parses null result when absent', () => {
    const sgf = exportSGF({
      gameId: 'g',
      boardSize: 9,
      komi: 6.5,
      rules: 'tromp-taylor',
      moves: [],
    })
    const parsed = parseSGF(sgf)
    expect(parsed.result).toBeNull()
  })

  it('parses correct number of moves', () => {
    const moves = makeMoves([
      ['B', 'E5'],
      ['W', 'D4'],
      ['B', 'F6'],
    ])
    const sgf = exportSGF({ gameId: 'g', boardSize: 9, komi: 6.5, rules: 'tromp-taylor', moves })
    const parsed = parseSGF(sgf)
    expect(parsed.moves).toHaveLength(3)
  })

  it('preserves player alternation in move list', () => {
    const moves = makeMoves([
      ['B', 'E5'],
      ['W', 'D4'],
      ['B', 'F6'],
    ])
    const sgf = exportSGF({ gameId: 'g', boardSize: 9, komi: 6.5, rules: 'tromp-taylor', moves })
    const parsed = parseSGF(sgf)
    expect(parsed.moves[0].player).toBe('B')
    expect(parsed.moves[1].player).toBe('W')
    expect(parsed.moves[2].player).toBe('B')
  })
})
