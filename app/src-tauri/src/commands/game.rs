// =============================================================================
// commands/game.rs — Module 7: Game Engine (6 commands)
// =============================================================================
// Tauri command handlers for game lifecycle operations.
// Note: The game-engine runs in TypeScript (Zustand store). These Rust commands
// provide the persistence bridge (save/load) and SGF export.
// Move validation runs client-side in the TypeScript rules-engine.
//
// Step 6 command catalog:
//   game_create      — create new game session record in DB
//   game_play_move   — record a move (after TS rules engine validates it)
//   game_play_pass   — record a pass move
//   game_resign      — record resignation and finalize game
//   game_load        — load saved game for review mode
//   game_export_sgf  — export game moves as SGF string
// =============================================================================

use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

// ---------------------------------------------------------------------------
// Payload Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameConfig {
    pub user_id: String,
    pub board_size: u32,
    pub rules: Option<String>,
    pub komi: Option<f64>,
    pub mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSession {
    pub id: String,
    pub user_id: String,
    pub board_size: u32,
    pub rules: String,
    pub komi: f64,
    pub mode: String,
    pub started_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayMovePayload {
    pub game_id: String,
    pub move_number: i64,
    pub player: String,
    pub coordinate: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayMoveResult {
    pub game_id: String,
    pub move_number: i64,
    pub ok: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PassPayload {
    pub game_id: String,
    pub move_number: i64,
    pub player: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResignPayload {
    pub game_id: String,
    pub player: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameResult {
    pub game_id: String,
    pub result: String,
    pub ended_at: i64,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Create a new game session record in the database.
/// Returns the GameSession with a server-assigned UUID and start timestamp.
/// The TypeScript game-engine (Zustand) initializes its in-memory state from this.
#[tauri::command]
pub async fn game_create(
    state: State<'_, AppState>,
    config: GameConfig,
) -> Result<GameSession, String> {
    let game_id = uuid::Uuid::new_v4().to_string();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    let rules = config.rules.unwrap_or_else(|| "tromp-taylor".to_string());
    let komi = config.komi.unwrap_or(7.5);
    let mode = config.mode.unwrap_or_else(|| "vs-ai".to_string());

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO games (id, user_id, board_size, rules, komi, mode, started_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            game_id,
            config.user_id,
            config.board_size,
            rules,
            komi,
            mode,
            now,
        ],
    )
    .map_err(|e| format!("game_create: {}", e))?;

    Ok(GameSession {
        id: game_id,
        user_id: config.user_id,
        board_size: config.board_size,
        rules,
        komi,
        mode,
        started_at: now,
    })
}

/// Persist a validated move to the database.
/// Move validation has already been performed by the TypeScript rules-engine.
/// This command is the durable write — it is called AFTER TS validates the move.
#[tauri::command]
pub async fn game_play_move(
    state: State<'_, AppState>,
    payload: PlayMovePayload,
) -> Result<PlayMoveResult, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR IGNORE INTO moves (game_id, move_number, player, coordinate, timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            payload.game_id,
            payload.move_number,
            payload.player,
            payload.coordinate,
            now,
        ],
    )
    .map_err(|e| format!("game_play_move: {}", e))?;

    Ok(PlayMoveResult {
        game_id: payload.game_id,
        move_number: payload.move_number,
        ok: true,
    })
}

/// Persist a pass move to the database.
/// coordinate is NULL for pass moves (matches Step 7 schema comment on DKS TT-05).
#[tauri::command]
pub async fn game_play_pass(
    state: State<'_, AppState>,
    payload: PassPayload,
) -> Result<PlayMoveResult, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT OR IGNORE INTO moves (game_id, move_number, player, coordinate, timestamp)
         VALUES (?1, ?2, ?3, NULL, ?4)",
        rusqlite::params![payload.game_id, payload.move_number, payload.player, now],
    )
    .map_err(|e| format!("game_play_pass: {}", e))?;

    Ok(PlayMoveResult {
        game_id: payload.game_id,
        move_number: payload.move_number,
        ok: true,
    })
}

/// Record a resignation and finalize the game.
/// Sets result = "B+R" or "W+R" depending on which player resigned.
/// Sets ended_at timestamp.
#[tauri::command]
pub async fn game_resign(
    state: State<'_, AppState>,
    payload: ResignPayload,
) -> Result<GameResult, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;

    // Resignation result: "B+R" if Black resigns (White wins), "W+R" if White resigns
    let result = if payload.player == "B" {
        "W+R".to_string()
    } else {
        "B+R".to_string()
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE games SET result = ?1, ended_at = ?2 WHERE id = ?3",
        rusqlite::params![result, now, payload.game_id],
    )
    .map_err(|e| format!("game_resign: {}", e))?;

    Ok(GameResult {
        game_id: payload.game_id,
        result,
        ended_at: now,
    })
}

/// Load a saved game for review mode.
/// Returns the full GameSession with move history.
/// Delegates to storage_load_game logic — kept as separate command for
/// semantic clarity (game-engine owns this command, storage module owns storage_load_game).
#[tauri::command]
pub async fn game_load(
    state: State<'_, AppState>,
    game_id: String,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let game: serde_json::Value = db
        .query_row(
            "SELECT id, user_id, board_size, rules, komi, mode, result, started_at, ended_at
             FROM games WHERE id = ?1",
            rusqlite::params![game_id],
            |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "userId": row.get::<_, String>(1)?,
                    "boardSize": row.get::<_, i64>(2)?,
                    "rules": row.get::<_, String>(3)?,
                    "komi": row.get::<_, f64>(4)?,
                    "mode": row.get::<_, String>(5)?,
                    "result": row.get::<_, Option<String>>(6)?,
                    "startedAt": row.get::<_, i64>(7)?,
                    "endedAt": row.get::<_, Option<i64>>(8)?,
                }))
            },
        )
        .map_err(|e| format!("game_load: {}", e))?;

    let mut stmt = db
        .prepare(
            "SELECT move_number, player, coordinate, timestamp
             FROM moves WHERE game_id = ?1 ORDER BY move_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let moves: Vec<serde_json::Value> = stmt
        .query_map(rusqlite::params![game_id], |row| {
            Ok(serde_json::json!({
                "moveNumber": row.get::<_, i64>(0)?,
                "player": row.get::<_, String>(1)?,
                "coordinate": row.get::<_, Option<String>>(2)?,
                "timestamp": row.get::<_, i64>(3)?,
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut game_with_moves = game;
    game_with_moves["moves"] = serde_json::json!(moves);

    Ok(game_with_moves)
}

/// Export a game as SGF (Smart Game Format) string.
/// SGF is the standard format for Go game records — enables import into other tools.
/// Returns the SGF string wrapped in { sgf: "..." }.
#[tauri::command]
pub async fn game_export_sgf(
    state: State<'_, AppState>,
    game_id: String,
) -> Result<serde_json::Value, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Load game metadata
    let (board_size, rules, komi, result): (i64, String, f64, Option<String>) = db
        .query_row(
            "SELECT board_size, rules, komi, result FROM games WHERE id = ?1",
            rusqlite::params![game_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| format!("game_export_sgf: game not found: {}", e))?;

    // Load moves
    let mut stmt = db
        .prepare(
            "SELECT player, coordinate FROM moves WHERE game_id = ?1 ORDER BY move_number ASC",
        )
        .map_err(|e| e.to_string())?;

    let moves: Vec<(String, Option<String>)> = stmt
        .query_map(rusqlite::params![game_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Build SGF string
    // SGF format: (;GM[1]FF[4]SZ[N]KM[komi]RE[result];B[coord];W[coord]...)
    let result_str = result.unwrap_or_default();
    let mut sgf = format!(
        "(;GM[1]FF[4]SZ[{}]KM[{}]RU[{}]",
        board_size,
        komi,
        rules_to_sgf(&rules)
    );

    if !result_str.is_empty() {
        sgf.push_str(&format!("RE[{}]", result_str));
    }

    for (player, coordinate) in &moves {
        let sgf_player = if player == "B" { "B" } else { "W" };
        let sgf_coord = match coordinate {
            None => "".to_string(), // pass
            Some(gtp) => gtp_to_sgf(gtp, board_size as u32),
        };
        sgf.push_str(&format!(";{}[{}]", sgf_player, sgf_coord));
    }

    sgf.push(')');

    Ok(serde_json::json!({ "sgf": sgf }))
}

// ---------------------------------------------------------------------------
// SGF Utilities
// ---------------------------------------------------------------------------

fn rules_to_sgf(rules: &str) -> &str {
    match rules {
        "japanese" => "Japanese",
        "chinese" | "chinese-ogs" | "chinese-kgs" => "Chinese",
        "korean" => "Korean",
        "aga" | "aga-button" => "AGA",
        _ => "Tromp-Taylor",
    }
}

fn gtp_to_sgf(gtp: &str, board_size: u32) -> String {
    // GTP coordinate: letter (A-T, skip I) + number (1-19)
    // SGF coordinate: two lowercase letters (aa = top-left)
    if gtp.len() < 2 {
        return String::new();
    }

    let col_char = gtp.chars().next().unwrap_or('A').to_ascii_uppercase();
    let row_str = &gtp[1..];
    let row: u32 = row_str.parse().unwrap_or(1);

    // Convert GTP column letter to 0-based index (skipping 'I')
    let col_idx = match col_char {
        'A' => 0, 'B' => 1, 'C' => 2, 'D' => 3, 'E' => 4,
        'F' => 5, 'G' => 6, 'H' => 7,
        'J' => 8, 'K' => 9, 'L' => 10, 'M' => 11, 'N' => 12,
        'O' => 13, 'P' => 14, 'Q' => 15, 'R' => 16, 'S' => 17, 'T' => 18,
        _ => return String::new(),
    };

    // SGF row is from top: row 19 = 'a', row 1 = 's' for 19x19
    let row_idx = board_size.saturating_sub(row) as u8;
    let sgf_col = (b'a' + col_idx as u8) as char;
    let sgf_row = (b'a' + row_idx) as char;

    format!("{}{}", sgf_col, sgf_row)
}
