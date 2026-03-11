// =============================================================================
// screens/HomeScreen.tsx — Landing page
// =============================================================================
// Shows: Quick Go start button, recent games list, player stats summary.
// =============================================================================

import { Clock, Trophy, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useGameStore } from '../game-engine/store'

// ---------------------------------------------------------------------------
// Mock recent games data (will be replaced by GameRepository in Step 18)
// ---------------------------------------------------------------------------
interface RecentGame {
  id: string
  result: 'win' | 'loss' | 'ongoing'
  boardSize: 9 | 13 | 19
  moveCount: number
  date: string
  opponent: string
}

const MOCK_RECENT_GAMES: RecentGame[] = [
  { id: '1', result: 'win', boardSize: 9, moveCount: 42, date: 'Today', opponent: 'AI Lv.5' },
  { id: '2', result: 'loss', boardSize: 9, moveCount: 38, date: 'Yesterday', opponent: 'AI Lv.8' },
  { id: '3', result: 'win', boardSize: 13, moveCount: 95, date: '2 days ago', opponent: 'AI Lv.3' },
]

function ResultBadge({ result }: { result: RecentGame['result'] }) {
  if (result === 'win') return <Badge variant="success">Win</Badge>
  if (result === 'loss') return <Badge variant="destructive">Loss</Badge>
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

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
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

      {/* Stats row */}
      <section aria-labelledby="stats-heading">
        <h2
          id="stats-heading"
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Your Stats
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Trophy size={16} />} label="Win Rate" value="58%" sub="Last 30 days" />
          <StatCard icon={<Clock size={16} />} label="Games" value="24" sub="This month" />
          <StatCard icon={<Zap size={16} />} label="Best Streak" value="5" sub="Wins in a row" />
          <StatCard icon={<Trophy size={16} />} label="Rating" value="12k" sub="Estimated" />
        </div>
      </section>

      {/* Recent games */}
      <section aria-labelledby="recent-heading">
        <h2
          id="recent-heading"
          className="text-sm font-medium mb-3"
          style={{ color: 'var(--text-muted)' }}
        >
          Recent Games
        </h2>

        {MOCK_RECENT_GAMES.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p style={{ color: 'var(--text-muted)' }}>
                No games yet. Start your first Quick Go game!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {MOCK_RECENT_GAMES.map((game) => (
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
                            {game.boardSize}x{game.boardSize} vs {game.opponent}
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
