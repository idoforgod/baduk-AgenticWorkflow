// =============================================================================
// Marker — Triangle/circle/square/number/letter markers for analysis
// =============================================================================

import type { MarkerProps } from './types'

/**
 * Renders an SVG marker at the given position.
 * Supports circle, triangle, square, number, and letter shapes.
 */
export function Marker({ cx, cy, size, shape, text, color = '#333' }: MarkerProps) {
  switch (shape) {
    case 'circle':
      return (
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.4}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          data-testid="marker-circle"
        />
      )

    case 'triangle': {
      const h = size * 0.8
      const points = [
        `${cx},${cy - h * 0.55}`,
        `${cx - h * 0.5},${cy + h * 0.35}`,
        `${cx + h * 0.5},${cy + h * 0.35}`,
      ].join(' ')
      return (
        <polygon
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          data-testid="marker-triangle"
        />
      )
    }

    case 'square':
      return (
        <rect
          x={cx - size * 0.35}
          y={cy - size * 0.35}
          width={size * 0.7}
          height={size * 0.7}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          data-testid="marker-square"
        />
      )

    case 'number':
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.6}
          fontWeight="bold"
          fill={color}
          data-testid="marker-number"
        >
          {text ?? ''}
        </text>
      )

    case 'letter':
      return (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.6}
          fontWeight="bold"
          fill={color}
          data-testid="marker-letter"
        >
          {text ?? ''}
        </text>
      )
  }
}
