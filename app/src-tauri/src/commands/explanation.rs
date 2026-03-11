// =============================================================================
// commands/explanation.rs — Module 8: Explanation Engine (3 commands)
// =============================================================================
// These commands are thin pass-throughs to settings storage.
// The explanation engine itself runs entirely in TypeScript (pure transformation).
// Rust-side only manages the persistent tier setting.
//
// Step 6 command catalog:
//   explanation_generate  — generate explanation (delegates to TypeScript in production)
//   explanation_set_tier  — persist default tier to settings table
//   explanation_get_tier  — retrieve persisted tier
// =============================================================================

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationRequest {
    pub current_analysis: serde_json::Value,
    pub previous_analysis: Option<serde_json::Value>,
    pub actual_move: Option<String>,
    pub tier: String,
    pub turn_number: u32,
    pub board_size: u32,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplanationOutput {
    pub pattern_id: String,
    pub tier: String,
    pub primary_text: String,
    pub detail_text: Option<String>,
    pub winrate_change: f64,
    pub score_lead_change: f64,
}

/// Generate an explanation for a position.
/// Scaffold: returns a structured placeholder.
/// Production (Step 13): the TypeScript explanation-engine handles this
/// entirely client-side. This command exists for cases where Rust-side
/// processing is needed (e.g., batch analysis during post-game review).
#[tauri::command]
pub fn explanation_generate(
    request: ExplanationRequest,
) -> Result<ExplanationOutput, String> {
    // Scaffold placeholder — Step 13 replaces with real template matching
    Ok(ExplanationOutput {
        pattern_id: "P001".to_string(),
        tier: request.tier,
        primary_text: "Move analysis pending KataGo response.".to_string(),
        detail_text: None,
        winrate_change: 0.0,
        score_lead_change: 0.0,
    })
}

/// Persist the default explanation tier to settings.
/// Tier values: "beginner" | "intermediate" | "advanced" (Step 4 Section 5.1).
#[tauri::command]
pub async fn explanation_set_tier(
    state: State<'_, AppState>,
    tier: String,
) -> Result<(), String> {
    // Validate tier value
    if !matches!(tier.as_str(), "beginner" | "intermediate" | "advanced") {
        return Err(format!(
            "explanation_set_tier: invalid tier '{}'. Must be beginner|intermediate|advanced",
            tier
        ));
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let value = serde_json::to_string(&serde_json::json!(tier)).map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('explanationTier', ?1)",
        rusqlite::params![value],
    )
    .map_err(|e| format!("explanation_set_tier: {}", e))?;

    Ok(())
}

/// Retrieve the default explanation tier from settings.
/// Returns "beginner" as default if not set.
#[tauri::command]
pub async fn explanation_get_tier(
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result: rusqlite::Result<String> = db.query_row(
        "SELECT value FROM settings WHERE key = 'explanationTier'",
        [],
        |row| row.get(0),
    );

    let tier = match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => "beginner".to_string(),
        Err(e) => return Err(format!("explanation_get_tier: {}", e)),
        Ok(json_str) => serde_json::from_str::<String>(&json_str)
            .unwrap_or_else(|_| "beginner".to_string()),
    };

    Ok(serde_json::json!({ "tier": tier }))
}
