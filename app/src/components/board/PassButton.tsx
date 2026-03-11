// =============================================================================
// PassButton — "Pass" action button
// =============================================================================

import type { PassButtonProps } from './types'

/**
 * Button for passing the current turn.
 */
export function PassButton({ onClick, disabled = false }: PassButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="pass-button"
      style={{
        padding: '8px 20px',
        fontSize: '14px',
        fontWeight: 600,
        border: '1px solid #ccc',
        borderRadius: '6px',
        backgroundColor: disabled ? '#f0f0f0' : '#ffffff',
        color: disabled ? '#999' : '#333',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      Pass
    </button>
  )
}
