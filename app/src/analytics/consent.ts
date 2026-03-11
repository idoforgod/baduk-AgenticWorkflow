// =============================================================================
// Module: analytics/consent — Consent Management
// =============================================================================
// Layer 3 (Application)
// Purpose: Manage user consent for analytics telemetry and crash reporting.
//          Consent is persisted in localStorage and defaults to OFF.
//
// Privacy guarantee:
//   - Default state is OPTED OUT — no data is ever sent without explicit opt-in.
//   - Consent state is readable and writeable without any dark patterns.
//   - Resetting consent removes the stored preference (not silently re-opting-in).
// =============================================================================

/** localStorage key for analytics consent. */
const CONSENT_KEY = 'baduk_analytics_consent'

/**
 * Returns the current analytics consent state.
 * If no consent has been recorded, returns false (opted out by default).
 *
 * @returns true only when the user has explicitly opted in.
 */
export function getAnalyticsConsent(): boolean {
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    return stored === 'true'
  } catch {
    // localStorage unavailable (e.g., SSR or restricted context): fail safe.
    return false
  }
}

/**
 * Persists the user's analytics consent choice to localStorage.
 * Setting to false opts out and stops all telemetry immediately.
 *
 * @param consent - true to opt in, false to opt out.
 */
export function setAnalyticsConsent(consent: boolean): void {
  try {
    if (consent) {
      localStorage.setItem(CONSENT_KEY, 'true')
    } else {
      // Remove key entirely so getAnalyticsConsent() returns the safe default.
      localStorage.removeItem(CONSENT_KEY)
    }
  } catch {
    // localStorage write failure: silently ignore (consent stays false).
  }
}

/**
 * Removes the stored consent entry, resetting to the default opted-out state.
 * Use this when a user requests data deletion.
 */
export function resetAnalyticsConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Ignore — localStorage unavailable.
  }
}
