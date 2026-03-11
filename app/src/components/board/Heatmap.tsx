// =============================================================================
// Heatmap — Color overlay on intersections using KaTrain color scheme
// =============================================================================
// Green (#4CAF50) — Good move (WR delta > -2%)
// Blue (#2196F3) — Slightly inaccurate (WR delta -2% to -5%)
// Yellow (#FFC107) — Inaccuracy (WR delta -5% to -10%)
// Orange (#FF9800) — Mistake (WR delta -10% to -15%)
// Red (#F44336) — Blunder (WR delta < -15%)
// =============================================================================

import type { GTPLocation, MoveInfo } from '@core/interfaces'
import { GTP_COLUMNS, type HeatmapProps, KATRAIN_COLORS, rowColToSvg } from './types'

/**
 * Convert a GTP coordinate to row/col. Returns null if invalid.
 */
function gtpToRowCol(gtp: GTPLocation, boardSize: number): { row: number; col: number } | null {
  if (!gtp || gtp.toLowerCase() === 'pass') return null
  const col = GTP_COLUMNS.indexOf(gtp[0]!.toUpperCase())
  if (col === -1) return null
  const rowNumber = Number.parseInt(gtp.slice(1), 10)
  if (Number.isNaN(rowNumber)) return null
  const row = boardSize - rowNumber
  if (row < 0 || row >= boardSize) return null
  return { row, col }
}

/**
 * Determine heatmap color based on the difference from the best move's winrate.
 */
function getHeatmapColor(moveInfo: MoveInfo, bestWinrate: number): string {
  const delta = (moveInfo.winrate - bestWinrate) * 100 // Convert to percentage

  if (delta > -2) return KATRAIN_COLORS.green
  if (delta > -5) return KATRAIN_COLORS.blue
  if (delta > -10) return KATRAIN_COLORS.yellow
  if (delta > -15) return KATRAIN_COLORS.orange
  return KATRAIN_COLORS.red
}

/**
 * Renders colored circles on each candidate move intersection.
 * Circle opacity reflects visit count relative to the top move.
 */
export function Heatmap({ layout, moveInfos, boardSize }: HeatmapProps) {
  if (moveInfos.length === 0) return null

  const bestWinrate = moveInfos[0]?.winrate ?? 0.5
  const maxVisits = moveInfos[0]?.visits ?? 1

  return (
    <g data-testid="heatmap">
      {moveInfos.map((info) => {
        const pos = gtpToRowCol(info.move, boardSize)
        if (!pos) return null

        const { x, y } = rowColToSvg(pos.row, pos.col, layout)
        const color = getHeatmapColor(info, bestWinrate)
        const opacity = Math.max(0.2, Math.min(0.8, info.visits / maxVisits))

        return (
          <circle
            key={info.move}
            cx={x}
            cy={y}
            r={layout.stoneRadius * 0.9}
            fill={color}
            opacity={opacity}
            data-testid={`heatmap-dot-${info.move}`}
          />
        )
      })}
    </g>
  )
}
