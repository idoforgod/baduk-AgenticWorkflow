// =============================================================================
// MoveNavigator — Navigation controls (first, prev, next, last, auto-play)
// =============================================================================

import type { MoveNavigatorProps } from './types'

/**
 * Renders navigation controls for reviewing game moves.
 */
export function MoveNavigator({
  currentMove,
  totalMoves,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onAutoPlay,
  isAutoPlaying = false,
}: MoveNavigatorProps) {
  const atStart = currentMove <= 0
  const atEnd = currentMove >= totalMoves

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: disabled ? '#f0f0f0' : '#fff',
    color: disabled ? '#bbb' : '#333',
    cursor: disabled ? 'not-allowed' : 'pointer',
    lineHeight: 1,
  })

  return (
    <div
      data-testid="move-navigator"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <button
        type="button"
        onClick={onFirst}
        disabled={atStart}
        style={buttonStyle(atStart)}
        data-testid="nav-first"
        aria-label="First move"
      >
        &#x23EE;
      </button>
      <button
        type="button"
        onClick={onPrev}
        disabled={atStart}
        style={buttonStyle(atStart)}
        data-testid="nav-prev"
        aria-label="Previous move"
      >
        &#x23F4;
      </button>
      <span
        style={{
          padding: '0 8px',
          fontSize: '13px',
          fontVariantNumeric: 'tabular-nums',
          minWidth: '50px',
          textAlign: 'center',
        }}
        data-testid="nav-move-display"
      >
        {currentMove} / {totalMoves}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={atEnd}
        style={buttonStyle(atEnd)}
        data-testid="nav-next"
        aria-label="Next move"
      >
        &#x23F5;
      </button>
      <button
        type="button"
        onClick={onLast}
        disabled={atEnd}
        style={buttonStyle(atEnd)}
        data-testid="nav-last"
        aria-label="Last move"
      >
        &#x23ED;
      </button>
      {onAutoPlay !== undefined && (
        <button
          type="button"
          onClick={onAutoPlay}
          style={{
            ...buttonStyle(false),
            backgroundColor: isAutoPlaying ? '#e3f2fd' : '#fff',
            borderColor: isAutoPlaying ? '#2196F3' : '#ccc',
          }}
          data-testid="nav-autoplay"
          aria-label={isAutoPlaying ? 'Stop auto-play' : 'Start auto-play'}
        >
          {isAutoPlaying ? '\u23F8' : '\u23F5'}
        </button>
      )}
    </div>
  )
}
