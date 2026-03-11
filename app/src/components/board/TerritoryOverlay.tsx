// =============================================================================
// TerritoryOverlay — Territory markers (small squares) for scoring
// =============================================================================

import { indexToRowCol, rowColToSvg, type TerritoryOverlayProps } from './types'

/**
 * Renders small filled squares at intersections classified as territory.
 * Black territory: dark squares. White territory: light squares.
 */
export function TerritoryOverlay({
  layout,
  boardSize,
  blackTerritory,
  whiteTerritory,
}: TerritoryOverlayProps) {
  const squareSize = layout.cellSize * 0.25
  const elements: JSX.Element[] = []

  for (const index of blackTerritory) {
    const { row, col } = indexToRowCol(index, boardSize)
    const { x, y } = rowColToSvg(row, col, layout)
    elements.push(
      <rect
        key={`bt-${index}`}
        x={x - squareSize / 2}
        y={y - squareSize / 2}
        width={squareSize}
        height={squareSize}
        fill="#111111"
        opacity={0.7}
        data-testid={`territory-black-${index}`}
      />
    )
  }

  for (const index of whiteTerritory) {
    const { row, col } = indexToRowCol(index, boardSize)
    const { x, y } = rowColToSvg(row, col, layout)
    elements.push(
      <rect
        key={`wt-${index}`}
        x={x - squareSize / 2}
        y={y - squareSize / 2}
        width={squareSize}
        height={squareSize}
        fill="#eeeeee"
        stroke="#888"
        strokeWidth={0.5}
        opacity={0.7}
        data-testid={`territory-white-${index}`}
      />
    )
  }

  return <g data-testid="territory-overlay">{elements}</g>
}
