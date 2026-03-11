// =============================================================================
// TimerDisplay — Countdown timer display (main time + byoyomi)
// =============================================================================

import type { TimerDisplayProps } from './types'

/**
 * Format seconds to MM:SS display string.
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60)
  const secs = Math.floor(Math.max(0, seconds) % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * Renders a timer display with main time and byoyomi information.
 * Shows visual urgency when time is running low.
 */
export function TimerDisplay({ playerTimer, isActive, playerColor }: TimerDisplayProps) {
  const { mainTimeRemaining, byoyomiPeriodsRemaining, byoyomiTimeRemaining, inByoyomi } =
    playerTimer

  const timeToShow = inByoyomi ? byoyomiTimeRemaining : mainTimeRemaining
  const isUrgent = isActive && timeToShow <= 10
  const isCritical = isActive && timeToShow <= 5

  const labelColor = playerColor === 'B' ? '#111' : '#666'
  const bgColor = isCritical ? '#ffcdd2' : isUrgent ? '#fff9c4' : isActive ? '#e8f5e9' : '#f5f5f5'
  const timeColor = isCritical ? '#c62828' : isUrgent ? '#f57f17' : '#333'

  return (
    <div
      data-testid={`timer-${playerColor}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 16px',
        borderRadius: '8px',
        backgroundColor: bgColor,
        border: isActive ? '2px solid #4CAF50' : '1px solid #ddd',
        minWidth: '100px',
      }}
    >
      <span style={{ fontSize: '11px', color: labelColor, fontWeight: 600 }}>
        {playerColor === 'B' ? 'Black' : 'White'}
      </span>
      <span
        style={{
          fontSize: '24px',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: timeColor,
        }}
        data-testid={`timer-time-${playerColor}`}
      >
        {formatTime(timeToShow)}
      </span>
      {inByoyomi && (
        <span
          style={{ fontSize: '10px', color: '#666' }}
          data-testid={`timer-byoyomi-${playerColor}`}
        >
          BY {byoyomiPeriodsRemaining}x {formatTime(byoyomiTimeRemaining)}
        </span>
      )}
    </div>
  )
}
