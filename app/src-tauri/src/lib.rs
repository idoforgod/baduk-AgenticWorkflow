// =============================================================================
// Baduk Platform — Tauri 2.0 Backend
// =============================================================================
// This file is the Rust-side composition root for all 29 Tauri commands.
// Architecture: Step 6 Modular Monolith
// SQLite: rusqlite (bundled), WAL mode, managed via AppState
// KataGo: Tauri sidecar via tauri-plugin-shell
//
// Command modules (by Step 6 ownership):
//   commands::storage   — 6 commands (Module 2)
//   commands::katago    — 7 commands (Module 6)
//   commands::game      — 6 commands (Module 7)
//   commands::explanation — 3 commands (Module 8)
//   commands::i18n      — 1 command  (Module 4)
//   commands::analytics — 2 commands (Module 9)
//   commands::gamification — 4 commands (Module 10)
//   Total: 29 commands
// =============================================================================

use std::sync::Mutex;
use rusqlite::Connection;
use tauri::Manager;

mod commands;
mod db;
mod katago;

// ---------------------------------------------------------------------------
// Application State
// ---------------------------------------------------------------------------
// AppState is the single Tauri-managed state struct. It is injected into
// command handlers via `tauri::State<AppState>`.
//
// KataGoProcess is wrapped in Option because the process starts as None and
// is initialized lazily when `katago_initialize` is called. Using Mutex<Option>
// instead of RwLock because KataGo stdin writes are exclusive operations.
// ---------------------------------------------------------------------------

pub struct AppState {
    /// SQLite connection pool (single connection — WAL mode allows concurrent reads)
    pub db: Mutex<Connection>,
    /// KataGo sidecar process handle — None until katago_initialize is called
    pub katago: Mutex<Option<katago::KataGoProcess>>,
}

// ---------------------------------------------------------------------------
// App Entry Point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Shell plugin for KataGo sidecar spawn and stdio
        .plugin(tauri_plugin_shell::init())
        // File system plugin for config and model file access
        .plugin(tauri_plugin_fs::init())
        // Initialize AppState at startup:
        // 1. Open SQLite DB in app data directory
        // 2. Apply WAL mode pragmas (from Step 7 INIT_PRAGMAS)
        // 3. Run schema migrations
        // 4. Set katago to None (started on demand)
        .setup(|app| {
            let app_dir = app.path().app_data_dir()
                .expect("Failed to resolve app data directory");
            std::fs::create_dir_all(&app_dir)
                .expect("Failed to create app data directory");

            let db_path = app_dir.join("baduk.db");
            let conn = db::open_database(&db_path)
                .expect("Failed to open SQLite database");

            app.manage(AppState {
                db: Mutex::new(conn),
                katago: Mutex::new(None),
            });

            Ok(())
        })
        // Register all 29 Tauri commands
        .invoke_handler(tauri::generate_handler![
            // Module 2: storage (6 commands)
            commands::storage::storage_save_game,
            commands::storage::storage_load_game,
            commands::storage::storage_list_games,
            commands::storage::storage_delete_game,
            commands::storage::storage_get_setting,
            commands::storage::storage_set_setting,
            // Module 6: katago-bridge (7 commands)
            commands::katago::katago_initialize,
            commands::katago::katago_shutdown,
            commands::katago::katago_analyze,
            commands::katago::katago_cancel,
            commands::katago::katago_cancel_all,
            commands::katago::katago_get_status,
            commands::katago::katago_detect_backend,
            // Module 7: game-engine (6 commands)
            commands::game::game_create,
            commands::game::game_play_move,
            commands::game::game_play_pass,
            commands::game::game_resign,
            commands::game::game_load,
            commands::game::game_export_sgf,
            // Module 8: explanation-engine (3 commands)
            commands::explanation::explanation_generate,
            commands::explanation::explanation_set_tier,
            commands::explanation::explanation_get_tier,
            // Module 4: i18n (1 command)
            commands::i18n::i18n_get_system_locale,
            // Module 9: analytics (2 commands)
            commands::analytics::analytics_set_consent,
            commands::analytics::analytics_get_consent,
            // Module 10: gamification (4 commands)
            commands::gamification::gamification_get_quests,
            commands::gamification::gamification_complete_quest,
            commands::gamification::gamification_get_progress,
            commands::gamification::gamification_check_achievements,
        ])
        .run(tauri::generate_context!())
        .expect("error while running baduk application");
}
