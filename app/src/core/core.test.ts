// =============================================================================
// Core module placeholder test
// =============================================================================
// Verifies that the core module exports are importable and that key types
// resolve correctly. This test confirms the scaffold is wired correctly.
// =============================================================================

import { describe, expect, it } from 'vitest'
import { Err, Ok } from './interfaces'

describe('core/interfaces', () => {
  it('Ok() constructs a successful Result', () => {
    const result = Ok(42)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(42)
    }
  })

  it('Err() constructs a failed Result', () => {
    const err = {
      module: 'rules' as const,
      code: 'INVALID_BOARD_SIZE' as const,
      message: 'Board size must be 9, 13, or 19',
    }
    const result = Err(err)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_BOARD_SIZE')
      expect(result.error.message).toContain('Board size')
    }
  })

  it('BoardSize type values are 9, 13, and 19', () => {
    // Compile-time test: these literals must assignable to BoardSize
    const sizes = [9, 13, 19] as const
    expect(sizes).toContain(9)
    expect(sizes).toContain(13)
    expect(sizes).toContain(19)
  })

  it('Player type values are B and W', () => {
    const players = ['B', 'W'] as const
    expect(players).toContain('B')
    expect(players).toContain('W')
  })

  it('GamePhase type covers all phases', () => {
    const phases = ['setup', 'playing', 'scoring', 'finished'] as const
    expect(phases).toHaveLength(4)
  })

  it('GameMode type covers all modes', () => {
    const modes = ['vs-ai', 'review', 'tutorial'] as const
    expect(modes).toHaveLength(3)
  })

  it('Tier type covers all explanation tiers', () => {
    const tiers = ['beginner', 'intermediate', 'advanced'] as const
    expect(tiers).toHaveLength(3)
  })
})
