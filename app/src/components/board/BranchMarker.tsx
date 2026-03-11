// =============================================================================
// BranchMarker — Show alternative moves from analysis (letters A, B, C...)
// =============================================================================

import { type BranchMarkerProps, indexToRowCol, KATRAIN_COLORS, rowColToSvg } from './types'

/**
 * Get color for a branch based on its winrate relative to the best.
 */
function getBranchColor(winrate: number | undefined, bestWinrate: number): string {
  if (winrate === undefined) return KATRAIN_COLORS.blue
  const delta = (winrate - bestWinrate) * 100
  if (delta > -2) return KATRAIN_COLORS.green
  if (delta > -5) return KATRAIN_COLORS.blue
  if (delta > -10) return KATRAIN_COLORS.yellow
  return KATRAIN_COLORS.orange
}

/**
 * Renders labeled markers (A, B, C...) at alternative move positions.
 */
export function BranchMarker({ layout, boardSize, branches }: BranchMarkerProps) {
  if (branches.length === 0) return null

  const bestWinrate = branches[0]?.winrate ?? 0.5

  return (
    <g data-testid="branch-markers">
      {branches.map((branch) => {
        const { row, col } = indexToRowCol(branch.index, boardSize)
        const { x, y } = rowColToSvg(row, col, layout)
        const color = getBranchColor(branch.winrate, bestWinrate)

        return (
          <g key={branch.index} data-testid={`branch-${branch.label}`}>
            {/* Background circle */}
            <circle cx={x} cy={y} r={layout.stoneRadius * 0.85} fill={color} opacity={0.7} />
            {/* Label text */}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={layout.stoneRadius * 1.1}
              fontWeight="bold"
              fill="#ffffff"
              style={{ pointerEvents: 'none' }}
            >
              {branch.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}
