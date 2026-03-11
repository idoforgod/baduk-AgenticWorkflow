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
 */
export function ExplanationCard({ explanation, tier, onTierChange }: ExplanationCardProps) {
  const qualityColor = getQualityColor(explanation.moveQuality)

  return (
    <div
      data-testid="explanation-card"
      style={{
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '12px 16px',
        backgroundColor: '#fafafa',
        maxWidth: '400px',
      }}
    >
      {/* Tier toggle */}
      <div
        style={{
          display: 'flex',
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
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: t === tier ? 700 : 400,
              border: t === tier ? '1px solid #2196F3' : '1px solid #ddd',
              borderRadius: '4px',
              backgroundColor: t === tier ? '#e3f2fd' : '#fff',
              color: t === tier ? '#1565c0' : '#666',
              cursor: 'pointer',
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
          fontSize: '13px',
          lineHeight: 1.5,
          color: '#333',
        }}
        data-testid="explanation-text"
      >
        {explanation.text}
      </p>

      {/* Category label */}
      <div
        style={{
          marginTop: '8px',
          fontSize: '10px',
          color: '#999',
          textTransform: 'capitalize',
        }}
        data-testid="explanation-category"
      >
        {explanation.category.replace('_', ' ')}
      </div>
    </div>
  )
}
