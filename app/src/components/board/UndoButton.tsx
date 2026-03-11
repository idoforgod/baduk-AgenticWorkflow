// =============================================================================
// UndoButton — Undo last move button
// =============================================================================

import type { UndoButtonProps } from './types'

/**
 * Button for undoing the last move.
 */
export function UndoButton({ onClick, disabled = false }: UndoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="undo-button"
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
      Undo
    </button>
  )
}
