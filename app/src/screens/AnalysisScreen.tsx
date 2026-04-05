// =============================================================================
// screens/AnalysisScreen.tsx — Post-game analysis screen
// =============================================================================
// Shows: real Go board, win-rate graph, explanation cards, move navigation.
//
// Uses useReviewStore (NOT useGameStore) to avoid destroying active games.
// Loads saved games via load-game-adapter with Zod validation.
// =============================================================================

import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Board } from '../components/board/Board'
import { WinRateGraph } from '../components/board/WinRateGraph'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { loadGameFromStorage } from '../db/adapters/load-game-adapter'
import { useReviewStore } from '../hooks/useReviewStore'
import { useWinRateStore } from '../hooks/useWinRateStore'

// ---------------------------------------------------------------------------
// Explanation card (local component — analysis-specific)
// ---------------------------------------------------------------------------
interface AnalysisExplanationProps {
  title: string
  explanation: string
  type: 'best' | 'mistake' | 'key'
  moveNumber?: number
}

function AnalysisExplanation({ title, explanation, type, moveNumber }: AnalysisExplanationProps) {
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
// Mock explanation data (will be replaced when analysis persistence is added)
// ---------------------------------------------------------------------------

const MOCK_EXPLANATIONS: AnalysisExplanationProps[] = [
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

// ---------------------------------------------------------------------------
// AnalysisScreen
// ---------------------------------------------------------------------------

export function AnalysisScreen() {
  const { id } = useParams<{ id: string }>()

  // Review store — independent from active game
  const board = useReviewStore((s) => s.board)
  const boardSize = useReviewStore((s) => s.boardSize)
  const moveHistory = useReviewStore((s) => s.moveHistory)
  const currentMoveIndex = useReviewStore((s) => s.currentMoveIndex)
  const isLoaded = useReviewStore((s) => s.isLoaded)
  const goToMove = useReviewStore((s) => s.goToMove)
  const loadGame = useReviewStore((s) => s.loadGame)

  // Win rate data (session-only, from the game that was just played)
  const winRateHistory = useWinRateStore((s) => s.history)

  const totalMoves = moveHistory.length

  // Load saved game when navigating to /analysis/:id
  useEffect(() => {
    if (!id) return
    // Don't reload if already viewing this game
    const currentGameId = useReviewStore.getState().gameId
    if (currentGameId === id && isLoaded) return

    loadGameFromStorage(id).then((data) => {
      if (data) {
        loadGame(id, data.moves, data.config.boardSize)
      }
    })
  }, [id, isLoaded, loadGame])

  // Find last move index for marker
  const lastMove = currentMoveIndex > 0 ? moveHistory[currentMoveIndex - 1] : undefined
  const lastMoveIndex = lastMove?.index ?? null

  function handleGoToMove(n: number) {
    const clamped = Math.max(0, Math.min(n, totalMoves))
    goToMove(clamped)
  }

  return (
    <div className="mx-auto px-4 py-6 space-y-6" style={{ maxWidth: 'min(100%, 1400px)' }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(280px,360px)] gap-6">
        {/* Left: board + navigation + win rate */}
        <div className="space-y-4">
          {/* Real Board — interactive=false for review mode */}
          <div className="flex justify-center">
            <div
              style={{
                width: '100%',
                maxWidth: 'min(100%, calc(100vh - 300px))',
                aspectRatio: '1',
              }}
            >
              <Board
                boardSize={boardSize}
                board={board}
                {...(lastMoveIndex != null ? { lastMoveIndex } : {})}
                interactive={false}
                showCoordinates={true}
              />
            </div>
          </div>

          {/* Move navigation */}
          <div className="flex justify-center">
            <MoveNav
              current={currentMoveIndex}
              total={totalMoves}
              onFirst={() => handleGoToMove(0)}
              onPrev={() => handleGoToMove(currentMoveIndex - 1)}
              onNext={() => handleGoToMove(currentMoveIndex + 1)}
              onLast={() => handleGoToMove(totalMoves)}
            />
          </div>

          {/* Win rate graph — shows session data if available */}
          {winRateHistory.length > 0 ? (
            <WinRateGraph data={winRateHistory} height={120} currentMove={currentMoveIndex} />
          ) : (
            <div
              className="w-full h-24 rounded-md flex items-center justify-center border"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
              data-testid="win-rate-graph-empty-placeholder"
            >
              <span className="text-xs">No win rate data for this game</span>
            </div>
          )}
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
                <AnalysisExplanation key={e.type} {...e} />
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
                      {isLoaded
                        ? 'This game has no moves.'
                        : 'Load a finished game to review moves.'}
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
                              i + 1 === currentMoveIndex ? 'var(--bg-elevated)' : 'transparent',
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
