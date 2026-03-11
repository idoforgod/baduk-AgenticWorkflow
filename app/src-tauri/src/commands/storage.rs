// =============================================================================
// commands/storage.rs — Module 2: Storage (6 commands)
// =============================================================================
// These commands are the Rust-side implementation of the IStoragePort.
// The TypeScript TauriStorageAdapter calls these commands via invoke().
//
// All DB operations use the AppState.db Mutex<Connection>.
// All primary keys are TEXT UUIDs (matches Step 7 schema).
// Timestamps are INTEGER Unix epoch seconds (matches Step 7 schema).
//
// Step 6 command catalog:
//   storage_save_game    — upsert game record + all moves
//   storage_load_game    — load game + moves by gameId
//   storage_list_games   — list games with optional filter
//   storage_delete_game  — delete game cascade
//   storage_get_setting  — get key-value setting
//   storage_set_setting  — upsert key-value setting
// =============================================================================

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveGamePayload {
    pub id: String,
    pub user_id: String,
    pub board_size: i64,
    pub rules: String,
    pub komi: f64,
    pub mode: String,
    pub result: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub moves: Vec<MovePayload>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovePayload {
    pub move_number: i64,
    pub player: String,
    pub coordinate: Option<String>,
    pub timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameRecord {
    pub id: String,
    pub user_id: String,
    pub board_size: i64,
    pub rules: String,
    pub komi: f64,
    pub mode: String,
    pub result: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub moves: Vec<MovePayload>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameFilter {
    pub user_id: Option<String>,
    pub mode: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSummary {
    pub id: String,
    pub board_size: i64,
    pub rules: String,
    pub mode: String,
    pub result: Option<String>,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub move_count: i64,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Upsert a game record and all its moves into the database.
/// Uses INSERT OR REPLACE for idempotent save (handles reconnect/retry).
#[tauri::command]
pub async fn storage_save_game(
    state: State<'_, AppState>,
    payload: SaveGamePayload,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Upsert game row
    db.execute(
        "INSERT OR REPLACE INTO games
         (id, user_id, board_size, rules, komi, mode, result, started_at, ended_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![
            payload.id,
            payload.user_id,
            payload.board_size,
            payload.rules,
            payload.komi,
            payload.mode,
            payload.result,
            payload.started_at,
            payload.ended_at,
        ],
    )
    .map_err(|e| format!("storage_save_game: game insert failed: {}", e))?;

    // Upsert moves (INSERT OR IGNORE preserves append-only constraint)
    for mv in &payload.moves {
        db.execute(
            "INSERT OR IGNORE INTO moves (game_id, move_number, player, coordinate, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![
                payload.id,
                mv.move_number,
                mv.player,
                mv.coordinate,
                mv.timestamp,
            ],
        )
        .map_err(|e| format!("storage_save_game: move insert failed: {}", e))?;
    }

    Ok(serde_json::json!({ "gameId": payload.id }))
}

/// Load a complete game record (including all moves) by gameId.
/// Returns null if the game does not exist.
#[tauri::command]
pub async fn storage_load_game(
    state: State<'_, AppState>,
    game_id: String,
) -> Result<Option<GameRecord>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Load game header
    let game_result: rusqlite::Result<GameRecord> = db.query_row(
        "SELECT id, user_id, board_size, rules, komi, mode, result, started_at, ended_at
         FROM games WHERE id = ?1",
        rusqlite::params![game_id],
        |row| {
            Ok(GameRecord {
                id: row.get(0)?,
                user_id: row.get(1)?,
                board_size: row.get(2)?,
                rules: row.get(3)?,
                komi: row.get(4)?,
                mode: row.get(5)?,
                result: row.get(6)?,
                started_at: row.get(7)?,
                ended_at: row.get(8)?,
                moves: Vec::new(),
            })
        },
    );

    match game_result {
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(format!("storage_load_game: {}", e)),
        Ok(mut game) => {
            // Load moves ordered by move_number
            let mut stmt = db
                .prepare(
                    "SELECT move_number, player, coordinate, timestamp
                     FROM moves WHERE game_id = ?1 ORDER BY move_number ASC",
                )
                .map_err(|e| e.to_string())?;

            let moves: Vec<MovePayload> = stmt
                .query_map(rusqlite::params![game_id], |row| {
                    Ok(MovePayload {
                        move_number: row.get(0)?,
                        player: row.get(1)?,
                        coordinate: row.get(2)?,
                        timestamp: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            game.moves = moves;
            Ok(Some(game))
        }
    }
}

/// List game summaries for a user, with optional mode filter and pagination.
#[tauri::command]
pub async fn storage_list_games(
    state: State<'_, AppState>,
    filter: GameFilter,
) -> Result<Vec<GameSummary>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let limit = filter.limit.unwrap_or(50);
    let offset = filter.offset.unwrap_or(0);

    let mut stmt = db
        .prepare(
            "SELECT g.id, g.board_size, g.rules, g.mode, g.result, g.started_at, g.ended_at,
                    COUNT(m.move_number) as move_count
             FROM games g
             LEFT JOIN moves m ON m.game_id = g.id
             WHERE (?1 IS NULL OR g.user_id = ?1)
               AND (?2 IS NULL OR g.mode = ?2)
             GROUP BY g.id
             ORDER BY g.started_at DESC
             LIMIT ?3 OFFSET ?4",
        )
        .map_err(|e| e.to_string())?;

    let summaries: Vec<GameSummary> = stmt
        .query_map(
            rusqlite::params![filter.user_id, filter.mode, limit, offset],
            |row| {
                Ok(GameSummary {
                    id: row.get(0)?,
                    board_size: row.get(1)?,
                    rules: row.get(2)?,
                    mode: row.get(3)?,
                    result: row.get(4)?,
                    started_at: row.get(5)?,
                    ended_at: row.get(6)?,
                    move_count: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(summaries)
}

/// Delete a game and all associated data (CASCADE handles moves + analysis).
#[tauri::command]
pub async fn storage_delete_game(
    state: State<'_, AppState>,
    game_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM games WHERE id = ?1", rusqlite::params![game_id])
        .map_err(|e| format!("storage_delete_game: {}", e))?;
    Ok(())
}

/// Read a JSON-serialized setting by key. Returns null if key not found.
#[tauri::command]
pub async fn storage_get_setting(
    state: State<'_, AppState>,
    key: String,
) -> Result<Option<serde_json::Value>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let result: rusqlite::Result<String> = db.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        rusqlite::params![key],
        |row| row.get(0),
    );

    match result {
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("storage_get_setting: {}", e)),
        Ok(json_str) => {
            let value: serde_json::Value = serde_json::from_str(&json_str)
                .map_err(|e| format!("storage_get_setting: parse error: {}", e))?;
            Ok(Some(value))
        }
    }
}

/// Upsert a JSON-serialized setting by key.
#[tauri::command]
pub async fn storage_set_setting(
    state: State<'_, AppState>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let json_str = serde_json::to_string(&value)
        .map_err(|e| format!("storage_set_setting: serialize error: {}", e))?;
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![key, json_str],
    )
    .map_err(|e| format!("storage_set_setting: {}", e))?;
    Ok(())
}
