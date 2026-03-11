// =============================================================================
// src/db/schema/tables.ts — Drizzle ORM Schema (re-export from Step 7)
// =============================================================================
// This file is the canonical schema used by Drizzle Kit for migration generation.
// It is a verbatim copy of outputs/step-07-schema.ts with the same design decisions:
//
//   1. TEXT UUIDs as primary keys (client-side generation)
//   2. INTEGER timestamps (Unix epoch seconds)
//   3. JSON-in-TEXT for katago_data, daily_quests, badges
//   4. Append-only moves table
//   5. WAL mode (configured in Rust at connection time, not in schema)
//   6. Drizzle push (not migrate) — see drizzle.config.ts
//
// Consumers: Step 10 (scaffold), Step 11 (data-engineer), Step 12 (katago-integrator)
// =============================================================================

import { relations } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// =============================================================================
// Table 1: users
// =============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  level: integer('level').notNull().default(1),
  createdAt: integer('created_at').notNull(),
})

// =============================================================================
// Table 2: games
// =============================================================================

export const games = sqliteTable(
  'games',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    boardSize: integer('board_size').notNull(),
    rules: text('rules').notNull().default('tromp-taylor'),
    komi: real('komi').notNull().default(7.5),
    mode: text('mode').notNull().default('vs-ai'),
    result: text('result'),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
  },
  (table) => [
    index('idx_games_user_id').on(table.userId),
    index('idx_games_started_at').on(table.startedAt),
  ]
)

// =============================================================================
// Table 3: moves (append-only)
// =============================================================================

export const moves = sqliteTable(
  'moves',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    moveNumber: integer('move_number').notNull(),
    player: text('player').notNull(),
    coordinate: text('coordinate'), // NULL for pass moves (DKS TT-05)
    timestamp: integer('timestamp').notNull(),
  },
  (table) => [
    uniqueIndex('pk_moves').on(table.gameId, table.moveNumber),
    index('idx_moves_game_id').on(table.gameId),
  ]
)

// =============================================================================
// Table 4: analysis
// =============================================================================

export const analysis = sqliteTable(
  'analysis',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    moveNumber: integer('move_number').notNull(),
    katagoData: text('katago_data').notNull(),
    explanationText: text('explanation_text'),
    tier: text('tier').notNull().default('beginner'),
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

export const gamificationProgress = sqliteTable(
  'gamification_progress',
  {
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    dailyQuests: text('daily_quests').notNull().default('[]'),
    streaks: integer('streaks').notNull().default(0),
    badges: text('badges').notNull().default('[]'),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(1),
    lastActivityDate: text('last_activity_date'),
  },
  (table) => [index('idx_gamification_user_id').on(table.userId)]
)

// =============================================================================
// Table 6: settings
// =============================================================================

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

// =============================================================================
// Table 7: analysis_cache
// =============================================================================

export const analysisCache = sqliteTable(
  'analysis_cache',
  {
    positionHash: text('position_hash').notNull(),
    boardSize: integer('board_size').notNull(),
    rules: text('rules').notNull().default('tromp-taylor'),
    katagoData: text('katago_data').notNull(),
    visits: integer('visits').notNull(),
    createdAt: integer('created_at').notNull(),
    lastAccessedAt: integer('last_accessed_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_cache_position').on(table.positionHash, table.boardSize, table.rules),
  ]
)

// =============================================================================
// Drizzle Relations
// =============================================================================

export const usersRelations = relations(users, ({ many, one }) => ({
  games: many(games),
  gamificationProgress: one(gamificationProgress, {
    fields: [users.id],
    references: [gamificationProgress.userId],
  }),
}))

export const gamesRelations = relations(games, ({ one, many }) => ({
  user: one(users, {
    fields: [games.userId],
    references: [users.id],
  }),
  moves: many(moves),
  analysisEntries: many(analysis),
}))

export const movesRelations = relations(moves, ({ one }) => ({
  game: one(games, {
    fields: [moves.gameId],
    references: [games.id],
  }),
}))

export const analysisRelations = relations(analysis, ({ one }) => ({
  game: one(games, {
    fields: [analysis.gameId],
    references: [games.id],
  }),
}))

export const gamificationProgressRelations = relations(gamificationProgress, ({ one }) => ({
  user: one(users, {
    fields: [gamificationProgress.userId],
    references: [users.id],
  }),
}))

// =============================================================================
// Inferred Types
// =============================================================================

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert

export type MoveRow = typeof moves.$inferSelect
export type NewMoveRow = typeof moves.$inferInsert

export type AnalysisRow = typeof analysis.$inferSelect
export type NewAnalysisRow = typeof analysis.$inferInsert

export type GamificationProgressRow = typeof gamificationProgress.$inferSelect
export type NewGamificationProgressRow = typeof gamificationProgress.$inferInsert

export type SettingsRow = typeof settings.$inferSelect
export type NewSettingsRow = typeof settings.$inferInsert

export type AnalysisCacheRow = typeof analysisCache.$inferSelect
export type NewAnalysisCacheRow = typeof analysisCache.$inferInsert

// =============================================================================
// WAL Mode Pragmas (executed by Rust at connection time)
// Exported for documentation and test reference.
// =============================================================================

export const INIT_PRAGMAS = [
  'PRAGMA journal_mode = WAL;',
  'PRAGMA busy_timeout = 5000;',
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA cache_size = -20000;',
  'PRAGMA foreign_keys = ON;',
  'PRAGMA temp_store = MEMORY;',
] as const
