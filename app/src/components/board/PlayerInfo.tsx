// =============================================================================
// PlayerInfo — Player name, color, rank display
// =============================================================================

import type { PlayerInfoProps } from './types'

/**
 * Displays player information: name, color indicator, rank, and turn status.
 */
export function PlayerInfo({ name, color, rank, isCurrentTurn }: PlayerInfoProps) {
  const stoneColor = color === 'B' ? '#222' : '#eee'
  const stoneBorder = color === 'B' ? 'none' : '1px solid #999'

  return (
    <div
      data-testid={`player-info-${color}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '6px',
        backgroundColor: isCurrentTurn ? '#e3f2fd' : 'transparent',
        border: isCurrentTurn ? '2px solid #2196F3' : '1px solid transparent',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: stoneColor,
          border: stoneBorder,
          flexShrink: 0,
        }}
        data-testid={`player-stone-${color}`}
      />
      <span style={{ fontWeight: 600, fontSize: '14px' }} data-testid={`player-name-${color}`}>
        {name}
      </span>
      {rank !== undefined && (
        <span style={{ fontSize: '12px', color: '#888' }} data-testid={`player-rank-${color}`}>
          {rank}
        </span>
      )}
    </div>
  )
}
