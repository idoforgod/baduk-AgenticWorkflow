// =============================================================================
// screens/GameScreen.tsx — Main gameplay screen
// =============================================================================
// Shows: board, player info, timer, capture counts, game controls, move list.
// Integrates with useGameStore; board is a placeholder until Step 17.
// =============================================================================

import { ChevronLeft, Flag, RotateCcw, SkipForward } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Board } from '../components/board/Board'
import { CoachPanel } from '../components/board/CoachPanel'
import { ExplanationCard } from '../components/board/ExplanationCard'
import { WinRateGraph } from '../components/board/WinRateGraph'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { SettingsRepository } from '../db/repositories/settings-repository'
import { useGameStore } from '../game-engine/store'
import { useAiOpponent } from '../hooks/useAiOpponent'
import { useCoaching } from '../hooks/useCoaching'
import { useExplanation } from '../hooks/useExplanation'
import { useKataGoInit } from '../hooks/useKataGo'
import { useKataGoAnalysis } from '../hooks/useKataGoAnalysis'
import { useSoundEffect } from '../hooks/useSoundEffect'
import { useWinRateStore } from '../hooks/useWinRateStore'

// ---------------------------------------------------------------------------
// Player info panel
// ---------------------------------------------------------------------------
interface PlayerInfoProps {
  color: 'B' | 'W'
  name: string
  captures: number
  isActive: boolean
  timeLeft?: string
}

function PlayerInfo({ color, name, captures, isActive, timeLeft }: PlayerInfoProps) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg border transition-colors"
      style={{
        borderColor: isActive ? 'var(--accent)' : 'var(--border)',
        backgroundColor: isActive ? 'var(--bg-elevated)' : 'var(--bg-surface)',
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-full border-2 flex-shrink-0"
          role="img"
          style={{
            backgroundColor: color === 'B' ? 'var(--stone-black)' : 'var(--stone-white)',
            borderColor: color === 'B' ? '#555' : '#aaa',
          }}
          aria-label={`${color === 'B' ? 'Black' : 'White'} stone`}
        />
        <div>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {name}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Captures: {captures}
          </div>
        </div>
      </div>

      <div className="text-right">
        {isActive && (
          <Badge variant="default" className="mb-1">
            To play
          </Badge>
        )}
        {timeLeft && (
          <div
            className="text-sm font-mono font-bold"
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            {timeLeft}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Move list panel
// ---------------------------------------------------------------------------
function MoveList() {
  const moveHistory = useGameStore((s) => s.moveHistory)
  const currentMoveIndex = useGameStore((s) => s.currentMoveIndex)

  if (moveHistory.length === 0) {
    return (
      <div className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>
        No moves yet
      </div>
    )
  }

  return (
    <div className="space-y-0.5 max-h-60 overflow-y-auto text-xs font-mono">
      {moveHistory.map((move, i) => (
        <div
          key={move.moveNumber}
          className="flex items-center gap-2 px-2 py-1 rounded"
          style={{
            backgroundColor: i === currentMoveIndex - 1 ? 'var(--bg-elevated)' : 'transparent',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', minWidth: '2rem' }}>
            {move.moveNumber + 1}.
          </span>
          <span
            className="w-3 h-3 rounded-full inline-block flex-shrink-0"
            style={{
              backgroundColor: move.player === 'B' ? 'var(--stone-black)' : 'var(--stone-white)',
              border: '1px solid var(--border)',
            }}
          />
          <span>{move.coordinate ?? 'Pass'}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GameScreen
// ---------------------------------------------------------------------------

export function GameScreen() {
  const { id } = useParams<{ id?: string }>()
  const status = useGameStore((s) => s.status)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const board = useGameStore((s) => s.board)
  const captures = useGameStore((s) => s.captures)
  const boardSize = useGameStore((s) => s.boardSize)
  const playMove = useGameStore((s) => s.playMove)
  const pass = useGameStore((s) => s.pass)
  const resign = useGameStore((s) => s.resign)
  const undo = useGameStore((s) => s.undo)
  const result = useGameStore((s) => s.result)
  const gameId = useGameStore((s) => s.gameId)
  const moveHistory = useGameStore((s) => s.moveHistory)

  const lastMoveIndex = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1].index : null

  // Sound effects — read setting from storage once on mount
  const [soundEnabled, setSoundEnabled] = useState(true)
  useEffect(() => {
    const repo = new SettingsRepository()
    repo.getSettingWithDefault('soundEnabled', true).then((r) => {
      if (r.ok) setSoundEnabled(r.value as boolean)
    })
  }, [])
  useSoundEffect(soundEnabled)

  // KataGo lifecycle: initialize on first game, shutdown on unmount
  const { kataGoState: initState, kataGoError: initError } = useKataGoInit()

  // AI auto-play: when it's White's turn, AI plays after 400ms
  useAiOpponent()

  // KataGo analysis: show top 5 candidate moves (routes through validated pipeline)
  // P0 fix: pass serviceReady so the analysis trigger reacts to init completion
  const serviceReady = initState === 'ready'
  const { candidates, isAnalyzing, error: analysisError } = useKataGoAnalysis(serviceReady)

  // Merge lifecycle state with analysis state for UI display
  const kataGoState = isAnalyzing ? 'analyzing' : initState
  const kataGoError = initError ?? analysisError

  // Coaching messages from AI coach
  const { messages: coachingMessages } = useCoaching()

  // Move explanation (3-tier: beginner/intermediate/advanced)
  const { explanation, tier, onTierChange } = useExplanation()

  // Win rate history from shared store (fed by both useKataGoAnalysis and useAiOpponent)
  const winRateHistory = useWinRateStore((s) => s.history)
  const currentWinRate = useWinRateStore((s) => s.currentWinRate)

  const isPlaying = status === 'playing'
  const isFinished = status === 'finished'
  const [isSaving, setIsSaving] = useState(false)
  const [_saveDone, setSaveDone] = useState(false)
  const saveAttemptedRef = useRef(false)

  const saveGame = useGameStore((s) => s.saveGame)

  // Auto-save when game finishes (resolves N6: race condition)
  useEffect(() => {
    if (status !== 'finished' || !gameId || saveAttemptedRef.current) return
    saveAttemptedRef.current = true

    // Archive win rate data for Last Game Highlights (session-only)
    useWinRateStore.getState().archiveCurrentGame()

    setIsSaving(true)
    saveGame().then((res) => {
      setIsSaving(false)
      setSaveDone(res.success)
    })
  }, [status, gameId, saveGame])

  // Reset save state when a new game starts
  useEffect(() => {
    if (status === 'playing') {
      saveAttemptedRef.current = false
      setSaveDone(false)
      setIsSaving(false)
    }
  }, [status])

  const displayGameId = id ?? gameId

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Back navigation */}
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ChevronLeft size={16} />
            Back to Home
          </Link>
        </Button>
      </div>

      {/* Game result banner */}
      {isFinished && result && (
        <div
          className="mb-4 p-4 rounded-lg text-center font-semibold"
          style={{
            backgroundColor:
              result.winner === 'B' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${result.winner === 'B' ? 'var(--success)' : 'var(--danger)'}`,
            color: 'var(--text-primary)',
          }}
          data-testid="game-result-banner"
        >
          Game over — {result.resultString}
          {displayGameId && (
            <div className="mt-2">
              {isSaving ? (
                <Button size="sm" disabled>
                  Saving...
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link to={`/analysis/${displayGameId}`}>View Analysis</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_260px] gap-4">
        {/* Left column: AI Coach + AI Analysis */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* AI Coach Panel — coaching messages */}
          {isPlaying && <CoachPanel messages={coachingMessages} />}

          {/* Move Explanation — 3-tier (beginner/intermediate/advanced) */}
          {isPlaying && explanation && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Move Explanation</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ExplanationCard
                  explanation={explanation}
                  tier={tier}
                  onTierChange={onTierChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Policy Network — AI Candidate Moves */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>AI Analysis</span>
                <Badge
                  variant={
                    kataGoState === 'ready'
                      ? 'success'
                      : kataGoState === 'analyzing'
                        ? 'default'
                        : kataGoState === 'failed'
                          ? 'destructive'
                          : 'secondary'
                  }
                >
                  {kataGoState === 'ready'
                    ? 'KataGo Ready'
                    : kataGoState === 'analyzing'
                      ? 'Analyzing...'
                      : kataGoState === 'initializing'
                        ? 'Starting...'
                        : kataGoState === 'failed'
                          ? 'Offline'
                          : 'Idle'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {kataGoState === 'failed' && (
                <div className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                  KataGo 연결 실패. 기본 AI로 대국 중.
                  {kataGoError && (
                    <div className="mt-1 text-[10px] break-all" style={{ color: 'var(--danger)' }}>
                      {kataGoError.slice(0, 120)}
                    </div>
                  )}
                </div>
              )}
              {candidates.length > 0 ? (
                <div className="space-y-1.5">
                  {candidates.map((c, i) => (
                    <div
                      key={c.move}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                      style={{
                        backgroundColor: i === 0 ? 'rgba(34,197,94,0.1)' : 'transparent',
                        border: i === 0 ? '1px solid var(--success)' : '1px solid transparent',
                      }}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{
                          backgroundColor: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'][
                            i
                          ],
                          color: 'white',
                        }}
                      >
                        {i + 1}
                      </span>
                      <span
                        className="font-mono font-medium w-7"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {c.move}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--text-secondary)' }}>Win {c.winRate}%</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {c.scoreLead > 0 ? '+' : ''}
                            {c.scoreLead}
                          </span>
                        </div>
                        {/* Win rate bar */}
                        <div
                          className="h-1 rounded-full mt-0.5"
                          style={{ backgroundColor: 'var(--bg-elevated)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(c.winRate, 100)}%`,
                              backgroundColor: [
                                '#22c55e',
                                '#84cc16',
                                '#eab308',
                                '#f97316',
                                '#ef4444',
                              ][i],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>
                  {kataGoState === 'analyzing'
                    ? 'Analyzing position...'
                    : kataGoState === 'initializing'
                      ? 'KataGo starting...'
                      : 'Play a move to see AI suggestions'}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center column: board + controls */}
        <div className="space-y-4 order-1 lg:order-2">
          {/* Player info — White (top) */}
          <PlayerInfo
            color="W"
            name="AI Opponent"
            captures={captures.white}
            isActive={isPlaying && currentPlayer === 'W'}
            timeLeft="3:00"
          />

          {/* Board */}
          <div className="flex justify-center">
            <Board
              boardSize={boardSize}
              board={board}
              onIntersectionClick={(index) => playMove(index)}
              lastMoveIndex={lastMoveIndex ?? undefined}
              previewColor={currentPlayer === 'B' ? 'black' : 'white'}
              interactive={isPlaying && currentPlayer === 'B'}
              candidates={candidates}
            />
          </div>

          {/* Player info — Black (bottom) */}
          <PlayerInfo
            color="B"
            name="You"
            captures={captures.black}
            isActive={isPlaying && currentPlayer === 'B'}
            timeLeft="3:00"
          />

          {/* Game controls */}
          {isPlaying && (
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" size="sm" onClick={() => pass()} data-testid="pass-button">
                <SkipForward size={16} />
                Pass
              </Button>

              <Button variant="outline" size="sm" onClick={() => undo()} data-testid="undo-button">
                <RotateCcw size={16} />
                Undo
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => resign(currentPlayer)}
                data-testid="resign-button"
              >
                <Flag size={16} />
                Resign
              </Button>
            </div>
          )}

          {!isPlaying && !isFinished && (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              No active game. Start a{' '}
              <Link to="/quick-go" style={{ color: 'var(--accent)' }}>
                Quick Go
              </Link>{' '}
              game.
            </div>
          )}
        </div>

        {/* Right column: Win Rate + Move History + Game Info */}
        <div className="space-y-4 order-3">
          {/* Win Rate Graph — live win rate per move */}
          {winRateHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Win Rate</span>
                  {currentWinRate !== null && (
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          currentWinRate >= 55
                            ? 'rgba(34, 197, 94, 0.15)'
                            : currentWinRate <= 45
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(59, 130, 246, 0.15)',
                        color:
                          currentWinRate >= 55
                            ? 'var(--success)'
                            : currentWinRate <= 45
                              ? 'var(--danger)'
                              : 'var(--accent)',
                      }}
                    >
                      B {currentWinRate.toFixed(1)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <WinRateGraph data={winRateHistory} height={120} currentMove={moveHistory.length} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Move History</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <MoveList />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Game Info</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Board</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {boardSize}x{boardSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Komi</span>
                <span style={{ color: 'var(--text-primary)' }}>5.5</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <Badge
                  variant={
                    status === 'playing'
                      ? 'success'
                      : status === 'finished'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
