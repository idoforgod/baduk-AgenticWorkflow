// =============================================================================
// ExplanationCard — Card displaying AI explanation text with 3-tier toggle
// =============================================================================

import type { Tier } from '@core/interfaces'
import { type ExplanationCardProps, KATRAIN_COLORS } from './types'

const TIER_LABELS: Record<Tier, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const TIERS: readonly Tier[] = ['beginner', 'intermediate', 'advanced']

/**
 * Get color for move quality badge.
 */
function getQualityColor(quality: string | null): string {
  switch (quality) {
    case 'brilliant':
    case 'excellent':
    case 'good':
      return KATRAIN_COLORS.green
    case 'acceptable':
      return KATRAIN_COLORS.blue
    case 'inaccuracy':
      return KATRAIN_COLORS.yellow
    case 'mistake':
      return KATRAIN_COLORS.orange
    case 'blunder':
      return KATRAIN_COLORS.red
    default:
      return '#999'
  }
}

/**
 * Renders an explanation card with text from the explanation engine,
 * a move quality badge, and a 3-tier toggle (beginner/intermediate/advanced).
 *
 * Designed to be placed inside a parent Card component (no own border/bg).
 * Fits within a 260px sidebar column.
 */
export function ExplanationCard({ explanation, tier, onTierChange }: ExplanationCardProps) {
  const qualityColor = getQualityColor(explanation.moveQuality)

  return (
    <div data-testid="explanation-card">
      {/* Tier toggle — wrap to prevent overflow in narrow columns */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          marginBottom: '8px',
        }}
        data-testid="tier-toggle"
      >
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTierChange(t)}
            data-testid={`tier-${t}`}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: t === tier ? 700 : 400,
              border:
                t === tier ? '1px solid var(--accent, #2196F3)' : '1px solid var(--border, #ddd)',
              borderRadius: '4px',
              backgroundColor: t === tier ? 'rgba(33, 150, 243, 0.15)' : 'transparent',
              color: t === tier ? 'var(--accent, #1565c0)' : 'var(--text-muted, #666)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {TIER_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Move quality badge */}
      {explanation.moveQuality !== null && (
        <div
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: qualityColor,
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            marginBottom: '8px',
            textTransform: 'capitalize',
          }}
          data-testid="move-quality-badge"
        >
          {explanation.moveQuality}
        </div>
      )}

      {/* Explanation text */}
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          lineHeight: 1.5,
          color: 'var(--text-secondary, #333)',
          wordBreak: 'break-word',
        }}
        data-testid="explanation-text"
      >
        {explanation.text}
      </p>

      {/* Category label */}
      <div
        style={{
          marginTop: '6px',
          fontSize: '10px',
          color: 'var(--text-muted, #999)',
          textTransform: 'capitalize',
        }}
        data-testid="explanation-category"
      >
        {explanation.category.replace('_', ' ')}
      </div>
    </div>
  )
}
