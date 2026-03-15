// =============================================================================
// components/dashboard/WeaknessInsight.tsx — Board size weakness analysis
// =============================================================================
// Shows simplified insights based on available data:
// - Board size win rate comparison
// - Average game length trends
// Only renders when 5+ games exist.
// =============================================================================

import { AlertTriangle, TrendingDown } from 'lucide-react'
import type { RecentGame } from '../../hooks/useGameHistory'
import type { BoardSizeStats } from '../../utils/calcStats'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'

interface WeaknessInsightProps {
  boardSizeStats: readonly BoardSizeStats[]
  games: readonly RecentGame[]
}

interface Insight {
  icon: React.ReactNode
  title: string
  description: string
}

function analyzeWeaknesses(
  boardSizeStats: readonly BoardSizeStats[],
  games: readonly RecentGame[]
): Insight[] {
  const insights: Insight[] = []

  // Insight 1: Board size with worst win rate (if 2+ sizes played)
  if (boardSizeStats.length >= 2) {
    const worst = [...boardSizeStats].sort((a, b) => a.winRate - b.winRate)[0]
    const best = [...boardSizeStats].sort((a, b) => b.winRate - a.winRate)[0]
    if (worst && best && worst.boardSize !== best.boardSize && worst.winRate < best.winRate - 10) {
      insights.push({
        icon: <TrendingDown size={14} style={{ color: 'var(--danger)' }} />,
        title: `${worst.boardSize}x${worst.boardSize} needs practice`,
        description: `Win rate ${worst.winRate}% on ${worst.boardSize}x${worst.boardSize} vs ${best.winRate}% on ${best.boardSize}x${best.boardSize}. Try more ${worst.boardSize}x${worst.boardSize} games.`,
      })
    }
  }

  // Insight 2: Short games (average < 20 moves on 9x9) may indicate early mistakes
  const finishedGames = games.filter((g) => g.result !== 'ongoing')
  if (finishedGames.length >= 5) {
    const avgMoves = finishedGames.reduce((sum, g) => sum + g.moveCount, 0) / finishedGames.length
    const losses = finishedGames.filter((g) => g.result === 'loss')
    if (losses.length >= 3) {
      const avgLossMoves = losses.reduce((sum, g) => sum + g.moveCount, 0) / losses.length
      if (avgLossMoves < avgMoves * 0.7) {
        insights.push({
          icon: <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />,
          title: 'Losses end early',
          description: `Your losses average ${Math.round(avgLossMoves)} moves vs ${Math.round(avgMoves)} overall. Focus on middle-game survival.`,
        })
      }
    }
  }

  return insights.slice(0, 2) // Max 2 insights
}

export function WeaknessInsight({ boardSizeStats, games }: WeaknessInsightProps) {
  const finishedGames = games.filter((g) => g.result !== 'ongoing')
  if (finishedGames.length < 5) return null

  const insights = analyzeWeaknesses(boardSizeStats, games)
  if (insights.length === 0) return null

  return (
    <section aria-labelledby="weakness-heading">
      <h2
        id="weakness-heading"
        className="text-sm font-medium mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Areas to Improve
      </h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {insights.map((insight, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="mt-0.5 flex-shrink-0">{insight.icon}</div>
              <div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {insight.title}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {insight.description}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  )
}
