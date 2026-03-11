// =============================================================================
// Stone — SVG circle for black/white stones with subtle gradient/shadow
// =============================================================================

import type { StoneProps } from './types'

/** SVG definition IDs for stone gradients */
const BLACK_GRADIENT_ID = 'stone-gradient-black'
const WHITE_GRADIENT_ID = 'stone-gradient-white'
const SHADOW_FILTER_ID = 'stone-shadow'

/**
 * SVG defs for stone rendering (gradients + shadow).
 * Include this once in the parent SVG via <StoneDefs />.
 */
export function StoneDefs() {
  return (
    <defs>
      {/* Black stone gradient — subtle 3D sheen */}
      <radialGradient id={BLACK_GRADIENT_ID} cx="35%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#5a5a5a" />
        <stop offset="50%" stopColor="#2a2a2a" />
        <stop offset="100%" stopColor="#0a0a0a" />
      </radialGradient>

      {/* White stone gradient — subtle 3D sheen */}
      <radialGradient id={WHITE_GRADIENT_ID} cx="35%" cy="35%" r="60%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#e8e8e8" />
        <stop offset="100%" stopColor="#c8c8c8" />
      </radialGradient>

      {/* Drop shadow filter */}
      <filter id={SHADOW_FILTER_ID} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3" />
      </filter>
    </defs>
  )
}

/**
 * Renders a single Go stone as an SVG circle with gradient and shadow.
 */
export function Stone({ cx, cy, r, color }: StoneProps) {
  const gradientId = color === 'black' ? BLACK_GRADIENT_ID : WHITE_GRADIENT_ID

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={`url(#${gradientId})`}
      filter={`url(#${SHADOW_FILTER_ID})`}
      stroke={color === 'white' ? '#888' : 'none'}
      strokeWidth={color === 'white' ? 0.5 : 0}
      data-testid={`stone-${color}`}
    />
  )
}
