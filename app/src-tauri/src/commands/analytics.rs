// =============================================================================
// commands/analytics.rs — Module 9: Analytics (2 commands)
// =============================================================================
// Persists and retrieves user consent for PostHog/Sentry analytics.
// The TypeScript analytics module uses this to determine whether to initialize
// the PostHog and Sentry SDKs.
//
// Step 6 command catalog:
//   analytics_set_consent — persist consent boolean to settings
//   analytics_get_consent — retrieve consent state (default: false / not granted)
// =============================================================================

use crate::AppState;
use tauri::State;

/// Persist analytics consent preference.
/// `granted: true` enables PostHog + Sentry.
/// `granted: false` disables all telemetry (GDPR compliance).
#[tauri::command]
pub async fn analytics_set_consent(
    state: State<'_, AppState>,
    granted: bool,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let value = serde_json::to_string(&serde_json::json!(granted)).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('analyticsConsent', ?1)",
        rusqlite::params![value],
    )
    .map_err(|e| format!("analytics_set_consent: {}", e))?;
    Ok(())
}

/// Retrieve analytics consent state.
/// Returns `{ granted: false }` by default (opt-in model — Step 1 GDPR requirement).
#[tauri::command]
pub fn analytics_get_consent(state: State<'_, AppState>) -> serde_json::Value {
    let db = state.db.lock().unwrap_or_else(|e| e.into_inner());
    let result: rusqlite::Result<String> = db.query_row(
        "SELECT value FROM settings WHERE key = 'analyticsConsent'",
        [],
        |row| row.get(0),
    );

    let granted = match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => false,
        Err(_) => false,
        Ok(json_str) => serde_json::from_str::<bool>(&json_str).unwrap_or(false),
    };

    serde_json::json!({ "granted": granted })
}
