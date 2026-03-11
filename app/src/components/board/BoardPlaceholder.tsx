// =============================================================================
// components/board/BoardPlaceholder.tsx — Board placeholder for Step 17 integration
// =============================================================================
// The actual Board component will be implemented in src/board-ui/ (Step 17).
// Screens import this placeholder. When Step 17 is ready, swap the import.
// =============================================================================

import type { BoardSize } from '@core/interfaces'

export interface BoardPlaceholderProps {
  boardSize?: BoardSize
  className?: string
  /** Called when a board intersection is clicked (index = row * size + col) */
  onIntersectionClick?: (index: number) => void
}

export function BoardPlaceholder({ boardSize = 9, className = '' }: BoardPlaceholderProps) {
  const cellCount = boardSize * boardSize
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
    width: '100%',
    maxWidth: '400px',
    aspectRatio: '1',
    backgroundColor: 'var(--board-color)',
    border: '2px solid var(--board-line)',
    borderRadius: '4px',
    gap: '1px',
    padding: '8px',
  }

  return (
    <div data-testid="board-placeholder" className={className} style={gridStyle}>
      {Array.from({ length: cellCount }, (_, cellIdx) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: grid cells have no unique ID
          key={`cell-${cellIdx}`}
          style={{
            aspectRatio: '1',
            backgroundColor: 'transparent',
            border: '0.5px solid var(--board-line)',
          }}
        />
      ))}
    </div>
  )
}
