-- =============================================================================
-- Migration 0000: Initial Schema
-- =============================================================================
-- Generated from Step 7 Drizzle ORM schema (step-07-schema.ts)
-- Applied at: Tauri app startup via Rust db.rs create_schema()
-- Also applied by: drizzle-kit push (for development tooling)
--
-- All tables use CREATE TABLE IF NOT EXISTS for idempotent application.
-- Composite primary keys are enforced via UNIQUE indexes (SQLite limitation).
-- =============================================================================

-- Table 1: users
CREATE TABLE IF NOT EXISTS `users` (
  `id`         TEXT NOT NULL PRIMARY KEY,
  `name`       TEXT NOT NULL,
  `level`      INTEGER NOT NULL DEFAULT 1,
  `created_at` INTEGER NOT NULL
);

-- Table 2: games
CREATE TABLE IF NOT EXISTS `games` (
  `id`         TEXT NOT NULL PRIMARY KEY,
  `user_id`    TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `board_size` INTEGER NOT NULL,
  `rules`      TEXT NOT NULL DEFAULT 'tromp-taylor',
  `komi`       REAL NOT NULL DEFAULT 7.5,
  `mode`       TEXT NOT NULL DEFAULT 'vs-ai',
  `result`     TEXT,
  `started_at` INTEGER NOT NULL,
  `ended_at`   INTEGER
);
CREATE INDEX IF NOT EXISTS `idx_games_user_id`    ON `games` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_games_started_at` ON `games` (`started_at`);

-- Table 3: moves (append-only per DKS R25)
CREATE TABLE IF NOT EXISTS `moves` (
  `game_id`     TEXT NOT NULL REFERENCES `games`(`id`) ON DELETE CASCADE,
  `move_number` INTEGER NOT NULL,
  `player`      TEXT NOT NULL,
  `coordinate`  TEXT,  -- NULL for pass moves (DKS TT-05)
  `timestamp`   INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `pk_moves`       ON `moves` (`game_id`, `move_number`);
CREATE        INDEX IF NOT EXISTS `idx_moves_game` ON `moves` (`game_id`);

-- Table 4: analysis
CREATE TABLE IF NOT EXISTS `analysis` (
  `id`               TEXT NOT NULL PRIMARY KEY,
  `game_id`          TEXT NOT NULL REFERENCES `games`(`id`) ON DELETE CASCADE,
  `move_number`      INTEGER NOT NULL,
  `katago_data`      TEXT NOT NULL,
  `explanation_text` TEXT,
  `tier`             TEXT NOT NULL DEFAULT 'beginner',
  `created_at`       INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_analysis_game_move` ON `analysis` (`game_id`, `move_number`);
CREATE        INDEX IF NOT EXISTS `idx_analysis_game_id`   ON `analysis` (`game_id`);

-- Table 5: gamification_progress
CREATE TABLE IF NOT EXISTS `gamification_progress` (
  `user_id`            TEXT NOT NULL UNIQUE REFERENCES `users`(`id`) ON DELETE CASCADE,
  `daily_quests`       TEXT NOT NULL DEFAULT '[]',
  `streaks`            INTEGER NOT NULL DEFAULT 0,
  `badges`             TEXT NOT NULL DEFAULT '[]',
  `xp`                 INTEGER NOT NULL DEFAULT 0,
  `level`              INTEGER NOT NULL DEFAULT 1,
  `last_activity_date` TEXT
);
CREATE INDEX IF NOT EXISTS `idx_gamification_user_id` ON `gamification_progress` (`user_id`);

-- Table 6: settings (key-value store)
CREATE TABLE IF NOT EXISTS `settings` (
  `key`   TEXT NOT NULL PRIMARY KEY,
  `value` TEXT NOT NULL
);

-- Table 7: analysis_cache (Zobrist hash → KataGo response cache)
CREATE TABLE IF NOT EXISTS `analysis_cache` (
  `position_hash`    TEXT NOT NULL,
  `board_size`       INTEGER NOT NULL,
  `rules`            TEXT NOT NULL DEFAULT 'tromp-taylor',
  `katago_data`      TEXT NOT NULL,
  `visits`           INTEGER NOT NULL,
  `created_at`       INTEGER NOT NULL,
  `last_accessed_at` INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_cache_position` ON `analysis_cache` (`position_hash`, `board_size`, `rules`);
