// =============================================================================
// WinRateGraph — Line chart using Recharts showing winrate over moves
// =============================================================================
// Uses KaTrain color gradient: green (good for Black) to blue (neutral) to
// red (good for White).
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
import type { WinRateGraphProps } from './types'

/**
 * Renders a line chart of Black's win rate over the course of the game.
 * The 50% line is highlighted as the equilibrium point.
 */
export function WinRateGraph({ data, width, height = 150, currentMove }: WinRateGraphProps) {
  if (data.length === 0) {
    return (
      <div
        data-testid="winrate-graph-empty"
        style={{
          width: width ?? '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
        }}
      >
        No data
      </div>
    )
  }

  const chartData = data.map((d) => ({
    move: d.move,
    blackWinRate: Math.round(d.blackWinRate * 10) / 10,
  }))

  return (
    <div data-testid="winrate-graph" style={{ width: width ?? '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis
            dataKey="move"
            tick={{ fontSize: 10 }}
            label={{ value: 'Move', position: 'insideBottomRight', offset: -5, fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            ticks={[0, 25, 50, 75, 100]}
            label={{ value: 'Win %', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <Tooltip
            formatter={(value: number) => [`${value}%`, 'Black Win Rate']}
            labelFormatter={(label: number) => `Move ${label}`}
          />
          {/* 50% equilibrium line */}
          <ReferenceLine y={50} stroke="#999" strokeDasharray="5 5" />
          {/* Current move indicator */}
          {currentMove !== undefined && (
            <ReferenceLine x={currentMove} stroke="#2196F3" strokeWidth={2} />
          )}
          <Line
            type="monotone"
            dataKey="blackWinRate"
            stroke="#333"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#2196F3' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
