// =============================================================================
// CaptureCounter — Show captured stones count for each player
// =============================================================================

import type { CaptureCounterProps } from './types'

/**
 * Displays captured stones count for both players.
 */
export function CaptureCounter({ blackCaptures, whiteCaptures }: CaptureCounterProps) {
  return (
    <div
      data-testid="capture-counter"
      style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        fontSize: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#222',
          }}
        />
        <span data-testid="captures-black" style={{ fontWeight: 600 }}>
          {blackCaptures}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#eee',
            border: '1px solid #999',
          }}
        />
        <span data-testid="captures-white" style={{ fontWeight: 600 }}>
          {whiteCaptures}
        </span>
      </div>
    </div>
  )
}
