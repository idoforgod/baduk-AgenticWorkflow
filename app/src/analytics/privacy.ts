// =============================================================================
// Module: analytics/privacy — Privacy Controls
// =============================================================================
// Layer 3 (Application)
// Purpose: Provide user-facing privacy controls — clear all analytics state,
//          opt out comprehensively, and produce a data export stub for GDPR
//          compliance.
//
// What data is collected (when opted in):
//   - Anonymous session events (game_started, game_ended, etc.)
//   - Crash reports (error type + sanitized stack trace)
//   - No PII ever — this is enforced at the type level in events.ts
//
// Data retention:
//   - PostHog: 1 year rolling window (configurable in PostHog project settings)
//   - Sentry: 90 days (Sentry default)
//   - Local consent flag: until user clears it or uninstalls
//
// How to disable all telemetry:
//   1. Call clearAllAnalyticsData() — opts out and clears local state.
//   2. Or toggle "Share anonymous analytics" to OFF in Settings > Privacy.
// =============================================================================

import { resetAnalyticsConsent, setAnalyticsConsent } from './consent'
import { posthogClient } from './posthog-client'
import { sentryClient } from './sentry-client'

// ---------------------------------------------------------------------------
// Type-level PII guard
// These types are intentionally structurally restrictive — no free-form string
// fields that could accidentally carry user content.
// ---------------------------------------------------------------------------

/**
 * The complete set of analytics data categories this app may collect.
 * Each field is a boolean because we store only counts/flags — not content.
 */
export interface AnalyticsDataInventory {
  /** Whether anonymous session events (app open/close, game results) are sent. */
  readonly sessionEvents: boolean
  /** Whether anonymous crash/error reports are sent. */
  readonly crashReports: boolean
  /** Whether notification preferences are stored locally. */
  readonly localNotificationPrefs: boolean
}

/**
 * GDPR-style data export structure.
 * Contains only aggregate counts — no raw event streams or user content.
 */
export interface AnalyticsDataExport {
  readonly exportedAt: string // ISO-8601 timestamp
  readonly dataCategories: AnalyticsDataInventory
  readonly retentionPolicy: {
    readonly sessionEvents: string
    readonly crashReports: string
  }
  readonly deletionNote: string
}

// ---------------------------------------------------------------------------
// Privacy control functions
// ---------------------------------------------------------------------------

/**
 * Clear all analytics state and opt out of all telemetry.
 *
 * What this does:
 *   1. Sets analytics consent to false.
 *   2. Resets the PostHog client (clears anonymous ID and event queue).
 *   3. Removes the consent key from localStorage.
 *
 * After calling this, no telemetry events or crash reports will be sent
 * until the user explicitly opts in again.
 */
export function clearAllAnalyticsData(): void {
  setAnalyticsConsent(false)
  posthogClient.optOut()
  posthogClient.reset()
  resetAnalyticsConsent()
}

/**
 * Produce a GDPR-style data export describing what (if anything) is collected.
 * This function never returns actual event data — only metadata about categories.
 *
 * The actual raw event data lives on PostHog/Sentry servers and can be deleted
 * by contacting support or using those services' deletion APIs.
 *
 * @returns A summary of data collection practices for user review.
 */
export function exportAnalyticsDataSummary(): AnalyticsDataExport {
  return {
    exportedAt: new Date().toISOString(),
    dataCategories: {
      sessionEvents: true,
      crashReports: true,
      localNotificationPrefs: true,
    },
    retentionPolicy: {
      sessionEvents: '1 year rolling window (PostHog project setting)',
      crashReports: '90 days (Sentry default)',
    },
    deletionNote:
      'To request deletion of server-side analytics data, ' +
      'contact the app developer. All data is anonymous and ' +
      'cannot be linked back to you personally.',
  }
}

/**
 * Returns the current state of each analytics feature.
 * Use this to populate the Privacy settings screen.
 */
export function getAnalyticsStatus(): {
  readonly postHogInitialized: boolean
  readonly sentryInitialized: boolean
  readonly postHogOptedIn: boolean
} {
  return {
    postHogInitialized: posthogClient.initialized,
    sentryInitialized: sentryClient.initialized,
    postHogOptedIn: posthogClient.isOptedIn(),
  }
}
