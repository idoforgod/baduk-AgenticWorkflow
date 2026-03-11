// =============================================================================
// LastMoveMarker — Circle marker highlighting the last played move
// =============================================================================

import type { LastMoveMarkerProps } from './types'

/**
 * Renders a circle indicator on the last played stone.
 * Uses contrasting color: white circle on black stone, black circle on white stone.
 */
export function LastMoveMarker({ cx, cy, size, stoneColor }: LastMoveMarkerProps) {
  const markerColor = stoneColor === 'black' ? '#ffffff' : '#000000'

  return (
    <circle
      cx={cx}
      cy={cy}
      r={size * 0.3}
      fill="none"
      stroke={markerColor}
      strokeWidth={1.5}
      data-testid="last-move-marker"
    />
  )
}
