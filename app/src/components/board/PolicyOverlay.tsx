import type { CandidateMove } from '../../hooks/useKataGoAnalysis'
import type { BoardLayout } from './types'
import { indexToRowCol, rowColToSvg } from './types'

interface PolicyOverlayProps {
  layout: BoardLayout
  boardSize: number
  candidates: CandidateMove[]
}

const RANK_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

/**
 * SVG overlay that shows top candidate moves as colored circles with win rate labels.
 * Rank 1 = green (best), Rank 5 = red (worst among top 5).
 */
export function PolicyOverlay({ layout, boardSize, candidates }: PolicyOverlayProps) {
  if (candidates.length === 0) return null

  const maxWinRate = candidates[0]?.winRate ?? 50

  return (
    <g data-testid="policy-overlay">
      {candidates.map((c, rank) => {
        if (c.index < 0) return null
        const { row, col } = indexToRowCol(c.index, boardSize)
        const { x, y } = rowColToSvg(row, col, layout)
        const color = RANK_COLORS[rank] ?? RANK_COLORS[4]
        // Size proportional to win rate relative to best candidate
        const sizeRatio = 0.5 + 0.5 * (c.winRate / Math.max(maxWinRate, 1))
        const r = layout.stoneRadius * sizeRatio * 0.85

        return (
          <g key={`policy-${c.move}`}>
            {/* Semi-transparent circle */}
            <circle cx={x} cy={y} r={r} fill={color} opacity={0.6} />
            {/* Rank number */}
            <text
              x={x}
              y={y - r * 0.15}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={r * 0.9}
              fontWeight="bold"
              fill="white"
              style={{ pointerEvents: 'none' }}
            >
              {rank + 1}
            </text>
            {/* Win rate below */}
            <text
              x={x}
              y={y + r * 0.7}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={r * 0.55}
              fill="white"
              style={{ pointerEvents: 'none' }}
            >
              {c.winRate}%
            </text>
          </g>
        )
      })}
    </g>
  )
}
