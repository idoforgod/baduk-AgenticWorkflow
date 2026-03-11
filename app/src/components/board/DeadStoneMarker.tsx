// =============================================================================
// DeadStoneMarker — X mark on dead stones during scoring
// =============================================================================

import { type DeadStoneMarkerProps, indexToRowCol, rowColToSvg } from './types'

/**
 * Renders X marks on stones marked as dead during the scoring phase.
 */
export function DeadStoneMarker({ layout, boardSize, deadStones }: DeadStoneMarkerProps) {
  const armLength = layout.stoneRadius * 0.5
  const elements: JSX.Element[] = []

  for (const index of deadStones) {
    const { row, col } = indexToRowCol(index, boardSize)
    const { x, y } = rowColToSvg(row, col, layout)

    elements.push(
      <g key={`dead-${index}`} data-testid={`dead-stone-${index}`}>
        <line
          x1={x - armLength}
          y1={y - armLength}
          x2={x + armLength}
          y2={y + armLength}
          stroke="#ff0000"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <line
          x1={x + armLength}
          y1={y - armLength}
          x2={x - armLength}
          y2={y + armLength}
          stroke="#ff0000"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    )
  }

  return <g data-testid="dead-stone-markers">{elements}</g>
}
