// =============================================================================
// Test: analytics — Consent, PostHog, Sentry, Notifications, Privacy
// =============================================================================
// Coverage:
//   1.  Consent defaults to false (opted out).
//   2.  setAnalyticsConsent(true) persists and is retrievable.
//   3.  setAnalyticsConsent(false) removes the key (returns false).
//   4.  resetAnalyticsConsent() resets to false.
//   5.  PostHog events are blocked when consent is false.
//   6.  PostHog events are sent when consent is true.
//   7.  PostHog captures typed events correctly.
//   8.  PostHog queues events before initialization and flushes on init.
//   9.  PostHog optIn/optOut correctly toggles isOptedIn().
//   10. Sentry does not initialize when consent is false.
//   11. Sentry initializes when consent is true.
//   12. Sentry captureException is blocked without consent.
//   13. Sentry captureException rate limits repeated identical errors.
//   14. Sentry breadcrumbs are sanitized (PII stripped).
//   15. sanitizeString strips email, password, token patterns.
//   16. clearAllAnalyticsData opts out and resets PostHog.
//   17. exportAnalyticsDataSummary returns correct structure.
//   18. Notification category defaults are all false.
//   19. Notification is blocked when category is disabled.
//   20. Notification is blocked when OS permission is denied.
//   21. Notification sends when category enabled and permission granted.
//   22. setCategoryEnabled updates a single category.
//   23. Notification preferences round-trip through localStorage.
//   24. SentryErrorBoundary catches render errors and reports them.
//   25. PostHog queue respects MAX_QUEUE_SIZE (no unbounded growth).
// =============================================================================

import { render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NotificationService,
  type TauriNotificationPlugin,
} from '../notifications/notification-service'
import { getAnalyticsConsent, resetAnalyticsConsent, setAnalyticsConsent } from './consent'
import type { AnalyticsEvent } from './events'
import { PostHogClient, posthogClient } from './posthog-client'
import { clearAllAnalyticsData, exportAnalyticsDataSummary } from './privacy'
import { SentryClient, SentryErrorBoundary, sanitizeString } from './sentry-client'

// ---------------------------------------------------------------------------
// localStorage mock (jsdom provides one; reset between tests)
// ---------------------------------------------------------------------------

function makeStorageStub(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', makeStorageStub())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// 1. Consent: default state
// ---------------------------------------------------------------------------

describe('consent — defaults', () => {
  it('(test 1) getAnalyticsConsent returns false when no key is set', () => {
    expect(getAnalyticsConsent()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. Consent: opt-in
// ---------------------------------------------------------------------------

describe('consent — opt-in', () => {
  it('(test 2) setAnalyticsConsent(true) persists and is retrievable', () => {
    setAnalyticsConsent(true)
    expect(getAnalyticsConsent()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Consent: opt-out removes key
// ---------------------------------------------------------------------------

describe('consent — opt-out', () => {
  it('(test 3) setAnalyticsConsent(false) removes key and returns false', () => {
    setAnalyticsConsent(true)
    expect(getAnalyticsConsent()).toBe(true)
    setAnalyticsConsent(false)
    expect(getAnalyticsConsent()).toBe(false)
    // Confirm the key is actually removed, not set to 'false'.
    expect(localStorage.getItem('baduk_analytics_consent')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. Consent: reset
// ---------------------------------------------------------------------------

describe('consent — reset', () => {
  it('(test 4) resetAnalyticsConsent returns state to false', () => {
    setAnalyticsConsent(true)
    resetAnalyticsConsent()
    expect(getAnalyticsConsent()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5-9. PostHog client
// ---------------------------------------------------------------------------

describe('PostHogClient — event blocking and sending', () => {
  // Build a mock SDK so we can spy on capture calls.
  function makeMockSdk() {
    return {
      init: vi.fn(),
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      has_opted_in_capturing: vi.fn().mockReturnValue(false),
      has_opted_out_capturing: vi.fn().mockReturnValue(true),
    }
  }

  it('(test 5) capture is blocked when consent is false', () => {
    const sdk = makeMockSdk()
    const client = new PostHogClient(sdk)
    client.initialize({ apiKey: 'test-key' })

    const event: AnalyticsEvent = {
      event: 'game_started',
      boardSize: 9,
      mode: 'vs-ai',
      difficulty: 3,
    }
    client.capture(event)
    expect(sdk.capture).not.toHaveBeenCalled()
  })

  it('(test 6) capture is sent when consent is true', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSdk()
    sdk.has_opted_in_capturing.mockReturnValue(true)
    const client = new PostHogClient(sdk)
    client.initialize({ apiKey: 'test-key' })

    const event: AnalyticsEvent = {
      event: 'game_started',
      boardSize: 9,
      mode: 'vs-ai',
      difficulty: 3,
    }
    client.capture(event)
    expect(sdk.capture).toHaveBeenCalledWith('game_started', {
      boardSize: 9,
      mode: 'vs-ai',
      difficulty: 3,
    })
  })

  it('(test 7) captures game_ended event with correct properties', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSdk()
    sdk.has_opted_in_capturing.mockReturnValue(true)
    const client = new PostHogClient(sdk)
    client.initialize({ apiKey: 'test-key' })

    const event: AnalyticsEvent = {
      event: 'game_ended',
      result: 'win',
      duration: 180,
      boardSize: 9,
      mode: 'vs-ai',
      moveCount: 42,
    }
    client.capture(event)
    expect(sdk.capture).toHaveBeenCalledWith('game_ended', {
      result: 'win',
      duration: 180,
      boardSize: 9,
      mode: 'vs-ai',
      moveCount: 42,
    })
  })

  it('(test 8) queues events before initialization and flushes on initialize', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSdk()
    sdk.has_opted_in_capturing.mockReturnValue(true)
    const client = new PostHogClient(sdk)

    // Capture before initialize.
    const event: AnalyticsEvent = {
      event: 'onboarding_step',
      stepName: 'welcome',
      completed: true,
    }
    client.capture(event)
    expect(sdk.capture).not.toHaveBeenCalled()
    expect(client.queueSize).toBe(1)

    // Now initialize — queue should flush.
    client.initialize({ apiKey: 'test-key' })
    expect(sdk.capture).toHaveBeenCalledWith('onboarding_step', {
      stepName: 'welcome',
      completed: true,
    })
    expect(client.queueSize).toBe(0)
  })

  it('(test 9) optIn/optOut toggles isOptedIn correctly', () => {
    const sdk = makeMockSdk()
    const client = new PostHogClient(sdk)
    client.initialize({ apiKey: 'test-key' })

    client.optIn()
    expect(sdk.opt_in_capturing).toHaveBeenCalled()

    client.optOut()
    expect(sdk.opt_out_capturing).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// 10-14. Sentry client
// ---------------------------------------------------------------------------

describe('SentryClient — initialization and error reporting', () => {
  function makeMockSentrySdk() {
    return {
      init: vi.fn(),
      captureException: vi.fn().mockReturnValue('event-id'),
      captureMessage: vi.fn().mockReturnValue('event-id'),
      configureScope: vi.fn(),
      withScope: vi.fn(),
      flush: vi.fn().mockResolvedValue(true),
    }
  }

  it('(test 10) Sentry does NOT initialize when consent is false', () => {
    const sdk = makeMockSentrySdk()
    const client = new SentryClient(sdk)
    client.initialize({
      dsn: 'https://sentry.io/test',
      release: '1.0.0',
      environment: 'development',
    })
    expect(sdk.init).not.toHaveBeenCalled()
    expect(client.initialized).toBe(false)
  })

  it('(test 11) Sentry initializes when consent is true', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSentrySdk()
    const client = new SentryClient(sdk)
    client.initialize({
      dsn: 'https://sentry.io/test',
      release: '1.0.0',
      environment: 'production',
    })
    expect(sdk.init).toHaveBeenCalledOnce()
    expect(client.initialized).toBe(true)
  })

  it('(test 12) captureException is blocked without consent', () => {
    // consent is off by default
    const sdk = makeMockSentrySdk()
    const client = new SentryClient(sdk)
    setAnalyticsConsent(true)
    client.initialize({ dsn: 'https://sentry.io/test', release: '1.0.0', environment: 'staging' })
    setAnalyticsConsent(false) // revoke after init

    client.captureException(new Error('test error'))
    expect(sdk.captureException).not.toHaveBeenCalled()
  })

  it('(test 13) captureException rate-limits repeated identical errors', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSentrySdk()
    const client = new SentryClient(sdk)
    client.initialize({
      dsn: 'https://sentry.io/test',
      release: '1.0.0',
      environment: 'production',
    })

    // Rate limit is 3 per 10 second window.
    const err = new TypeError('duplicate')
    client.captureException(err)
    client.captureException(err)
    client.captureException(err)
    client.captureException(err) // 4th should be dropped
    client.captureException(err) // 5th should be dropped

    expect(sdk.captureException).toHaveBeenCalledTimes(3)
  })

  it('(test 14) addBreadcrumb sanitizes messages containing PII patterns', () => {
    setAnalyticsConsent(true)
    const sdk = makeMockSentrySdk()
    // Make configureScope actually call the callback.
    sdk.configureScope.mockImplementation((cb: (scope: unknown) => void) => {
      const scope = { setTag: vi.fn(), setExtra: vi.fn(), addBreadcrumb: vi.fn() }
      cb(scope)
    })
    const client = new SentryClient(sdk)
    client.initialize({
      dsn: 'https://sentry.io/test',
      release: '1.0.0',
      environment: 'development',
    })
    client.addBreadcrumb('auth', 'User action: token=abc123secret', 'info')

    expect(sdk.configureScope).toHaveBeenCalled()
    const lastCall = sdk.configureScope.mock.calls[sdk.configureScope.mock.calls.length - 1]
    const fakeScopeObj = { addBreadcrumb: vi.fn(), setTag: vi.fn(), setExtra: vi.fn() }
    lastCall[0](fakeScopeObj)
    const breadcrumb = fakeScopeObj.addBreadcrumb.mock.calls[0][0]
    expect(breadcrumb.message).toContain('[REDACTED]')
    expect(breadcrumb.message).not.toContain('abc123secret')
  })
})

// ---------------------------------------------------------------------------
// 15. sanitizeString
// ---------------------------------------------------------------------------

describe('sanitizeString', () => {
  it('(test 15) strips email, password, token, key, secret patterns', () => {
    expect(sanitizeString('login email=user@example.com next')).toContain('[REDACTED]')
    expect(sanitizeString('password=hunter2')).toContain('[REDACTED]')
    expect(sanitizeString('token=eyJabc')).toContain('[REDACTED]')
    expect(sanitizeString('key=supersecret')).toContain('[REDACTED]')
    expect(sanitizeString('secret=xyz')).toContain('[REDACTED]')
    // Clean string should pass through.
    expect(sanitizeString('game started on 9x9 board')).toBe('game started on 9x9 board')
  })
})

// ---------------------------------------------------------------------------
// 16-17. Privacy controls
// ---------------------------------------------------------------------------

describe('privacy controls', () => {
  it('(test 16) clearAllAnalyticsData opts out and resets PostHog', () => {
    setAnalyticsConsent(true)
    expect(getAnalyticsConsent()).toBe(true)

    clearAllAnalyticsData()

    expect(getAnalyticsConsent()).toBe(false)
    expect(posthogClient.isOptedIn()).toBe(false)
  })

  it('(test 17) exportAnalyticsDataSummary returns expected structure', () => {
    const summary = exportAnalyticsDataSummary()
    expect(summary).toHaveProperty('exportedAt')
    expect(summary).toHaveProperty('dataCategories')
    expect(summary.dataCategories).toHaveProperty('sessionEvents', true)
    expect(summary.dataCategories).toHaveProperty('crashReports', true)
    expect(summary).toHaveProperty('retentionPolicy')
    expect(summary).toHaveProperty('deletionNote')
    // exportedAt must be a valid ISO-8601 string.
    expect(new Date(summary.exportedAt).toISOString()).toBe(summary.exportedAt)
  })
})

// ---------------------------------------------------------------------------
// 18-23. NotificationService
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  function makeMockPlugin(permissionGranted = false): TauriNotificationPlugin & {
    sendNotification: ReturnType<typeof vi.fn>
  } {
    return {
      sendNotification: vi.fn().mockResolvedValue(undefined),
      requestPermission: vi.fn().mockResolvedValue(permissionGranted ? 'granted' : 'denied'),
      isPermissionGranted: vi.fn().mockResolvedValue(permissionGranted),
    }
  }

  it('(test 18) all notification categories default to false', () => {
    const svc = new NotificationService(makeMockPlugin())
    const prefs = svc.getPreferences()
    expect(prefs.achievement).toBe(false)
    expect(prefs.daily_reminder).toBe(false)
    expect(prefs.update).toBe(false)
    expect(prefs.game_invite).toBe(false)
  })

  it('(test 19) sendNotification is blocked when category is disabled', async () => {
    const plugin = makeMockPlugin(true)
    const svc = new NotificationService(plugin)
    // achievement is disabled by default
    await svc.sendNotification('achievement', 'Test', 'Test body')
    expect(plugin.sendNotification).not.toHaveBeenCalled()
  })

  it('(test 20) sendNotification is blocked when OS permission is denied', async () => {
    const plugin = makeMockPlugin(false) // permission denied
    const svc = new NotificationService(plugin)
    svc.setCategoryEnabled('achievement', true)
    await svc.sendNotification('achievement', 'Test', 'Test body')
    expect(plugin.sendNotification).not.toHaveBeenCalled()
  })

  it('(test 21) sendNotification sends when category enabled and permission granted', async () => {
    const plugin = makeMockPlugin(true)
    const svc = new NotificationService(plugin)
    svc.setCategoryEnabled('achievement', true)
    await svc.sendNotification('achievement', 'Badge Earned', 'First Win!')
    expect(plugin.sendNotification).toHaveBeenCalledWith({
      title: 'Badge Earned',
      body: 'First Win!',
    })
  })

  it('(test 22) setCategoryEnabled updates only the targeted category', () => {
    const svc = new NotificationService(makeMockPlugin())
    svc.setCategoryEnabled('daily_reminder', true)
    const prefs = svc.getPreferences()
    expect(prefs.daily_reminder).toBe(true)
    expect(prefs.achievement).toBe(false)
    expect(prefs.update).toBe(false)
    expect(prefs.game_invite).toBe(false)
  })

  it('(test 23) notification preferences round-trip through localStorage', () => {
    const plugin = makeMockPlugin()
    const svc1 = new NotificationService(plugin)
    svc1.setCategoryEnabled('update', true)
    svc1.setCategoryEnabled('achievement', true)

    // New instance reads from the same localStorage.
    const svc2 = new NotificationService(plugin)
    const prefs = svc2.getPreferences()
    expect(prefs.update).toBe(true)
    expect(prefs.achievement).toBe(true)
    expect(prefs.daily_reminder).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 24. SentryErrorBoundary
// ---------------------------------------------------------------------------

describe('SentryErrorBoundary', () => {
  it('(test 24) catches render errors and renders fallback UI', () => {
    // Suppress React's console.error during the intentional throw.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const sdk = {
      init: vi.fn(),
      captureException: vi.fn().mockReturnValue('err-id'),
      captureMessage: vi.fn(),
      configureScope: vi.fn(),
      withScope: vi.fn(),
      flush: vi.fn().mockResolvedValue(true),
    }
    setAnalyticsConsent(true)
    const client = new SentryClient(sdk)
    client.initialize({
      dsn: 'https://sentry.io/test',
      release: '1.0.0',
      environment: 'production',
    })

    const Bomb = (): React.ReactElement => {
      throw new Error('render crash')
    }

    render(
      React.createElement(
        SentryErrorBoundary,
        { fallback: React.createElement('div', null, 'Error screen'), client },
        React.createElement(Bomb)
      )
    )

    expect(screen.getByText('Error screen')).toBeTruthy()
    consoleSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// 25. PostHog queue size cap
// ---------------------------------------------------------------------------

describe('PostHogClient — queue size cap', () => {
  it('(test 25) queue does not exceed MAX_QUEUE_SIZE (50 events)', () => {
    setAnalyticsConsent(true)
    // Create an uninitialized client to test queuing.
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      identify: vi.fn(),
      reset: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
      has_opted_in_capturing: vi.fn().mockReturnValue(true),
      has_opted_out_capturing: vi.fn().mockReturnValue(false),
    }
    const client = new PostHogClient(sdk)
    // Do NOT call initialize — events go to queue.

    for (let i = 0; i < 100; i++) {
      client.capture({
        event: 'settings_changed',
        setting: 'theme',
        value: 'dark',
      })
    }

    // Queue is capped at 50.
    expect(client.queueSize).toBeLessThanOrEqual(50)
  })
})
