// =============================================================================
// screens/AnalysisScreen.tsx — Post-game analysis screen
// =============================================================================
// Shows: board with heatmap overlay, win-rate graph placeholder, explanation
// cards, and move-by-move review navigation.
// =============================================================================

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BoardPlaceholder } from '../components/board/BoardPlaceholder'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useGameStore } from '../game-engine/store'

// ---------------------------------------------------------------------------
// Win-rate graph placeholder (recharts integration deferred to Step 18)
// ---------------------------------------------------------------------------
function WinRateGraph() {
  return (
    <div
      className="w-full h-32 rounded-md flex items-center justify-center border"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border)',
        color: 'var(--text-muted)',
      }}
      data-testid="win-rate-graph"
    >
      <div className="text-center text-sm">
        <TrendingUp size={24} className="mx-auto mb-1" style={{ opacity: 0.4 }} />
        Win rate graph (Step 18)
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Explanation card
// ---------------------------------------------------------------------------
interface ExplanationCardProps {
  title: string
  explanation: string
  type: 'best' | 'mistake' | 'key'
  moveNumber?: number
}

function ExplanationCard({ title, explanation, type, moveNumber }: ExplanationCardProps) {
  const colorMap = {
    best: 'var(--success)',
    mistake: 'var(--danger)',
    key: 'var(--accent)',
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb size={14} style={{ color: colorMap[type] }} />
            {title}
          </CardTitle>
          {moveNumber !== undefined && <Badge variant="outline">Move {moveNumber}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {explanation}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Move navigation controls
// ---------------------------------------------------------------------------
interface MoveNavProps {
  current: number
  total: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
}

function MoveNav({ current, total, onFirst, onPrev, onNext, onLast }: MoveNavProps) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={onFirst} disabled={current === 0}>
        <ChevronFirst size={16} />
      </Button>
      <Button variant="outline" size="icon" onClick={onPrev} disabled={current === 0}>
        <ChevronLeft size={16} />
      </Button>
      <span
        className="text-sm font-mono px-2"
        style={{ color: 'var(--text-secondary)' }}
        data-testid="move-counter"
      >
        {current} / {total}
      </span>
      <Button variant="outline" size="icon" onClick={onNext} disabled={current >= total}>
        <ChevronRight size={16} />
      </Button>
      <Button variant="outline" size="icon" onClick={onLast} disabled={current >= total}>
        <ChevronLast size={16} />
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnalysisScreen
// ---------------------------------------------------------------------------

const MOCK_EXPLANATIONS: ExplanationCardProps[] = [
  {
    type: 'best',
    title: 'Your Best Move',
    explanation:
      'Move 23 at E5 was excellent — it connected your groups while threatening a large capture. KataGo rates this as the top choice.',
    moveNumber: 23,
  },
  {
    type: 'mistake',
    title: 'Biggest Mistake',
    explanation:
      'Move 31 at F3 allowed White to cut your stones. Playing at G4 instead would have kept your group connected and saved 8 points.',
    moveNumber: 31,
  },
  {
    type: 'key',
    title: 'Key Moment',
    explanation:
      'The game turned at move 41 when White played at D7. At this point the win rate shifted from 62% to 38% in your favor.',
    moveNumber: 41,
  },
]

export function AnalysisScreen() {
  const { id } = useParams<{ id: string }>()
  const moveHistory = useGameStore((s) => s.moveHistory)
  const boardSize = useGameStore((s) => s.boardSize)
  const goToMove = useGameStore((s) => s.goToMove)
  const currentMoveIndex = useGameStore((s) => s.currentMoveIndex)

  const [reviewMove, setReviewMove] = useState(currentMoveIndex)
  const totalMoves = moveHistory.length

  function handleGoToMove(n: number) {
    const clamped = Math.max(0, Math.min(n, totalMoves))
    setReviewMove(clamped)
    goToMove(clamped)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Navigation header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ChevronLeft size={16} />
              Home
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Game Analysis
            </h1>
            {id && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Game ID: {id}
              </p>
            )}
          </div>
        </div>
        <Button asChild>
          <Link to="/quick-go">Play Again</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: board + navigation */}
        <div className="space-y-4">
          <div className="flex justify-center">
            <BoardPlaceholder boardSize={boardSize} />
          </div>

          {/* Move navigation */}
          <div className="flex justify-center">
            <MoveNav
              current={reviewMove}
              total={totalMoves}
              onFirst={() => handleGoToMove(0)}
              onPrev={() => handleGoToMove(reviewMove - 1)}
              onNext={() => handleGoToMove(reviewMove + 1)}
              onLast={() => handleGoToMove(totalMoves)}
            />
          </div>

          {/* Win rate graph */}
          <WinRateGraph />
        </div>

        {/* Right: analysis tabs */}
        <div>
          <Tabs defaultValue="summary">
            <TabsList className="w-full">
              <TabsTrigger value="summary" className="flex-1">
                Summary
              </TabsTrigger>
              <TabsTrigger value="moves" className="flex-1">
                Moves
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-3 mt-3">
              {MOCK_EXPLANATIONS.map((e) => (
                <ExplanationCard key={e.type} {...e} />
              ))}
            </TabsContent>

            <TabsContent value="moves" className="mt-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Move List</CardTitle>
                  <CardDescription>
                    {totalMoves > 0 ? `${totalMoves} total moves` : 'No game data'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {totalMoves === 0 ? (
                    <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      Load a finished game to review moves.
                    </p>
                  ) : (
                    <div className="space-y-0.5 max-h-80 overflow-y-auto text-xs font-mono">
                      {moveHistory.map((move, i) => (
                        <button
                          key={move.moveNumber}
                          type="button"
                          onClick={() => handleGoToMove(i + 1)}
                          className="w-full flex items-center gap-2 px-2 py-1 rounded text-left"
                          style={{
                            backgroundColor:
                              i + 1 === reviewMove ? 'var(--bg-elevated)' : 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ color: 'var(--text-muted)', minWidth: '2rem' }}>
                            {move.moveNumber + 1}.
                          </span>
                          <span
                            className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                            style={{
                              backgroundColor:
                                move.player === 'B' ? 'var(--stone-black)' : 'var(--stone-white)',
                              border: '1px solid var(--border)',
                            }}
                          />
                          <span>{move.coordinate ?? 'Pass'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
