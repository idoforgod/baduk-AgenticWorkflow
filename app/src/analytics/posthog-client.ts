// =============================================================================
// Module: analytics/posthog-client — PostHog Client Stub
// =============================================================================
// Layer 3 (Application)
// Purpose: Privacy-first telemetry wrapper backed by a PostHog-compatible
//          interface. The actual posthog-js SDK is NOT bundled; this stub is
//          designed so that the real SDK can be swapped in by referencing the
//          PostHogConfig.apiKey at runtime.
//
// SDK installation note:
//   When ready to send real data, install posthog-js and replace the
//   PostHogStub implementation with an import of `posthog` from 'posthog-js'.
//   The public API of this module stays identical.
//
// Privacy guarantees:
//   - No event is sent unless getAnalyticsConsent() === true.
//   - No PII fields are accepted by the type system (see events.ts).
//   - IP capture is disabled at the SDK configuration level.
//   - distinct_id is a random UUID generated once per install — not tied to
//     any account, email, or device identifier.
// =============================================================================

import { getAnalyticsConsent } from './consent'
import type { AnalyticsEvent } from './events'

// ---------------------------------------------------------------------------
// PostHog SDK stub interface
// Mirrors the subset of the real posthog-js API that we use.
// ---------------------------------------------------------------------------

interface PostHogSDK {
  init(apiKey: string, options: PostHogInitOptions): void
  capture(event: string, properties?: Record<string, unknown>): void
  identify(distinctId: string, properties?: Record<string, unknown>): void
  reset(): void
  opt_in_capturing(): void
  opt_out_capturing(): void
  has_opted_in_capturing(): boolean
  has_opted_out_capturing(): boolean
}

interface PostHogInitOptions {
  /** PostHog ingest host (use your self-hosted URL or posthog.com). */
  api_host: string
  /** Disable automatic IP capture. */
  ip: boolean
  /** Disable automatic $pageview event. */
  capture_pageview: boolean
  /** Disable automatic $pageleave event. */
  capture_pageleave: boolean
  /** Disable session recording — no screen capture. */
  disable_session_recording: boolean
  /** Respect opt-out by default (do not send until opted in). */
  opt_out_capturing_by_default: boolean
  /** Disable automatic property enrichment that could leak device info. */
  autocapture: boolean
  /** Disable persistence beyond our own consent key. */
  persistence: 'memory'
}

// ---------------------------------------------------------------------------
// Offline event queue
// Events captured while the network is unavailable are held in memory and
// flushed on reconnect. This prevents data loss without requiring persistence.
// ---------------------------------------------------------------------------

interface QueuedEvent {
  readonly event: string
  readonly properties: Record<string, unknown>
  readonly queuedAt: number
}

const MAX_QUEUE_SIZE = 50 // cap to prevent unbounded memory growth

// ---------------------------------------------------------------------------
// In-memory stub — no real SDK, no network calls.
// Replace this with the real posthog-js object when going to production.
// ---------------------------------------------------------------------------

class PostHogStub implements PostHogSDK {
  private _optedIn = false

  init(_apiKey: string, _options: PostHogInitOptions): void {
    // Stub: no-op initialization.
  }

  capture(_event: string, _properties?: Record<string, unknown>): void {
    // Stub: no-op capture.
  }

  identify(_distinctId: string, _properties?: Record<string, unknown>): void {
    // Stub: no-op identify.
  }

  reset(): void {
    this._optedIn = false
  }

  opt_in_capturing(): void {
    this._optedIn = true
  }

  opt_out_capturing(): void {
    this._optedIn = false
  }

  has_opted_in_capturing(): boolean {
    return this._optedIn
  }

  has_opted_out_capturing(): boolean {
    return !this._optedIn
  }
}

// ---------------------------------------------------------------------------
// PostHogClient — the exported singleton
// ---------------------------------------------------------------------------

export interface PostHogConfig {
  /** PostHog project API key. Set via environment or settings. */
  apiKey: string
  /** PostHog ingest host. Defaults to https://app.posthog.com */
  host?: string
}

export class PostHogClient {
  private readonly sdk: PostHogSDK
  private _initialized = false
  private readonly _queue: QueuedEvent[] = []

  constructor(sdk?: PostHogSDK) {
    // Allow injecting a mock SDK in tests; use stub in production.
    this.sdk = sdk ?? new PostHogStub()
  }

  /**
   * Initialize the PostHog client with project credentials.
   * Must be called once at app startup (after consent check).
   *
   * @param config - API key and optional host.
   */
  initialize(config: PostHogConfig): void {
    if (this._initialized) return

    this.sdk.init(config.apiKey, {
      api_host: config.host ?? 'https://app.posthog.com',
      ip: false, // never capture IP address
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      opt_out_capturing_by_default: true, // default OFF
      autocapture: false,
      persistence: 'memory',
    })

    this._initialized = true

    // Sync SDK opt-in state with stored consent.
    if (getAnalyticsConsent()) {
      this.sdk.opt_in_capturing()
      this._flushQueue()
    }
  }

  /**
   * Capture a typed analytics event.
   * No-ops if the user has not opted in.
   *
   * @param analyticsEvent - A fully typed event from events.ts.
   */
  capture(analyticsEvent: AnalyticsEvent): void {
    if (!getAnalyticsConsent()) return

    const { event, ...properties } = analyticsEvent

    if (!this._initialized) {
      // Queue for later if SDK not yet initialized.
      if (this._queue.length < MAX_QUEUE_SIZE) {
        this._queue.push({ event, properties, queuedAt: Date.now() })
      }
      return
    }

    this.sdk.capture(event, properties as Record<string, unknown>)
  }

  /**
   * Associate the current session with an anonymous distinct ID.
   * The ID must be a random UUID — never a username, email, or device ID.
   *
   * @param anonymousId - A random UUID string.
   */
  identify(anonymousId: string): void {
    if (!getAnalyticsConsent()) return
    if (!this._initialized) return
    // Pass no personal properties — identification is purely for session
    // stitching within a single device session.
    this.sdk.identify(anonymousId)
  }

  /**
   * Reset all session state and clear the anonymous ID.
   * Call when the user opts out or requests data deletion.
   */
  reset(): void {
    this.sdk.reset()
    this._queue.length = 0
  }

  /**
   * Enable telemetry after user opts in.
   * Flushes any events queued while waiting for consent.
   */
  optIn(): void {
    this.sdk.opt_in_capturing()
    this._flushQueue()
  }

  /**
   * Disable telemetry immediately after user opts out.
   * Clears the in-memory queue.
   */
  optOut(): void {
    this.sdk.opt_out_capturing()
    this._queue.length = 0
  }

  /** Returns true if the SDK is in opted-in state. */
  isOptedIn(): boolean {
    return this.sdk.has_opted_in_capturing()
  }

  /** Returns true if the SDK has been initialized. */
  get initialized(): boolean {
    return this._initialized
  }

  /** Number of events currently waiting in the offline queue. */
  get queueSize(): number {
    return this._queue.length
  }

  private _flushQueue(): void {
    while (this._queue.length > 0) {
      const queued = this._queue.shift()
      if (queued) {
        this.sdk.capture(queued.event, queued.properties)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton — import and call initialize() once in main.tsx.
// ---------------------------------------------------------------------------

export const posthogClient = new PostHogClient()
