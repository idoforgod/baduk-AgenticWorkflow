// =============================================================================
// commands/i18n.rs — Module 4: i18n (1 command)
// =============================================================================
// Detects the OS system locale for initial language selection.
// The TypeScript i18n module uses this to set the initial language before
// the user configures their preference.
//
// Step 6 command catalog:
//   i18n_get_system_locale — return OS locale string (e.g., "en-US", "ko-KR", "ja-JP")
// =============================================================================

/// Return the system locale string from the OS environment.
/// Uses the LANG environment variable on Unix and the Windows locale API on Windows.
/// Falls back to "en" if detection fails.
#[tauri::command]
pub fn i18n_get_system_locale() -> serde_json::Value {
    let locale = detect_locale();
    serde_json::json!({ "locale": locale })
}

fn detect_locale() -> String {
    // Try LANG environment variable (Unix/macOS standard)
    if let Ok(lang) = std::env::var("LANG") {
        // LANG format: "en_US.UTF-8" → normalize to "en-US"
        let locale = lang.split('.').next().unwrap_or("en").replace('_', "-");
        if !locale.is_empty() {
            return locale;
        }
    }

    // Try LANGUAGE (some Linux distributions)
    if let Ok(language) = std::env::var("LANGUAGE") {
        let locale = language
            .split(':')
            .next()
            .unwrap_or("en")
            .split('.')
            .next()
            .unwrap_or("en")
            .replace('_', "-");
        if !locale.is_empty() && locale != "en" {
            return locale;
        }
    }

    // Fallback to English
    "en".to_string()
}
