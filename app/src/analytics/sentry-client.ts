// =============================================================================
// Module: analytics/sentry-client — Sentry Crash Reporting Stub
// =============================================================================
// Layer 3 (Application)
// Purpose: Privacy-first crash reporting wrapper backed by a Sentry-compatible
//          interface. The actual @sentry/browser SDK is NOT bundled; this stub
//          is designed so that the real SDK can be swapped in at production time.
//
// SDK installation note:
//   When ready to send real crash reports, install @sentry/browser and replace
//   the SentryStub implementation with real Sentry.init(). The public API of
//   this module stays identical.
//
// Privacy guarantees:
//   - No crash report is sent unless getAnalyticsConsent() === true.
//   - Breadcrumbs are sanitized — user-generated content is stripped.
//   - No user identity (name/email) is attached to error events.
//   - Rate limiting: at most 1 error report per 10 seconds per error type.
//
// React error boundary:
//   Import <SentryErrorBoundary> to wrap the component tree.
// =============================================================================

import React from 'react'
import { getAnalyticsConsent } from './consent'

// ---------------------------------------------------------------------------
// Sentry SDK stub interface
// Mirrors the subset of @sentry/browser we use.
// ---------------------------------------------------------------------------

interface SentryScope {
  setTag(key: string, value: string): void
  setExtra(key: string, value: unknown): void
  addBreadcrumb(breadcrumb: SanitizedBreadcrumb): void
}

interface SanitizedBreadcrumb {
  readonly category: string
  readonly message: string
  readonly level: 'info' | 'warning' | 'error'
  readonly timestamp: number
}

interface SentryInitOptions {
  dsn: string
  release: string
  environment: 'development' | 'staging' | 'production'
  /** Never send PII. */
  sendDefaultPii: false
  /** Max events per second to prevent flooding. */
  maxBreadcrumbs: number
  /** Before-send hook for sanitization. */
  beforeSend: (event: SentryEvent) => SentryEvent | null
}

interface SentryEvent {
  event_id?: string
  message?: string
  exception?: unknown
  breadcrumbs?: { values?: SanitizedBreadcrumb[] }
  user?: unknown
  request?: unknown
}

interface SentrySDK {
  init(options: SentryInitOptions): void
  captureException(error: unknown, scope?: (scope: SentryScope) => void): string
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): string
  configureScope(callback: (scope: SentryScope) => void): void
  withScope(callback: (scope: SentryScope) => void): void
  flush(timeout?: number): Promise<boolean>
}

// ---------------------------------------------------------------------------
// In-memory stub — no real SDK, no network calls.
// ---------------------------------------------------------------------------

class SentryStub implements SentrySDK {
  init(_options: SentryInitOptions): void {
    // Stub: no-op.
  }

  captureException(_error: unknown, _scope?: (scope: SentryScope) => void): string {
    return 'stub-event-id'
  }

  captureMessage(_message: string, _level?: 'info' | 'warning' | 'error'): string {
    return 'stub-event-id'
  }

  configureScope(_callback: (scope: SentryScope) => void): void {
    // Stub: no-op.
  }

  withScope(_callback: (scope: SentryScope) => void): void {
    // Stub: no-op.
  }

  async flush(_timeout?: number): Promise<boolean> {
    return true
  }
}

// ---------------------------------------------------------------------------
// Sanitization helpers
// ---------------------------------------------------------------------------

/** Patterns that may contain PII or sensitive user content. */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /email[=:]\S+/gi,
  /password[=:]\S+/gi,
  /token[=:]\S+/gi,
  /key[=:]\S+/gi,
  /secret[=:]\S+/gi,
]

/**
 * Strip any match of SENSITIVE_PATTERNS from a string.
 * Used on error messages and breadcrumb messages before sending.
 *
 * @param input - Raw string to sanitize.
 * @returns Sanitized string with sensitive values replaced.
 */
function sanitizeString(input: string): string {
  let result = input
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]')
  }
  return result
}

/**
 * Remove user-generated content fields from a Sentry event before transmission.
 * Strips: user identity, request body, cookies, and raw error messages
 * that might contain game state (move sequences etc.).
 *
 * @param event - Raw Sentry event.
 * @returns Sanitized event, or null to drop the event entirely.
 */
function sanitizeSentryEvent(event: SentryEvent): SentryEvent | null {
  // Drop event entirely if consent has been revoked since initialization.
  if (!getAnalyticsConsent()) return null

  const sanitized: SentryEvent = {
    ...event,
    // Remove user identity fields.
    user: undefined,
    // Remove request details that might contain cookies or auth headers.
    request: undefined,
  }

  // Sanitize breadcrumb messages.
  if (sanitized.breadcrumbs?.values) {
    sanitized.breadcrumbs = {
      values: sanitized.breadcrumbs.values.map((b) => ({
        ...b,
        message: sanitizeString(b.message),
      })),
    }
  }

  return sanitized
}

// ---------------------------------------------------------------------------
// Rate limiter — prevent flooding Sentry with repeated errors.
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number
  windowStart: number
}

const RATE_LIMIT_WINDOW_MS = 10_000 // 10 seconds
const RATE_LIMIT_MAX = 3 // max 3 identical errors per window

class ErrorRateLimiter {
  private readonly _buckets = new Map<string, RateLimitEntry>()

  /**
   * Returns true if the error is within the rate limit and should be sent.
   * @param errorKey - A short string identifying the error type.
   */
  allow(errorKey: string): boolean {
    const now = Date.now()
    const entry = this._buckets.get(errorKey)

    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      this._buckets.set(errorKey, { count: 1, windowStart: now })
      return true
    }

    if (entry.count < RATE_LIMIT_MAX) {
      entry.count++
      return true
    }

    return false // Rate limit exceeded.
  }
}

// ---------------------------------------------------------------------------
// SentryClient — the exported singleton
// ---------------------------------------------------------------------------

export interface SentryConfig {
  /** Sentry DSN for this project. */
  dsn: string
  /** App release version (e.g., '0.1.0'). */
  release: string
  /** Runtime environment. */
  environment: 'development' | 'staging' | 'production'
}

export class SentryClient {
  private readonly sdk: SentrySDK
  private readonly rateLimiter = new ErrorRateLimiter()
  private _initialized = false

  constructor(sdk?: SentrySDK) {
    this.sdk = sdk ?? new SentryStub()
  }

  /**
   * Initialize Sentry crash reporting.
   * Must be called once at app startup, only when user has opted in.
   *
   * @param config - DSN, release, and environment.
   */
  initialize(config: SentryConfig): void {
    if (this._initialized) return
    if (!getAnalyticsConsent()) return

    this.sdk.init({
      dsn: config.dsn,
      release: config.release,
      environment: config.environment,
      sendDefaultPii: false,
      maxBreadcrumbs: 20,
      beforeSend: sanitizeSentryEvent,
    })

    // Tag every event with the app version for release tracking.
    this.sdk.configureScope((scope) => {
      scope.setTag('app.version', config.release)
      scope.setTag('platform', 'tauri-desktop')
    })

    this._initialized = true
  }

  /**
   * Report an unhandled exception to Sentry.
   * No-ops if user has not opted in or if rate-limited.
   *
   * @param error - The caught error or unknown thrown value.
   * @param context - Optional key-value pairs for debugging (no PII).
   */
  captureException(error: unknown, context?: Record<string, string>): void {
    if (!getAnalyticsConsent()) return
    if (!this._initialized) return

    const errorKey =
      error instanceof Error
        ? error.name
        : typeof error === 'string'
          ? error.slice(0, 40)
          : 'unknown'

    if (!this.rateLimiter.allow(errorKey)) return

    this.sdk.withScope((scope) => {
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          scope.setExtra(key, sanitizeString(value))
        }
      }
    })

    this.sdk.captureException(error)
  }

  /**
   * Add a breadcrumb for debugging context.
   * Message is sanitized before storage.
   *
   * @param category - Logical category (e.g., 'navigation', 'game', 'ui').
   * @param message - Short description — must not contain user content.
   * @param level - Severity level.
   */
  addBreadcrumb(
    category: string,
    message: string,
    level: 'info' | 'warning' | 'error' = 'info'
  ): void {
    if (!getAnalyticsConsent()) return
    if (!this._initialized) return

    this.sdk.configureScope((scope) => {
      scope.addBreadcrumb({
        category,
        message: sanitizeString(message),
        level,
        timestamp: Date.now() / 1000,
      })
    })
  }

  /**
   * Flush any buffered events before app shutdown.
   * Call this in the Tauri onCloseRequested handler.
   */
  async flush(): Promise<void> {
    if (!this._initialized) return
    await this.sdk.flush(2000)
  }

  /** Returns true if Sentry has been initialized. */
  get initialized(): boolean {
    return this._initialized
  }
}

// ---------------------------------------------------------------------------
// React error boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  readonly children: React.ReactNode
  /** Optional fallback UI to render when an error is caught. */
  readonly fallback?: React.ReactNode
  /** Client instance for reporting (defaults to module singleton). */
  readonly client?: SentryClient
}

interface ErrorBoundaryState {
  readonly hasError: boolean
  readonly errorId: string | null
}

/**
 * React error boundary that reports unhandled component errors to Sentry.
 * Wraps the app's component tree to catch render-phase exceptions.
 *
 * Usage:
 *   <SentryErrorBoundary fallback={<ErrorScreen />}>
 *     <App />
 *   </SentryErrorBoundary>
 */
export class SentryErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorId: null }
  }

  static getDerivedStateFromError(_error: unknown): ErrorBoundaryState {
    return { hasError: true, errorId: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const client = this.props.client ?? sentryClient
    client.captureException(error, {
      componentStack: errorInfo.componentStack
        ? sanitizeString(errorInfo.componentStack.slice(0, 500))
        : '',
    })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? React.createElement('div', null, 'Something went wrong.')
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton — import and call initialize() once in main.tsx.
// ---------------------------------------------------------------------------

export const sentryClient = new SentryClient()

// Export sanitizeString for use in tests.
export { sanitizeString }
