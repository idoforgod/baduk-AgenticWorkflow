// =============================================================================
// Module: notifications — Public API Barrel Export
// =============================================================================
// Layer 3 (Application)
// Purpose: OS-native cross-platform notifications via Tauri notification plugin.
//
// Implemented by: Step 20 (integration-developer)
// Consumers: features/quick-go, gamification, settings screens
//
// All notifications are:
//   - Per-category opt-in: each category defaults to disabled
//   - OS-permission-gated: will not fire without explicit OS permission grant
//   - Local-only: no notification content is sent to any external server
// =============================================================================

export type {
  NotificationCategory,
  NotificationPreferences,
  TauriNotificationPlugin,
} from './notification-service'
export {
  NotificationService,
  notificationService,
} from './notification-service'
