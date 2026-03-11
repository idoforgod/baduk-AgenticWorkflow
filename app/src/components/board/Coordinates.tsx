// =============================================================================
// Coordinates — A-T (skip I) column labels + 1-N row labels around board edge
// =============================================================================

import type { CoordinatesProps } from './types'
import { GTP_COLUMNS } from './types'

/**
 * Renders column (A-T, skipping I) and row (1-N) labels around the board edges.
 */
export function Coordinates({ layout }: CoordinatesProps) {
  const { boardSize, padding, cellSize } = layout
  const fontSize = Math.max(9, Math.min(12, cellSize * 0.4))
  const offset = 15

  const columns: JSX.Element[] = []
  const rows: JSX.Element[] = []

  for (let col = 0; col < boardSize; col++) {
    const x = padding + col * cellSize
    const letter = GTP_COLUMNS[col]

    // Top label
    columns.push(
      <text
        key={`col-top-${col}`}
        x={x}
        y={padding - offset}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#555"
        fontFamily="sans-serif"
      >
        {letter}
      </text>
    )

    // Bottom label
    columns.push(
      <text
        key={`col-bottom-${col}`}
        x={x}
        y={padding + (boardSize - 1) * cellSize + offset}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#555"
        fontFamily="sans-serif"
      >
        {letter}
      </text>
    )
  }

  for (let row = 0; row < boardSize; row++) {
    const y = padding + row * cellSize
    // GTP row numbers: bottom row is 1, top row is boardSize
    const rowNumber = boardSize - row

    // Left label
    rows.push(
      <text
        key={`row-left-${row}`}
        x={padding - offset}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#555"
        fontFamily="sans-serif"
      >
        {rowNumber}
      </text>
    )

    // Right label
    rows.push(
      <text
        key={`row-right-${row}`}
        x={padding + (boardSize - 1) * cellSize + offset}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fill="#555"
        fontFamily="sans-serif"
      >
        {rowNumber}
      </text>
    )
  }

  return (
    <g data-testid="coordinates">
      {columns}
      {rows}
    </g>
  )
}
