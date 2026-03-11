// =============================================================================
// ResignButton — "Resign" action button
// =============================================================================

import type { ResignButtonProps } from './types'

/**
 * Button for resigning the current game.
 */
export function ResignButton({ onClick, disabled = false }: ResignButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="resign-button"
      style={{
        padding: '8px 20px',
        fontSize: '14px',
        fontWeight: 600,
        border: '1px solid #e57373',
        borderRadius: '6px',
        backgroundColor: disabled ? '#f0f0f0' : '#ffebee',
        color: disabled ? '#999' : '#c62828',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Resign
    </button>
  )
}
