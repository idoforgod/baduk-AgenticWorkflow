// =============================================================================
// GhostStone — Semi-transparent stone preview for Tap-Preview-Confirm
// =============================================================================

import type { GhostStoneProps } from './types'

/**
 * Renders a semi-transparent stone as a move preview.
 * Used in the Tap-Preview-Confirm interaction pattern.
 */
export function GhostStone({ cx, cy, r, color }: GhostStoneProps) {
  const fillColor = color === 'black' ? '#222222' : '#e0e0e0'
  const strokeColor = color === 'black' ? '#000' : '#888'

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={0.5}
      opacity={0.5}
      style={{ pointerEvents: 'none' }}
      data-testid="ghost-stone"
    />
  )
}
