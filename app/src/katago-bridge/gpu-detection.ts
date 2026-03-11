// =============================================================================
// katago-bridge/gpu-detection.ts — GPU Backend Detection
// =============================================================================
// Detects the best available GPU backend for KataGo on the current system.
// Since KataGo's backend is compile-time (Step 2 Section 6.1), this module
// selects the appropriate pre-compiled binary variant.
//
// Detection cascade (Step 2 Section 6.3):
//   macOS:         Metal -> OpenCL -> Eigen AVX2 -> Eigen
//   Windows/Linux: TensorRT -> CUDA -> OpenCL -> Eigen AVX2 -> Eigen
//
// The actual detection runs on the Rust side via katago_detect_backend command.
// This TypeScript module wraps the Tauri invoke call and caches the result.
// =============================================================================

import type { BackendInfo } from '../core/interfaces'
import type { TauriBackendInfo } from './types'

// ---------------------------------------------------------------------------
// Cached Detection Result
// ---------------------------------------------------------------------------

let cachedBackend: BackendInfo | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the best GPU backend for KataGo.
 * Calls the Rust katago_detect_backend command which probes available
 * GPU drivers and bundled KataGo binaries.
 *
 * Results are cached — subsequent calls return the cached value.
 *
 * @param invoker - Tauri invoke function (injected for testability)
 * @returns Detected backend information
 */
export async function detectBackend(
  invoker: (cmd: string) => Promise<TauriBackendInfo>
): Promise<BackendInfo> {
  if (cachedBackend !== null) {
    return cachedBackend
  }

  const result = await invoker('katago_detect_backend')
  const backend = mapTauriBackendInfo(result)
  cachedBackend = backend
  return backend
}

/**
 * Get the cached backend detection result.
 * Returns null if detection has not been performed.
 */
export function getCachedBackend(): BackendInfo | null {
  return cachedBackend
}

/**
 * Clear the cached backend detection result.
 * Forces re-detection on next call to detectBackend().
 */
export function clearBackendCache(): void {
  cachedBackend = null
}

/**
 * Map a raw Tauri backend response to the typed BackendInfo interface.
 */
export function mapTauriBackendInfo(raw: TauriBackendInfo): BackendInfo {
  return {
    backend: normalizeBackendType(raw.backendType),
    gpuName: raw.deviceName,
    binaryPath: raw.binaryName,
    needsTuning: raw.backendType === 'opencl',
  }
}

/**
 * Normalize a backend type string to the typed union.
 */
function normalizeBackendType(raw: string): BackendInfo['backend'] {
  const normalized = raw.toLowerCase().trim()
  switch (normalized) {
    case 'metal':
      return 'metal'
    case 'cuda':
      return 'cuda'
    case 'tensorrt':
      return 'tensorrt'
    case 'opencl':
      return 'opencl'
    case 'eigenavx2':
    case 'eigen-avx2':
    case 'eigen_avx2':
      return 'eigenavx2'
    case 'eigen':
    case 'cpu':
    default:
      return 'eigen'
  }
}

/**
 * Check if a backend supports GPU acceleration.
 */
export function isGPUBackend(backend: BackendInfo['backend']): boolean {
  return backend === 'metal' || backend === 'cuda' || backend === 'tensorrt' || backend === 'opencl'
}

/**
 * Get the expected relative performance of a backend.
 * Returns a rough multiplier relative to plain Eigen (CPU baseline = 1.0).
 * Based on Step 2 Section 10.1 benchmark data.
 */
export function getBackendSpeedMultiplier(backend: BackendInfo['backend']): number {
  switch (backend) {
    case 'tensorrt':
      return 90 // ~87-104x vs CPU
    case 'cuda':
      return 65 // ~61-69x vs CPU
    case 'metal':
      return 10 // ~9-10x vs CPU
    case 'opencl':
      return 35 // ~33-43x vs CPU
    case 'eigenavx2':
      return 1.5 // ~37-64% faster than plain Eigen
    case 'eigen':
      return 1.0
  }
}
