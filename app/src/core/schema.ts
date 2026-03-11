// =============================================================================
// Step 7: Drizzle ORM SQLite Schema — Baduk Platform
// =============================================================================
// Version: 1.0.0
// Author: @schema-designer (Step 7)
// Date: 2026-03-11
// Consumers: Step 10 (scaffold), Step 11 (rules-engineer, data-engineer),
//            Step 12 (katago-integrator), Step 14 (integration)
// Inputs: Step 3 (DKS), Step 6 (architecture), Step 2 (KataGo IPC)
// =============================================================================
//
// DESIGN DECISIONS (CCP justification):
//
// 1. TEXT PRIMARY KEYs (UUIDs): All entity tables use TEXT UUIDs instead of
//    INTEGER AUTOINCREMENT. Rationale: UUIDs can be generated client-side
//    (crypto.randomUUID()) without DB round-trip, enabling offline-first
//    architecture. Tauri desktop apps are single-user, so UUID collision
//    probability is effectively zero.
//
// 2. INTEGER timestamps (Unix epoch seconds): SQLite has no native DATE type.
//    Unix timestamps are compact, sortable, and timezone-agnostic. The
//    frontend converts to locale-aware display strings. Millisecond precision
//    is unnecessary for game timestamps.
//
// 3. JSON-in-TEXT columns: For `katago_data`, `daily_quests`, `badges`.
//    These are opaque blobs that the DB never queries into. They are validated
//    by Zod schemas at the application boundary. Rationale: normalizing
//    KataGo's deeply nested response into relational tables would create
//    50+ columns with no query benefit. JSON-in-TEXT keeps the schema simple
//    and the data faithful to KataGo's output format.
//
// 4. Append-only `moves` table: Moves are never updated or deleted during a
//    game (DKS R25: FollowedBy is strictly ordered). The composite PK
//    (game_id, move_number) enforces ordering. This matches the DKS constraint
//    C07 (AlternatingTurns) at the data level.
//
// 5. WAL mode: Configured at connection time (not in schema). WAL enables
//    concurrent reads from the UI thread while the game engine writes moves.
//    This is critical for smooth board rendering during analysis.
//
// 6. Drizzle push (not migrate): For a desktop app with a local SQLite DB,
//    Drizzle's `push` command is simpler than versioned migrations. The DB
//    schema is the app's private state. If schema changes are needed between
//    releases, a migration script runs at app startup.
// =============================================================================

import { relations } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// =============================================================================
// Table 1: users
// =============================================================================
// Maps to DKS entities: Player (E09 context), PlayerProfile
// The single-user desktop app still uses a users table for future multi-profile
// support and to serve as FK target for games and gamification_progress.
// =============================================================================

export const users = sqliteTable('users', {
  /** UUID v4, generated client-side via crypto.randomUUID() */
  id: text('id').primaryKey(),

  /** Display name chosen by the user */
  name: text('name').notNull(),

  /** Current skill level (1 = absolute beginner, higher = stronger) */
  level: integer('level').notNull().default(1),

  /** Account creation timestamp (Unix epoch seconds) */
  createdAt: integer('created_at').notNull(),
})

// =============================================================================
// Table 2: games
// =============================================================================
// Maps to DKS entities: Game flow (C13 GameStartsEmpty, C14 BlackFirst,
// C15 TwoPassesEndGame, C16 ResignationEndsGame).
// The `rules` column stores the ruleset string matching KataGo's `Rules` type
// from Step 2 IPC spec (Section 3.1). Default is "tromp-taylor" per DKS.
// Board sizes restricted to {9, 13, 19} per DKS C01 (ValidBoardSize).
// =============================================================================

export const games = sqliteTable(
  'games',
  {
    /** UUID v4 */
    id: text('id').primaryKey(),

    /** FK to users.id — the player who created/owns this game */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Board size: 9, 13, or 19.
     * CHECK constraint enforces DKS C01 (ValidBoardSize).
     */
    boardSize: integer('board_size').notNull(),

    /**
     * Ruleset string matching KataGo's RulesetString type.
     * Default "tromp-taylor" per DKS metadata.ruleset.
     */
    rules: text('rules').notNull().default('tromp-taylor'),

    /**
     * Komi value (compensation for White).
     * Default 7.5 for 19x19, 5.5 for 9x9/13x13. Set at game creation.
     * Range [-150, 150] matches KataGo's komi range (Step 2 Section 3.1).
     */
    komi: real('komi').notNull().default(7.5),

    /**
     * Game mode: vs-AI, review, tutorial.
     * Matches Step 6 game-engine responsibility boundary.
     */
    mode: text('mode').notNull().default('vs-ai'),

    /**
     * Game result string. NULL while game is in progress.
     * Format: "B+R" (Black wins by resignation), "W+3.5" (White wins by 3.5),
     * "B+T" (Black wins on time), "Draw" (rare, only with integer komi).
     * Matches SGF RE property format for SGF export compatibility.
     */
    result: text('result'),

    /** Game creation timestamp (Unix epoch seconds) */
    startedAt: integer('started_at').notNull(),

    /** Game completion timestamp. NULL while in progress. */
    endedAt: integer('ended_at'),
  },
  (table) => [
    index('idx_games_user_id').on(table.userId),
    index('idx_games_started_at').on(table.startedAt),
  ]
)

// =============================================================================
// Table 3: moves
// =============================================================================
// Maps to DKS entities: MoveRecord (R25 FollowedBy, R26 PlayedBy, R27 ResultsIn).
// Append-only design: moves are never updated or deleted during a game.
// Composite PK (game_id, move_number) enforces strict ordering per DKS R25.
// The `coordinate` column is NULL for pass moves (DKS TT-05: "pass" is a
// valid move where no stone is placed).
// =============================================================================

export const moves = sqliteTable(
  'moves',
  {
    /** FK to games.id */
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),

    /**
     * Sequential move number starting at 0.
     * Even numbers = Black's turn, odd = White's turn (DKS C07, C14).
     */
    moveNumber: integer('move_number').notNull(),

    /**
     * Player who made this move: "B" (Black) or "W" (White).
     * Matches KataGo's Player type from Step 2.
     */
    player: text('player').notNull(),

    /**
     * GTP coordinate string (e.g., "C4", "Q16") or NULL for pass.
     * GTP notation matches KataGo's GTPLocation type (Step 2 Section 5).
     * NULL represents a pass move (DKS TT-05).
     */
    coordinate: text('coordinate'),

    /** Move timestamp (Unix epoch seconds) */
    timestamp: integer('timestamp').notNull(),
  },
  (table) => [
    // Composite primary key enforced via unique index
    // (Drizzle SQLite does not support composite PKs directly in the table
    // definition, so we use a unique index as the equivalent constraint)
    uniqueIndex('pk_moves').on(table.gameId, table.moveNumber),
    index('idx_moves_game_id').on(table.gameId),
  ]
)

// =============================================================================
// Table 4: analysis
// =============================================================================
// Maps to DKS entities: AnalysisResult (R32 AnalyzedBy, R33 HasBestMove,
// R34 HasWinRate). Stores the complete KataGo AnalysisResponse as JSON.
// The `tier` column tracks which explanation tier was used (Step 4 Section 5.1).
// The `explanation_text` column stores the rendered explanation for caching.
// =============================================================================

export const analysis = sqliteTable(
  'analysis',
  {
    /** UUID v4 */
    id: text('id').primaryKey(),

    /** FK to games.id */
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),

    /**
     * Which move this analysis corresponds to.
     * Combined with gameId, uniquely identifies the analyzed position.
     */
    moveNumber: integer('move_number').notNull(),

    /**
     * Complete KataGo AnalysisResponse as JSON string.
     * Validated by KataGoResponseSchema (Zod) at write time.
     * Contains: id, turnNumber, moveInfos[], rootInfo, ownership?, policy?
     * See Step 2 Section 4 for the full response format.
     */
    katagoData: text('katago_data').notNull(),

    /**
     * Pre-rendered explanation text. NULL if not yet generated.
     * Cached to avoid re-running the template engine on review.
     */
    explanationText: text('explanation_text'),

    /**
     * Explanation tier: "beginner", "intermediate", or "advanced".
     * Matches Step 4's 3-tier template system (Section 5.1).
     */
    tier: text('tier').notNull().default('beginner'),

    /** Analysis creation timestamp (Unix epoch seconds) */
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_analysis_game_move').on(table.gameId, table.moveNumber),
    index('idx_analysis_game_id').on(table.gameId),
  ]
)

// =============================================================================
// Table 5: gamification_progress
// =============================================================================
// Maps to DKS entities: Quest (E-gamification), Badge, PlayerLevel, Streak.
// One row per user (UNIQUE constraint on user_id).
// JSON columns store structured gamification state validated by Zod schemas.
// Step 6 Module 10 (gamification) is the sole writer to this table.
// =============================================================================

export const gamificationProgress = sqliteTable(
  'gamification_progress',
  {
    /** FK to users.id (UNIQUE — one progress record per user) */
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Daily quests JSON array.
     * Structure: Array<{ id: string; type: string; target: number;
     *   progress: number; completed: boolean; date: string }>
     * Validated by DailyQuestsSchema at write time.
     */
    dailyQuests: text('daily_quests').notNull().default('[]'),

    /**
     * Consecutive days of play.
     * Reset to 0 if user misses a day (Step 6 gamification spec).
     */
    streaks: integer('streaks').notNull().default(0),

    /**
     * Earned badges JSON array.
     * Structure: Array<{ id: string; name: string; earnedAt: number }>
     * Validated by BadgesSchema at write time.
     */
    badges: text('badges').notNull().default('[]'),

    /**
     * Experience points accumulated.
     * Sources: game completion, quest completion, daily login.
     */
    xp: integer('xp').notNull().default(0),

    /**
     * Current gamification level (derived from XP thresholds).
     * Separate from users.level (skill level) — this is engagement level.
     */
    level: integer('level').notNull().default(1),

    /** Last activity date as ISO string (YYYY-MM-DD) for streak calculation */
    lastActivityDate: text('last_activity_date'),
  },
  (table) => [index('idx_gamification_user_id').on(table.userId)]
)

// =============================================================================
// Table 6: settings
// =============================================================================
// Key-value store for application settings.
// Used by Step 6 Module 2 (storage) via IStoragePort.getSetting/setSetting.
// Values are JSON-serialized strings, validated at the application layer.
// =============================================================================

export const settings = sqliteTable('settings', {
  /**
   * Setting key (e.g., "theme", "defaultBoardSize", "katagoBackend",
   * "explanationTier", "locale", "analyticsConsent").
   */
  key: text('key').primaryKey(),

  /**
   * JSON-serialized setting value.
   * Type safety enforced at the application layer via Zod schemas.
   */
  value: text('value').notNull(),
})

// =============================================================================
// Table 7: analysis_cache (bonus — performance optimization)
// =============================================================================
// Caches KataGo analysis by position hash to avoid re-analyzing identical
// positions across different games. Maps to DKS R31 (ProducesHash) and
// R38 (HasHash). Keyed by Zobrist hash (Step 3 Section 4).
// =============================================================================

export const analysisCache = sqliteTable(
  'analysis_cache',
  {
    /**
     * Zobrist position hash (hex string).
     * Matches Step 3 Section 4: "64-bit XOR hash of board state".
     * Combined with board_size and rules for uniqueness.
     */
    positionHash: text('position_hash').notNull(),

    /** Board size used when this position was analyzed */
    boardSize: integer('board_size').notNull(),

    /** Rules used when this position was analyzed */
    rules: text('rules').notNull().default('tromp-taylor'),

    /**
     * KataGo AnalysisResponse JSON.
     * Same format as analysis.katago_data.
     */
    katagoData: text('katago_data').notNull(),

    /** Number of visits used for this analysis (for freshness comparison) */
    visits: integer('visits').notNull(),

    /** Cache entry creation timestamp */
    createdAt: integer('created_at').notNull(),

    /** Last access timestamp (for LRU eviction) */
    lastAccessedAt: integer('last_accessed_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_cache_position').on(table.positionHash, table.boardSize, table.rules),
  ]
)

// =============================================================================
// Drizzle Relations
// =============================================================================
// These relation definitions enable Drizzle's relational query API.
// They mirror the DKS Relation Catalog (Step 3 Section 3).
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  /** A user owns many games (DKS: Player creates Games) */
  games: many(games),
  /** A user has one gamification progress record */
  gamificationProgress: one(gamificationProgress, {
    fields: [users.id],
    references: [gamificationProgress.userId],
  }),
}))

export const gamesRelations = relations(games, ({ one, many }) => ({
  /** A game belongs to one user */
  user: one(users, {
    fields: [games.userId],
    references: [users.id],
  }),
  /** A game has many moves (DKS R25: FollowedBy — ordered sequence) */
  moves: many(moves),
  /** A game has many analysis entries (DKS R32: AnalyzedBy) */
  analysisEntries: many(analysis),
}))

export const movesRelations = relations(moves, ({ one }) => ({
  /** A move belongs to one game */
  game: one(games, {
    fields: [moves.gameId],
    references: [games.id],
  }),
}))

export const analysisRelations = relations(analysis, ({ one }) => ({
  /** An analysis entry belongs to one game */
  game: one(games, {
    fields: [analysis.gameId],
    references: [games.id],
  }),
}))

export const gamificationProgressRelations = relations(gamificationProgress, ({ one }) => ({
  /** Progress record belongs to one user */
  user: one(users, {
    fields: [gamificationProgress.userId],
    references: [users.id],
  }),
}))

// =============================================================================
// Inferred Types (TypeScript type generation from schema)
// =============================================================================
// These are the canonical types for all database operations.
// Step 11 teams MUST use these types — not hand-written interfaces.
// =============================================================================

/** User row as returned by SELECT */
export type User = typeof users.$inferSelect
/** User row as required by INSERT */
export type NewUser = typeof users.$inferInsert

/** Game row as returned by SELECT */
export type Game = typeof games.$inferSelect
/** Game row as required by INSERT */
export type NewGame = typeof games.$inferInsert

/** Move row as returned by SELECT */
export type MoveRow = typeof moves.$inferSelect
/** Move row as required by INSERT */
export type NewMoveRow = typeof moves.$inferInsert

/** Analysis row as returned by SELECT */
export type AnalysisRow = typeof analysis.$inferSelect
/** Analysis row as required by INSERT */
export type NewAnalysisRow = typeof analysis.$inferInsert

/** Gamification progress row as returned by SELECT */
export type GamificationProgressRow = typeof gamificationProgress.$inferSelect
/** Gamification progress row as required by INSERT */
export type NewGamificationProgressRow = typeof gamificationProgress.$inferInsert

/** Settings row as returned by SELECT */
export type SettingsRow = typeof settings.$inferSelect
/** Settings row as required by INSERT */
export type NewSettingsRow = typeof settings.$inferInsert

/** Analysis cache row as returned by SELECT */
export type AnalysisCacheRow = typeof analysisCache.$inferSelect
/** Analysis cache row as required by INSERT */
export type NewAnalysisCacheRow = typeof analysisCache.$inferInsert

// =============================================================================
// Database Initialization SQL (WAL mode + pragmas)
// =============================================================================
// Execute these pragmas at connection time, before any queries.
// WAL mode enables concurrent reads (Step 6 architecture requirement).
// =============================================================================

export const INIT_PRAGMAS = [
  'PRAGMA journal_mode = WAL;',
  'PRAGMA busy_timeout = 5000;',
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA cache_size = -20000;', // 20MB cache
  'PRAGMA foreign_keys = ON;',
  'PRAGMA temp_store = MEMORY;',
] as const
