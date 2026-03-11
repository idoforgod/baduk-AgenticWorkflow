// =============================================================================
// screens/QuickGoScreen.tsx — Quick game setup screen
// =============================================================================
// One-tap start: board size, difficulty preset, time control.
// Navigates to /game on start.
// =============================================================================

import type { BoardSize } from '@core/interfaces'
import { Clock, Cpu, Grid3X3, Zap } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, cn } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { useGameStore } from '../game-engine/store'

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------
type DifficultyPreset = 'beginner' | 'intermediate' | 'advanced'
type TimePreset = 'blitz' | 'standard' | 'relaxed'

interface DifficultyConfig {
  preset: DifficultyPreset
  label: string
  description: string
  aiLevel: number
  color: string
}

interface TimeConfig {
  preset: TimePreset
  label: string
  description: string
  mainTime: number
  byoyomiTime: number
}

// ---------------------------------------------------------------------------
// Configuration data
// ---------------------------------------------------------------------------
const DIFFICULTY_CONFIGS: DifficultyConfig[] = [
  {
    preset: 'beginner',
    label: 'Beginner',
    description: 'Learning the game. AI plays slowly with mistakes.',
    aiLevel: 5,
    color: 'var(--success)',
  },
  {
    preset: 'intermediate',
    label: 'Intermediate',
    description: 'Comfortable with basic tactics and strategy.',
    aiLevel: 15,
    color: 'var(--warning)',
  },
  {
    preset: 'advanced',
    label: 'Advanced',
    description: 'Strong club player. AI plays near-optimally.',
    aiLevel: 25,
    color: 'var(--danger)',
  },
]

const TIME_CONFIGS: TimeConfig[] = [
  {
    preset: 'blitz',
    label: 'Blitz',
    description: '1 min + 5 sec byoyomi',
    mainTime: 60,
    byoyomiTime: 5,
  },
  {
    preset: 'standard',
    label: 'Standard',
    description: '3 min + 10 sec byoyomi',
    mainTime: 180,
    byoyomiTime: 10,
  },
  {
    preset: 'relaxed',
    label: 'Relaxed',
    description: '10 min + 30 sec byoyomi',
    mainTime: 600,
    byoyomiTime: 30,
  },
]

const BOARD_SIZES: { size: BoardSize; label: string; description: string }[] = [
  { size: 9, label: '9x9', description: 'Quick, ~30 moves' },
  { size: 13, label: '13x13', description: 'Medium, ~60 moves' },
  { size: 19, label: '19x19', description: 'Full game, ~200 moves' },
]

// ---------------------------------------------------------------------------
// Selection card
// ---------------------------------------------------------------------------
interface SelectionCardProps<T> {
  value: T
  selected: boolean
  onSelect: (v: T) => void
  title: string
  description: string
  badge?: string
  badgeColor?: string
  icon?: React.ReactNode
}

function SelectionCard<T>({
  value,
  selected,
  onSelect,
  title,
  description,
  badge,
  badgeColor,
  icon,
}: SelectionCardProps<T>) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'
      )}
      style={{
        backgroundColor: selected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        cursor: 'pointer',
      }}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && (
            <div style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }}>{icon}</div>
          )}
          <div>
            <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              {title}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </div>
          </div>
        </div>
        {badge && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: `color-mix(in srgb, ${badgeColor ?? 'var(--accent)'} 15%, transparent)`,
              color: badgeColor ?? 'var(--accent)',
            }}
          >
            {badge}
          </span>
        )}
        {selected && (
          <div
            className="w-4 h-4 rounded-full ml-2 flex-shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
            aria-hidden
          />
        )}
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// QuickGoScreen
// ---------------------------------------------------------------------------

export function QuickGoScreen() {
  const navigate = useNavigate()
  const [boardSize, setBoardSize] = useState<BoardSize>(9)
  const [difficulty, setDifficulty] = useState<DifficultyPreset>('beginner')
  const [timePreset, setTimePreset] = useState<TimePreset>('standard')

  const createGame = useGameStore((s) => s.createGame)

  function handleStart() {
    createGame(boardSize, boardSize === 9 ? 5.5 : 7.5, {
      boardSize,
      komi: boardSize === 9 ? 5.5 : 7.5,
      rules: 'tromp-taylor',
      mode: 'vs-ai',
    })
    navigate('/game')
  }

  const selectedDiff = DIFFICULTY_CONFIGS.find((d) => d.preset === difficulty)
  const selectedTime = TIME_CONFIGS.find((t) => t.preset === timePreset)

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="text-center space-y-2">
        <h1
          className="text-3xl font-bold flex items-center justify-center gap-2"
          style={{ color: 'var(--text-primary)' }}
        >
          <Zap size={28} style={{ color: 'var(--accent)' }} />
          Quick Go
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Configure your game and start playing in one tap.
        </p>
      </div>

      {/* Board size selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3X3 size={16} />
            Board Size
          </CardTitle>
          <CardDescription>9x9 is ideal for a quick lunch break game.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {BOARD_SIZES.map((b) => (
            <SelectionCard
              key={String(b.size)}
              value={b.size}
              selected={boardSize === b.size}
              onSelect={(v: BoardSize) => setBoardSize(v)}
              title={b.label}
              description={b.description}
              badge={b.size === 9 ? 'Recommended' : undefined}
              badgeColor="var(--accent)"
            />
          ))}
        </CardContent>
      </Card>

      {/* Difficulty preset */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu size={16} />
            AI Difficulty
          </CardTitle>
          <CardDescription>
            Uses KataGo 30-level system. Exact level adjustable in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {DIFFICULTY_CONFIGS.map((d) => (
            <SelectionCard
              key={d.preset}
              value={d.preset}
              selected={difficulty === d.preset}
              onSelect={(v: DifficultyPreset) => setDifficulty(v)}
              title={d.label}
              description={d.description}
              badge={`Level ${d.aiLevel}`}
              badgeColor={d.color}
            />
          ))}
        </CardContent>
      </Card>

      {/* Time control */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock size={16} />
            Time Control
          </CardTitle>
          <CardDescription>Standard (3 min + byoyomi) is the Quick Go default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {TIME_CONFIGS.map((t) => (
            <SelectionCard
              key={t.preset}
              value={t.preset}
              selected={timePreset === t.preset}
              onSelect={(v: TimePreset) => setTimePreset(v)}
              title={t.label}
              description={t.description}
              badge={t.preset === 'standard' ? 'Quick Go' : undefined}
              badgeColor="var(--accent)"
            />
          ))}
        </CardContent>
      </Card>

      {/* Game summary + start button */}
      <div
        className="p-4 rounded-lg border space-y-3"
        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {boardSize}x{boardSize}
          </span>{' '}
          vs{' '}
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {selectedDiff?.label ?? ''} AI
          </span>{' '}
          — {selectedTime?.description ?? ''}
        </div>

        <Button
          size="lg"
          className="w-full text-base"
          onClick={handleStart}
          data-testid="start-game-button"
        >
          <Zap size={20} />
          Start Game
        </Button>
      </div>
    </div>
  )
}
