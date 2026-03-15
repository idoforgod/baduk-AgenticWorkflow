// =============================================================================
// components/dashboard/LastGameHighlights.tsx — Key moments from last game
// =============================================================================
// Shows up to 3 highlight cards from the most recent game's win rate data.
// Data is session-only (from useWinRateStore.lastGameHistory).
// =============================================================================

import { AlertTriangle, Star, TrendingUp } from 'lucide-react'
import { extractHighlights, type Highlight, type WinRatePoint } from '../../utils/extractHighlights'

interface LastGameHighlightsProps {
  lastGameHistory: readonly WinRatePoint[]
}

const ICON_MAP = {
  turning_point: <TrendingUp size={14} style={{ color: 'var(--accent)' }} />,
  critical_mistake: <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />,
  best_sequence: <Star size={14} style={{ color: 'var(--success)' }} />,
}

const LABEL_MAP = {
  turning_point: 'Turning Point',
  critical_mistake: 'Critical Mistake',
  best_sequence: 'Best Sequence',
}

function HighlightCard({ highlight }: { highlight: Highlight }) {
  return (
    <div
      className="flex gap-3 items-start p-3 rounded-lg border"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="mt-0.5 flex-shrink-0">{ICON_MAP[highlight.type]}</div>
      <div className="min-w-0">
        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {LABEL_MAP[highlight.type]}
        </div>
        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Move {highlight.moveNumber}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {highlight.winRateChange > 0 ? '+' : ''}
          {highlight.winRateChange}% win rate
        </div>
      </div>
    </div>
  )
}

export function LastGameHighlights({ lastGameHistory }: LastGameHighlightsProps) {
  if (lastGameHistory.length < 2) return null

  const highlights = extractHighlights(lastGameHistory)
  if (highlights.length === 0) return null

  return (
    <section aria-labelledby="highlights-heading">
      <h2
        id="highlights-heading"
        className="text-sm font-medium mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Last Game Highlights
        <span
          className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          This session
        </span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {highlights.map((h) => (
          <HighlightCard key={`${h.type}-${h.moveNumber}`} highlight={h} />
        ))}
      </div>
    </section>
  )
}
