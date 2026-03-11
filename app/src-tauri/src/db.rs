// =============================================================================
// db.rs — SQLite Database Initialization
// =============================================================================
// Opens the SQLite database, applies WAL mode pragmas from Step 7, and runs
// the schema creation DDL.
//
// Design decisions (from Step 7 schema):
// - WAL mode enables concurrent reads while game engine writes moves
// - TEXT UUID primary keys match Step 7's client-side UUID generation
// - Composite unique indexes replace composite PKs (SQLite limitation)
// - Foreign keys ON enforced at connection level
// =============================================================================

use rusqlite::{Connection, Result};
use std::path::Path;

/// Opens a SQLite database at `path` and applies the initialization pragmas.
/// Creates the file if it does not exist. Runs the schema DDL (CREATE TABLE IF NOT EXISTS).
pub fn open_database(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Apply WAL mode pragmas (matches Step 7 INIT_PRAGMAS exactly)
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = 5000;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -20000;
        PRAGMA foreign_keys = ON;
        PRAGMA temp_store = MEMORY;
        "
    )?;

    // Create schema tables (idempotent — safe to run on every startup)
    create_schema(&conn)?;

    Ok(conn)
}

/// Creates all 7 tables from Step 7 schema.
/// All CREATE TABLE statements use IF NOT EXISTS for idempotent startup execution.
fn create_schema(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Table 1: users
        CREATE TABLE IF NOT EXISTS users (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            level       INTEGER NOT NULL DEFAULT 1,
            created_at  INTEGER NOT NULL
        );

        -- Table 2: games
        CREATE TABLE IF NOT EXISTS games (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            board_size  INTEGER NOT NULL,
            rules       TEXT NOT NULL DEFAULT 'tromp-taylor',
            komi        REAL NOT NULL DEFAULT 7.5,
            mode        TEXT NOT NULL DEFAULT 'vs-ai',
            result      TEXT,
            started_at  INTEGER NOT NULL,
            ended_at    INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_games_user_id    ON games(user_id);
        CREATE INDEX IF NOT EXISTS idx_games_started_at ON games(started_at);

        -- Table 3: moves (append-only)
        CREATE TABLE IF NOT EXISTS moves (
            game_id     TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            move_number INTEGER NOT NULL,
            player      TEXT NOT NULL,
            coordinate  TEXT,
            timestamp   INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS pk_moves        ON moves(game_id, move_number);
        CREATE        INDEX IF NOT EXISTS idx_moves_game  ON moves(game_id);

        -- Table 4: analysis
        CREATE TABLE IF NOT EXISTS analysis (
            id               TEXT PRIMARY KEY,
            game_id          TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
            move_number      INTEGER NOT NULL,
            katago_data      TEXT NOT NULL,
            explanation_text TEXT,
            tier             TEXT NOT NULL DEFAULT 'beginner',
            created_at       INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_analysis_game_move ON analysis(game_id, move_number);
        CREATE        INDEX IF NOT EXISTS idx_analysis_game_id   ON analysis(game_id);

        -- Table 5: gamification_progress
        CREATE TABLE IF NOT EXISTS gamification_progress (
            user_id            TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            daily_quests       TEXT NOT NULL DEFAULT '[]',
            streaks            INTEGER NOT NULL DEFAULT 0,
            badges             TEXT NOT NULL DEFAULT '[]',
            xp                 INTEGER NOT NULL DEFAULT 0,
            level              INTEGER NOT NULL DEFAULT 1,
            last_activity_date TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_gamification_user_id ON gamification_progress(user_id);

        -- Table 6: settings (key-value store)
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Table 7: analysis_cache (position hash -> KataGo result)
        CREATE TABLE IF NOT EXISTS analysis_cache (
            position_hash    TEXT NOT NULL,
            board_size       INTEGER NOT NULL,
            rules            TEXT NOT NULL DEFAULT 'tromp-taylor',
            katago_data      TEXT NOT NULL,
            visits           INTEGER NOT NULL,
            created_at       INTEGER NOT NULL,
            last_accessed_at INTEGER NOT NULL
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_position ON analysis_cache(position_hash, board_size, rules);
        "
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory() {
        // Use an in-memory database for tests
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        create_schema(&conn).unwrap();

        // Verify all 7 tables exist
        let tables: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .unwrap();
            stmt.query_map([], |row| row.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };

        let expected = vec![
            "analysis",
            "analysis_cache",
            "gamification_progress",
            "games",
            "moves",
            "settings",
            "users",
        ];
        assert_eq!(tables, expected, "All 7 schema tables must be created");
    }

    #[test]
    fn test_idempotent_schema_creation() {
        // Running create_schema twice must not error
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        create_schema(&conn).unwrap();
        create_schema(&conn).unwrap(); // second call must be a no-op
    }
}
