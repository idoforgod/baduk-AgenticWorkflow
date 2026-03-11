// =============================================================================
// hooks/useKataGo.ts — Shared KataGoService singleton + initialization hook
// =============================================================================
// Provides a centralized, validated KataGo bridge that all hooks share.
//
// Why this exists:
//   Previously, useKataGoAnalysis and useAiOpponent called Tauri invoke()
//   directly with TypeScript type assertions — no runtime validation.
//   KataGoService.analyze() routes through response-parser.ts which validates
//   every field via parseAnalysisResponse(). This prevents hallucination
//   vectors where malformed KataGo responses silently produce wrong data.
//
// Pattern: Module-level singleton (same as createRulesEngine() in main.tsx)
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../game-engine/store'
import { createKatagoBridge, type KataGoService } from '../katago-bridge/katago-service'

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let _instance: KataGoService | null = null

/**
 * Get or create the shared KataGoService singleton.
 * The instance is lazily created on first access.
 */
export function getKataGoService(): KataGoService {
  if (_instance === null) {
    _instance = createKatagoBridge()
  }
  return _instance
}

/**
 * Replace the singleton (for testing only).
 */
export function setKataGoServiceForTesting(service: KataGoService): void {
  _instance = service
}

// ---------------------------------------------------------------------------
// Initialization hook
// ---------------------------------------------------------------------------

type KataGoState = 'idle' | 'initializing' | 'ready' | 'analyzing' | 'failed'

/**
 * Hook that manages KataGo lifecycle (initialize on first game, shutdown on unmount).
 * Returns the current state so UI can show status indicators.
 *
 * This hook should be called once in the GameScreen (or a parent component).
 * Other hooks (useKataGoAnalysis, useAiOpponent) use getKataGoService() directly.
 */
export function useKataGoInit() {
  const [state, setState] = useState<KataGoState>('idle')
  const [error, setError] = useState<string | null>(null)
  const initAttemptedRef = useRef(false)

  const status = useGameStore((s) => s.status)

  useEffect(() => {
    if (status !== 'playing' || initAttemptedRef.current) return
    initAttemptedRef.current = true

    const service = getKataGoService()

    async function init() {
      setState('initializing')
      try {
        const result = await service.initialize({
          binaryPath: '', // Rust backend resolves actual paths internally
          configPath: '',
          modelPath: '',
        })
        if (result.ok) {
          setState('ready')
          setError(null)
        } else {
          setState('failed')
          setError(result.error.message)
        }
      } catch (e) {
        console.error('KataGo init failed:', e)
        setState('failed')
        setError(String(e))
      }
    }
    init()

    return () => {
      service.shutdown().catch(() => {})
    }
  }, [status])

  return { kataGoState: state, kataGoError: error }
}
