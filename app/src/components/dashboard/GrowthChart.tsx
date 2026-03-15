// =============================================================================
// components/dashboard/GrowthChart.tsx — Win rate trend over recent games
// =============================================================================
// Uses recharts (existing dependency) to show a moving average of win rate.
// Only renders when 5+ games are available.
// =============================================================================

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RecentGame } from '../../hooks/useGameHistory'

interface GrowthChartProps {
  games: readonly RecentGame[]
}

/**
 * Shows a line chart of 5-game moving average win rate.
 * Only renders if 5+ games exist.
 */
export function GrowthChart({ games }: GrowthChartProps) {
  if (games.length < 5) return null

  // Build cumulative win rate per game (oldest first)
  const reversed = [...games].reverse() // games come newest-first
  const data: { game: number; winRate: number }[] = []
  let wins = 0
  const WINDOW = 5

  for (let i = 0; i < reversed.length; i++) {
    if (reversed[i]!.result === 'win') wins++
    // Only start plotting after WINDOW games
    if (i >= WINDOW - 1) {
      // Count wins in the window [i-WINDOW+1 .. i]
      let windowWins = 0
      for (let j = i - WINDOW + 1; j <= i; j++) {
        if (reversed[j]!.result === 'win') windowWins++
      }
      data.push({
        game: i + 1,
        winRate: Math.round((windowWins / WINDOW) * 100),
      })
    }
  }

  if (data.length < 2) return null

  return (
    <section aria-labelledby="growth-heading">
      <h2
        id="growth-heading"
        className="text-sm font-medium mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Your Progress (5-game moving average)
      </h2>
      <div
        className="p-3 rounded-lg border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
        }}
      >
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="game"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              label={{ value: 'Game #', position: 'insideBottomRight', offset: -5, fontSize: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            />
            <Tooltip
              formatter={(value) => [`${value}%`, 'Win Rate']}
              labelFormatter={(label) => `Game ${label}`}
            />
            <ReferenceLine y={50} stroke="var(--text-muted)" strokeDasharray="5 5" />
            <Line
              type="monotone"
              dataKey="winRate"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--accent)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
