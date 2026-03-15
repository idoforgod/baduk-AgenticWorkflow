// =============================================================================
// hooks/useSoundEffect.ts — Game sound effect integration
// =============================================================================
// Subscribes to useGameStore state changes and plays appropriate sounds.
// Reads soundEnabled setting from Tauri storage on mount.
//
// Sound triggers:
//   - Move count increases → stone placement sound
//   - Capture count increases → capture sound (after placement)
//   - Pass detected (move with null coordinate) → pass sound
//   - Status becomes 'finished' → game end chime
//
// Layer: Application hook
// Depends on: game-engine/store, utils/soundEffects
// =============================================================================

import { useEffect, useRef } from 'react'
import { useGameStore } from '../game-engine/store'
import { playCapture, playGameEnd, playPass, playStonePlacement } from '../utils/soundEffects'

/**
 * Hook that plays sound effects in response to game state changes.
 * Must be mounted in a component that lives during gameplay (e.g. GameScreen).
 *
 * @param enabled - Whether sound is enabled (from settings)
 */
export function useSoundEffect(enabled: boolean): void {
  const prevMoveCountRef = useRef<number>(0)
  const prevCapturesRef = useRef<{ black: number; white: number }>({ black: 0, white: 0 })
  const prevStatusRef = useRef<string>('not_started')

  useEffect(() => {
    if (!enabled) return

    // Subscribe to store changes
    const unsub = useGameStore.subscribe((state, prevState) => {
      const moveCount = state.moveHistory.length
      const prevMoveCount = prevState.moveHistory.length

      // New move detected
      if (moveCount > prevMoveCount) {
        const lastMove = state.moveHistory[moveCount - 1]

        if (lastMove && lastMove.coordinate === null) {
          // Pass move
          playPass()
        } else {
          // Stone placement
          playStonePlacement()

          // Check for captures (delayed slightly so sounds don't overlap)
          const totalCaptures = state.captures.black + state.captures.white
          const prevTotalCaptures = prevState.captures.black + prevState.captures.white
          if (totalCaptures > prevTotalCaptures) {
            setTimeout(playCapture, 80)
          }
        }
      }

      // Game ended
      if (state.status === 'finished' && prevState.status !== 'finished') {
        setTimeout(playGameEnd, 200)
      }
    })

    return unsub
  }, [enabled])

  // Sync refs on mount for initial state
  useEffect(() => {
    const state = useGameStore.getState()
    prevMoveCountRef.current = state.moveHistory.length
    prevCapturesRef.current = { ...state.captures }
    prevStatusRef.current = state.status
  }, [])
}
