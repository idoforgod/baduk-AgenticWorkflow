// =============================================================================
// KomiDisplay — Show komi value
// =============================================================================

import type { KomiDisplayProps } from './types'

/**
 * Displays the komi value for the current game.
 */
export function KomiDisplay({ komi }: KomiDisplayProps) {
  return (
    <div
      data-testid="komi-display"
      style={{
        fontSize: '13px',
        color: '#666',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <span style={{ fontWeight: 600 }}>Komi:</span>
      <span data-testid="komi-value">{komi}</span>
    </div>
  )
}
