// =============================================================================
// Module: notifications/notification-service — OS Native Notifications
// =============================================================================
// Layer 3 (Application)
// Purpose: Cross-platform desktop notifications via the Tauri notification
//          plugin. All notification categories are independently configurable
//          and disabled by default.
//
// Notification categories:
//   - achievement: Achievement unlock notifications.
//   - daily_reminder: Daily challenge/quest reminders.
//   - update: App update availability.
//   - game_invite: Future multiplayer game invitations (placeholder).
//
// Privacy notes:
//   - No notification content is sent to any server.
//   - Notification preference state is stored locally in localStorage.
//   - OS-level permission must be granted before any notification is shown.
// =============================================================================

// ---------------------------------------------------------------------------
// Tauri notification plugin stub interface
// Mirrors @tauri-apps/plugin-notification API surface.
// The real plugin is available via src-tauri — this interface keeps the
// frontend type-safe without a dev-time dependency.
// ---------------------------------------------------------------------------

/** Payload accepted by Tauri's sendNotification command. */
interface TauriNotificationPayload {
  readonly title: string
  readonly body: string
  readonly icon?: string
}

/** Permission state returned by requestPermission. */
type NotificationPermissionState = 'granted' | 'denied' | 'default'

/**
 * Tauri notification plugin interface.
 * In production this is satisfied by @tauri-apps/plugin-notification.
 * In tests it is satisfied by the MockTauriNotification class below.
 */
export interface TauriNotificationPlugin {
  sendNotification(payload: TauriNotificationPayload): Promise<void>
  requestPermission(): Promise<NotificationPermissionState>
  isPermissionGranted(): Promise<boolean>
}

// ---------------------------------------------------------------------------
// Default implementation — delegates to Tauri invoke.
// Dynamically imported so the web environment (tests/browser preview) can
// replace it with a mock.
// ---------------------------------------------------------------------------

class TauriNotificationAdapter implements TauriNotificationPlugin {
  async sendNotification(payload: TauriNotificationPayload): Promise<void> {
    // Dynamic import avoids bundling the Tauri plugin in web-only builds.
    // @vite-ignore is intentional: the module is only available inside Tauri.
    const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification').catch(() => null)
    if (mod) {
      await mod.sendNotification(payload)
    } else {
      console.warn('[notifications] Tauri plugin not available:', payload)
    }
  }

  async requestPermission(): Promise<NotificationPermissionState> {
    const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification').catch(() => null)
    if (mod) {
      return mod.requestPermission()
    }
    return 'denied'
  }

  async isPermissionGranted(): Promise<boolean> {
    const mod = await import(/* @vite-ignore */ '@tauri-apps/plugin-notification').catch(() => null)
    if (mod) {
      return mod.isPermissionGranted()
    }
    return false
  }
}

// ---------------------------------------------------------------------------
// Notification category types
// ---------------------------------------------------------------------------

/** All notification categories supported by this application. */
export type NotificationCategory = 'achievement' | 'daily_reminder' | 'update' | 'game_invite'

/** Per-category preference map. All categories default to enabled=false. */
export type NotificationPreferences = Readonly<Record<NotificationCategory, boolean>>

const DEFAULT_PREFERENCES: NotificationPreferences = {
  achievement: false,
  daily_reminder: false,
  update: false,
  game_invite: false,
}

const PREFS_KEY = 'baduk_notification_prefs'

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export class NotificationService {
  private readonly plugin: TauriNotificationPlugin
  private _permissionGranted: boolean | null = null

  constructor(plugin?: TauriNotificationPlugin) {
    this.plugin = plugin ?? new TauriNotificationAdapter()
  }

  // -------------------------------------------------------------------------
  // Permission
  // -------------------------------------------------------------------------

  /**
   * Request OS-level notification permission from the user.
   * Must be called before attempting to show any notification.
   *
   * @returns true if permission was granted.
   */
  async requestPermission(): Promise<boolean> {
    const state = await this.plugin.requestPermission()
    this._permissionGranted = state === 'granted'
    return this._permissionGranted
  }

  /**
   * Check whether OS-level notification permission is currently granted.
   * Caches the result for the lifetime of this instance.
   *
   * @returns true if permission is granted.
   */
  async isPermissionGranted(): Promise<boolean> {
    if (this._permissionGranted !== null) return this._permissionGranted
    this._permissionGranted = await this.plugin.isPermissionGranted()
    return this._permissionGranted
  }

  // -------------------------------------------------------------------------
  // Preferences
  // -------------------------------------------------------------------------

  /**
   * Load per-category notification preferences from localStorage.
   * Missing keys default to false (opt-out).
   *
   * @returns Current preferences for all categories.
   */
  getPreferences(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (!raw) return DEFAULT_PREFERENCES
      const parsed: Partial<NotificationPreferences> = JSON.parse(raw)
      return {
        achievement: parsed.achievement ?? false,
        daily_reminder: parsed.daily_reminder ?? false,
        update: parsed.update ?? false,
        game_invite: parsed.game_invite ?? false,
      }
    } catch {
      return DEFAULT_PREFERENCES
    }
  }

  /**
   * Persist per-category notification preferences to localStorage.
   *
   * @param prefs - Full preferences map to save.
   */
  setPreferences(prefs: NotificationPreferences): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
    } catch {
      // Ignore localStorage write failures.
    }
  }

  /**
   * Enable or disable a single notification category.
   *
   * @param category - The category to update.
   * @param enabled - Whether to enable it.
   */
  setCategoryEnabled(category: NotificationCategory, enabled: boolean): void {
    const current = this.getPreferences()
    this.setPreferences({ ...current, [category]: enabled })
  }

  /**
   * Returns true if a specific category is enabled in preferences.
   *
   * @param category - The category to check.
   */
  isCategoryEnabled(category: NotificationCategory): boolean {
    return this.getPreferences()[category]
  }

  // -------------------------------------------------------------------------
  // Sending notifications
  // -------------------------------------------------------------------------

  /**
   * Send a notification if the category is enabled and OS permission granted.
   *
   * @param category - Notification category (checked against preferences).
   * @param title - Short notification title.
   * @param body - Notification body text.
   */
  async sendNotification(
    category: NotificationCategory,
    title: string,
    body: string
  ): Promise<void> {
    if (!this.isCategoryEnabled(category)) return

    const permitted = await this.isPermissionGranted()
    if (!permitted) return

    await this.plugin.sendNotification({ title, body })
  }

  // -------------------------------------------------------------------------
  // Convenience helpers for each category
  // -------------------------------------------------------------------------

  /**
   * Show an achievement unlock notification.
   *
   * @param achievementName - Display name of the unlocked achievement.
   */
  async notifyAchievement(achievementName: string): Promise<void> {
    await this.sendNotification('achievement', 'Achievement Unlocked', achievementName)
  }

  /**
   * Show a daily challenge reminder notification.
   *
   * @param message - Short reminder message (e.g., "Your daily quest is waiting!").
   */
  async notifyDailyReminder(message: string): Promise<void> {
    await this.sendNotification('daily_reminder', 'Daily Challenge', message)
  }

  /**
   * Show an app update availability notification.
   *
   * @param version - New version string (e.g., "1.2.0").
   */
  async notifyUpdate(version: string): Promise<void> {
    await this.sendNotification(
      'update',
      'Update Available',
      `Version ${version} is ready to install.`
    )
  }

  /**
   * Show a game invitation notification (future multiplayer).
   *
   * @param inviterName - Display name of the inviting player.
   */
  async notifyGameInvite(inviterName: string): Promise<void> {
    await this.sendNotification(
      'game_invite',
      'Game Invitation',
      `${inviterName} has invited you to play.`
    )
  }
}

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

export const notificationService = new NotificationService()
