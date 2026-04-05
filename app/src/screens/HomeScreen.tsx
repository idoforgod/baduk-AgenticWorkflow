// =============================================================================
// screens/HomeScreen.tsx — Landing page with real data
// =============================================================================
// Shows: Quick Go start button, real player stats, recent games list,
// quick guide. Stats and games come from useGameHistory (SQLite via Zod).
// =============================================================================

import { BarChart3, Clock, Trophy, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { GrowthChart } from '../components/dashboard/GrowthChart'
import { LastGameHighlights } from '../components/dashboard/LastGameHighlights'
import { WeaknessInsight } from '../components/dashboard/WeaknessInsight'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useGameStore } from '../game-engine/store'
import { type RecentGame, useGameHistory } from '../hooks/useGameHistory'
import { useWinRateStore } from '../hooks/useWinRateStore'

// ---------------------------------------------------------------------------
// Result badge
// ---------------------------------------------------------------------------

function ResultBadge({ result }: { result: RecentGame['result'] }) {
  if (result === 'win') return <Badge variant="success">Win</Badge>
  if (result === 'loss') return <Badge variant="destructive">Loss</Badge>
  if (result === 'draw') return <Badge variant="secondary">Draw</Badge>
  return <Badge variant="secondary">Ongoing</Badge>
}

// ---------------------------------------------------------------------------
// Stats card
// ---------------------------------------------------------------------------
interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div
      className="flex flex-col gap-1 p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </div>
      {sub && (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// HomeScreen component
// ---------------------------------------------------------------------------

export function HomeScreen() {
  const status = useGameStore((s) => s.status)
  const hasActiveGame = status === 'playing'

  // Real data from SQLite (Zod validated)
  const { games, stats, boardSizeStats, isLoading } = useGameHistory()

  // Last game highlights (session-only)
  const lastGameHistory = useWinRateStore((s) => s.lastGameHistory)

  return (
    <div className="mx-auto px-4 py-8 space-y-8" style={{ maxWidth: 'min(100%, 1200px)' }}>
      {/* Hero section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Quick Go
        </h1>
        <p className="text-lg max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
          One game on your lunch break. 9x9 board, 3 minutes, instant AI opponent.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button asChild size="lg">
            <Link to="/quick-go">
              <Zap size={20} />
              Quick Go — Play Now
            </Link>
          </Button>

          {hasActiveGame && (
            <Button variant="outline" size="lg" asChild>
              <Link to="/game">Resume Game</Link>
            </Button>
          )}
        </div>
      </section>

      {/* Stats row — real data */}
      <section aria-labelledby="stats-heading">
        <h2
          id="stats-heading"
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Your Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<Trophy size={16} />}
            label="Win Rate"
            value={isLoading ? '—' : `${stats.winRate}%`}
            sub="All games"
          />
          <StatCard
            icon={<Clock size={16} />}
            label="Games"
            value={isLoading ? '—' : String(stats.totalGames)}
            sub="Total played"
          />
          <StatCard
            icon={<Zap size={16} />}
            label="Current Streak"
            value={isLoading ? '—' : String(stats.currentStreak)}
            sub={`Best: ${stats.bestStreak}`}
          />
          <StatCard
            icon={<BarChart3 size={16} />}
            label="Board Sizes"
            value={isLoading ? '—' : String(boardSizeStats.length)}
            sub={
              boardSizeStats.map((b) => `${b.boardSize}x${b.boardSize}`).join(', ') || 'None yet'
            }
          />
        </div>
      </section>

      {/* Board size breakdown — show if 2+ sizes played */}
      {boardSizeStats.length >= 2 && (
        <section aria-labelledby="boardsize-heading">
          <h2
            id="boardsize-heading"
            className="text-sm font-medium mb-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Win Rate by Board Size
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {boardSizeStats.map((b) => (
              <div
                key={b.boardSize}
                className="p-3 rounded-lg border text-center"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {b.winRate}%
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {b.boardSize}x{b.boardSize} ({b.games} games)
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Growth chart — 5-game moving average */}
      <GrowthChart games={games} />

      {/* Last game highlights — session only */}
      <LastGameHighlights lastGameHistory={lastGameHistory} />

      {/* Recent games — real data */}
      <section aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Recent Games
        </h2>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p style={{ color: 'var(--text-muted)' }}>Loading games...</p>
            </CardContent>
          </Card>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p style={{ color: 'var(--text-muted)' }}>
                No games yet. Start your first Quick Go game!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {games.map((game) => (
              <Link key={game.id} to={`/analysis/${game.id}`} style={{ textDecoration: 'none' }}>
                <Card className="hover:border-[var(--accent)] transition-colors cursor-pointer">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ResultBadge result={game.result} />
                        <div>
                          <div
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {game.boardSize}x{game.boardSize} {game.opponent}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {game.moveCount} moves
                          </div>
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {game.date}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Weakness insights — areas to improve */}
      <WeaknessInsight boardSizeStats={boardSizeStats} games={games} />

      {/* Quick tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Guide</CardTitle>
          <CardDescription>New to Go? Start here.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {[
              { step: '1', title: 'Place stones', desc: 'Surround territory to score points' },
              { step: '2', title: 'Capture groups', desc: 'Remove all liberties to capture' },
              { step: '3', title: 'End the game', desc: 'Pass twice when done claiming territory' },
            ].map((tip) => (
              <div
                key={tip.step}
                className="flex gap-3 p-3 rounded-md"
                style={{ backgroundColor: 'var(--bg-elevated)' }}
              >
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                  style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' }}
                >
                  {tip.step}
                </span>
                <div>
                  <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {tip.title}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>{tip.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
