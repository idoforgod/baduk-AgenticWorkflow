// =============================================================================
// commands/gamification.rs — Module 10: Gamification (4 commands)
// =============================================================================
// Quest system, XP/levels, streaks, and achievement tracking persistence.
// JSON blob columns store structured data validated by Zod schemas in TypeScript.
//
// Step 6 command catalog:
//   gamification_get_quests        — list daily quests with completion state
//   gamification_complete_quest    — mark quest completed, distribute reward
//   gamification_get_progress      — player level, XP, streak, badges
//   gamification_check_achievements — check and unlock new achievements
// =============================================================================

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetQuestsPayload {
    pub user_id: String,
    pub date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteQuestPayload {
    pub user_id: String,
    pub quest_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestReward {
    pub xp: i64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProgress {
    pub user_id: String,
    pub xp: i64,
    pub level: i64,
    pub streaks: i64,
    pub badges: serde_json::Value,
    pub daily_quests: serde_json::Value,
    pub last_activity_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckAchievementsPayload {
    pub user_id: String,
    pub event_type: String,
    pub event_data: serde_json::Value,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Return daily quests for a user. If no quests exist for today's date,
/// the TypeScript gamification module generates them and saves via this command.
#[tauri::command]
pub async fn gamification_get_quests(
    state: State<'_, AppState>,
    payload: GetQuestsPayload,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result: rusqlite::Result<String> = db.query_row(
        "SELECT daily_quests FROM gamification_progress WHERE user_id = ?1",
        rusqlite::params![payload.user_id],
        |row| row.get(0),
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // No gamification record yet — return empty quests
            // The TypeScript module will generate quests and call storage_set_setting
            Ok(serde_json::json!([]))
        }
        Err(e) => Err(format!("gamification_get_quests: {}", e)),
        Ok(quests_json) => {
            let quests: serde_json::Value =
                serde_json::from_str(&quests_json).unwrap_or(serde_json::json!([]));
            Ok(quests)
        }
    }
}

/// Mark a quest as completed and distribute XP reward.
/// Updates the daily_quests JSON blob and increments XP.
#[tauri::command]
pub async fn gamification_complete_quest(
    state: State<'_, AppState>,
    payload: CompleteQuestPayload,
) -> Result<QuestReward, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Load current quests
    let quests_json: String = db
        .query_row(
            "SELECT daily_quests FROM gamification_progress WHERE user_id = ?1",
            rusqlite::params![payload.user_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    let mut quests: Vec<serde_json::Value> =
        serde_json::from_str(&quests_json).unwrap_or_default();

    let mut xp_reward = 0i64;

    // Find and mark quest as completed
    for quest in &mut quests {
        if quest["id"].as_str() == Some(&payload.quest_id) {
            quest["completed"] = serde_json::json!(true);
            xp_reward = quest["xpReward"].as_i64().unwrap_or(50);
        }
    }

    let updated_quests = serde_json::to_string(&quests).map_err(|e| e.to_string())?;

    // Upsert gamification_progress with updated quests and XP
    db.execute(
        "INSERT INTO gamification_progress (user_id, daily_quests, xp)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET
           daily_quests = excluded.daily_quests,
           xp = gamification_progress.xp + ?3",
        rusqlite::params![payload.user_id, updated_quests, xp_reward],
    )
    .map_err(|e| format!("gamification_complete_quest: {}", e))?;

    Ok(QuestReward {
        xp: xp_reward,
        message: format!("Quest completed! +{} XP", xp_reward),
    })
}

/// Return full gamification progress for a user.
#[tauri::command]
pub async fn gamification_get_progress(
    state: State<'_, AppState>,
    user_id: String,
) -> Result<PlayerProgress, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result: rusqlite::Result<PlayerProgress> = db.query_row(
        "SELECT user_id, xp, level, streaks, badges, daily_quests, last_activity_date
         FROM gamification_progress WHERE user_id = ?1",
        rusqlite::params![user_id],
        |row| {
            let badges_str: String = row.get(4)?;
            let quests_str: String = row.get(5)?;
            Ok(PlayerProgress {
                user_id: row.get(0)?,
                xp: row.get(1)?,
                level: row.get(2)?,
                streaks: row.get(3)?,
                badges: serde_json::from_str(&badges_str).unwrap_or(serde_json::json!([])),
                daily_quests: serde_json::from_str(&quests_str).unwrap_or(serde_json::json!([])),
                last_activity_date: row.get(6)?,
            })
        },
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Return default progress for new user
            Ok(PlayerProgress {
                user_id,
                xp: 0,
                level: 1,
                streaks: 0,
                badges: serde_json::json!([]),
                daily_quests: serde_json::json!([]),
                last_activity_date: None,
            })
        }
        Err(e) => Err(format!("gamification_get_progress: {}", e)),
        Ok(progress) => Ok(progress),
    }
}

/// Check for newly unlocked achievements based on a game event.
/// The TypeScript gamification module calls this after game-completion events.
/// Returns the list of newly unlocked achievements.
#[tauri::command]
pub async fn gamification_check_achievements(
    state: State<'_, AppState>,
    payload: CheckAchievementsPayload,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Load current badges
    let badges_json: String = db
        .query_row(
            "SELECT badges FROM gamification_progress WHERE user_id = ?1",
            rusqlite::params![payload.user_id],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "[]".to_string());

    let existing_badges: Vec<serde_json::Value> =
        serde_json::from_str(&badges_json).unwrap_or_default();

    // Scaffold: achievement check logic lives in TypeScript (Step 10 module).
    // This command saves newly unlocked badges received from the TypeScript layer.
    // Production: TypeScript calls this with the newly unlocked badge list.
    let new_achievements: Vec<serde_json::Value> = Vec::new();

    if !new_achievements.is_empty() {
        let mut all_badges = existing_badges;
        all_badges.extend(new_achievements.clone());
        let updated = serde_json::to_string(&all_badges).map_err(|e| e.to_string())?;
        db.execute(
            "UPDATE gamification_progress SET badges = ?1 WHERE user_id = ?2",
            rusqlite::params![updated, payload.user_id],
        )
        .map_err(|e| format!("gamification_check_achievements: {}", e))?;
    }

    Ok(serde_json::json!(new_achievements))
}
